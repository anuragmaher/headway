"""
Customer Chat Service

Main service for customer chat that handles:
1. Intent classification (map queries to templates)
2. Template execution
3. Text-to-SQL fallback for custom queries
4. Response formatting
"""

import json
from typing import Dict, Any, List, Optional
from openai import OpenAI
import logging
from sqlalchemy.orm import Session
import sqlparse

from app.services.customer_query_templates import get_customer_query_templates
from app.core.config import settings

logger = logging.getLogger(__name__)


class CustomerChatService:
    """Service for handling customer chat queries"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the customer chat service

        Args:
            api_key: OpenAI API key (defaults to settings)
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY in .env file.")

        self.client = OpenAI(api_key=self.api_key)
        self.templates_service = get_customer_query_templates()

    def chat(
        self,
        db: Session,
        customer_id: str,
        workspace_id: str,
        user_query: str
    ) -> Dict[str, Any]:
        """
        Process a chat query about a customer

        Args:
            db: Database session
            customer_id: Customer ID
            workspace_id: Workspace ID
            user_query: Natural language query from user

        Returns:
            Dictionary with response and metadata
        """
        try:
            # Step 1: Classify intent
            intent_result = self.classify_intent(user_query)

            template_id = intent_result.get('template_id')
            confidence = intent_result.get('confidence', 0.0)
            params = intent_result.get('params', {})

            logger.info(
                f"Intent classified: template_id={template_id}, "
                f"confidence={confidence}, params={params}"
            )

            # Step 2: Route based on confidence
            if confidence >= 0.8 and template_id:
                # High confidence - execute template directly
                result = self.templates_service.execute_template(
                    db, template_id, customer_id, params
                )

                if result['success']:
                    # Format response
                    formatted_response = self.format_template_response(
                        user_query, template_id, result['data']
                    )
                    return {
                        "success": True,
                        "response": formatted_response,
                        "method": "template",
                        "template_id": template_id,
                        "confidence": confidence
                    }
                else:
                    # Template execution failed, try text-to-SQL fallback
                    return self._fallback_to_sql(db, customer_id, user_query)

            elif confidence >= 0.5 and template_id:
                # Medium confidence - suggest template
                template = self.templates_service.get_template(template_id)
                return {
                    "success": True,
                    "response": f"I'm not 100% sure. Did you mean: '{template.name}'?",
                    "method": "suggestion",
                    "template_id": template_id,
                    "confidence": confidence,
                    "suggested_templates": [
                        {
                            "template_id": template_id,
                            "name": template.name,
                            "description": template.description
                        }
                    ]
                }

            else:
                # Low confidence - suggest options or fallback to SQL
                top_templates = self._get_top_template_suggestions(user_query, limit=3)

                if len(top_templates) > 0:
                    return {
                        "success": True,
                        "response": "I'm not sure what you're asking. Did you mean:",
                        "method": "suggestion",
                        "confidence": confidence,
                        "suggested_templates": top_templates
                    }
                else:
                    # Try custom SQL query
                    return self._fallback_to_sql(db, customer_id, user_query)

        except Exception as e:
            logger.error(f"Error processing chat query: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "I encountered an error processing your question. Please try rephrasing."
            }

    def classify_intent(self, user_query: str) -> Dict[str, Any]:
        """
        Classify user intent and map to template

        Args:
            user_query: Natural language query

        Returns:
            Dictionary with template_id, confidence, and params
        """
        try:
            # Get all available templates
            templates = self.templates_service.list_templates()

            # Build template list for prompt
            template_list = "\n".join([
                f"{t['template_id']}: {t['name']} - {t['description']}\n"
                f"   Examples: {', '.join(t['example_queries'][:2])}"
                for t in templates
            ])

            system_prompt = f"""You are an intent classifier for a customer analytics chat system.

Map the user's query to one of the available templates below. If the query matches a template, respond with the template_id and confidence score (0.0-1.0).

Available templates:
{template_list}

Respond with JSON in this format:
{{
  "template_id": "template_id or null",
  "confidence": 0.0-1.0,
  "params": {{}},
  "reasoning": "brief explanation"
}}

Guidelines:
- confidence >= 0.8: Clear match, execute directly
- confidence 0.5-0.8: Likely match, confirm with user
- confidence < 0.5: Unclear, suggest options or use custom query

Extract parameters when needed:
- For "get_features_by_theme": extract theme_name
- For "get_recent_*": extract days if mentioned
- For "get_messages_by_source": extract source (gong/fathom/slack)
"""

            user_prompt = f"User query: {user_query}\n\nClassify this query and map to a template."

            # Call OpenAI API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Cheap and fast for classification
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )

            # Parse response
            result = json.loads(response.choices[0].message.content)

            logger.info(f"Intent classification result: {result}")

            return result

        except Exception as e:
            logger.error(f"Error in intent classification: {e}")
            return {
                "template_id": None,
                "confidence": 0.0,
                "params": {},
                "reasoning": f"Classification error: {str(e)}"
            }

    def format_template_response(
        self,
        user_query: str,
        template_id: str,
        data: Dict[str, Any]
    ) -> str:
        """
        Format template data into natural language response

        Args:
            user_query: Original user query
            template_id: Template that was executed
            data: Template execution results

        Returns:
            Natural language response
        """
        try:
            system_prompt = """You are a customer insights assistant.

Convert the query results into a conversational, natural language response.
Be concise, friendly, and highlight the most important information.

Guidelines:
- Use bullet points for lists
- Include numbers and metrics
- Be specific and actionable
- Keep it under 200 words unless there's a lot of data"""

            user_prompt = f"""User question: "{user_query}"

Query results:
{json.dumps(data, indent=2)}

Convert this into a natural, conversational response."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3
            )

            formatted_response = response.choices[0].message.content

            return formatted_response

        except Exception as e:
            logger.error(f"Error formatting response: {e}")
            # Fallback to raw data
            return f"Here's what I found:\n\n{json.dumps(data, indent=2)}"

    def _get_top_template_suggestions(self, user_query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Get top template suggestions based on similarity

        Args:
            user_query: User's query
            limit: Number of suggestions

        Returns:
            List of template suggestions
        """
        try:
            templates = self.templates_service.list_templates()

            # Use LLM to find most relevant templates
            template_list = "\n".join([
                f"{i+1}. {t['template_id']}: {t['name']} - {t['description']}"
                for i, t in enumerate(templates)
            ])

            system_prompt = f"""Given a user query, suggest the {limit} most relevant templates.

Available templates:
{template_list}

Respond with JSON array of template_ids in order of relevance:
["template_id1", "template_id2", "template_id3"]"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Query: {user_query}"}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            suggested_ids = result.get('templates', [])[:limit]

            suggestions = []
            for tid in suggested_ids:
                template = self.templates_service.get_template(tid)
                if template:
                    suggestions.append({
                        "template_id": tid,
                        "name": template.name,
                        "description": template.description
                    })

            return suggestions

        except Exception as e:
            logger.error(f"Error getting template suggestions: {e}")
            return []

    def _fallback_to_sql(self, db: Session, customer_id: str, user_query: str) -> Dict[str, Any]:
        """
        Fallback to text-to-SQL for custom queries

        Args:
            db: Database session
            customer_id: Customer ID
            user_query: User query

        Returns:
            Query result
        """
        try:
            # Generate SQL query
            sql_query = self.generate_sql_query(user_query, customer_id)

            # Validate query
            if not self.validate_sql_query(sql_query):
                return {
                    "success": False,
                    "error": "Generated query failed validation",
                    "response": "I couldn't generate a safe query for that question. Please try rephrasing."
                }

            # Execute query
            result = db.execute(text(sql_query))
            rows = result.fetchall()

            # Format results
            data = [dict(row) for row in rows]

            # Format response
            formatted_response = self.format_sql_response(user_query, data)

            return {
                "success": True,
                "response": formatted_response,
                "method": "sql",
                "sql_query": sql_query,
                "row_count": len(data)
            }

        except Exception as e:
            logger.error(f"Error in SQL fallback: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "I couldn't execute a custom query for that. Please try a different question."
            }

    def generate_sql_query(self, user_query: str, customer_id: str) -> str:
        """
        Generate SQL query from natural language

        Args:
            user_query: User's natural language query
            customer_id: Customer ID to filter by

        Returns:
            SQL query string
        """
        # Read schema from SCHEMA.md
        schema_context = """
Database Schema:

Table: customers
- id (UUID), name, domain, industry, arr, mrr, deal_stage, use_cases, contact_name, contact_email

Table: messages
- id (UUID), customer_id (FK), content, source, title, sent_at, author_name
- tier1_processed (BOOLEAN), tier2_processed (BOOLEAN), feature_score (FLOAT)

Table: features (customer_asks)
- id (UUID), name, description, urgency, status, mention_count, theme_id, last_mentioned

Table: themes
- id (UUID), name, description

Table: feature_messages (association table)
- feature_id (FK), message_id (FK)
"""

        system_prompt = f"""{schema_context}

Generate a valid PostgreSQL query for the user's question.

CRITICAL RULES:
1. ONLY generate SELECT statements
2. ALWAYS include WHERE customer_id = '{customer_id}'
3. Add LIMIT 100 to prevent huge result sets
4. Use parameterized values, not string concatenation

Return ONLY the SQL query, no explanation."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Use better model for SQL generation
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Generate SQL for: {user_query}"}
                ],
                temperature=0.1
            )

            sql_query = response.choices[0].message.content.strip()

            # Clean up SQL (remove markdown code blocks if present)
            if sql_query.startswith("```"):
                sql_query = sql_query.split("\n", 1)[1]
                sql_query = sql_query.rsplit("```", 1)[0]

            logger.info(f"Generated SQL: {sql_query}")

            return sql_query

        except Exception as e:
            logger.error(f"Error generating SQL: {e}")
            raise

    def validate_sql_query(self, sql_query: str) -> bool:
        """
        Validate SQL query for safety

        Args:
            sql_query: SQL query to validate

        Returns:
            True if safe, False otherwise
        """
        try:
            # Parse SQL
            parsed = sqlparse.parse(sql_query)

            if not parsed:
                return False

            statement = parsed[0]

            # Check statement type
            if statement.get_type() != 'SELECT':
                logger.warning(f"Non-SELECT statement detected: {statement.get_type()}")
                return False

            # Check for dangerous keywords
            dangerous_keywords = [
                'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER',
                'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE'
            ]

            sql_upper = sql_query.upper()
            for keyword in dangerous_keywords:
                if keyword in sql_upper:
                    logger.warning(f"Dangerous keyword detected: {keyword}")
                    return False

            # Ensure LIMIT is present
            if 'LIMIT' not in sql_upper:
                logger.warning("No LIMIT clause found")
                return False

            return True

        except Exception as e:
            logger.error(f"Error validating SQL: {e}")
            return False

    def format_sql_response(self, user_query: str, data: List[Dict[str, Any]]) -> str:
        """
        Format SQL query results into natural language

        Args:
            user_query: Original query
            data: Query results

        Returns:
            Formatted response
        """
        try:
            system_prompt = """You are a customer insights assistant.

Convert the SQL query results into a natural language response.
Be specific, concise, and highlight key insights."""

            user_prompt = f"""User question: "{user_query}"

Query results ({len(data)} rows):
{json.dumps(data[:10], indent=2)}  # Limit to first 10 rows for prompt

Convert this into a natural response."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3
            )

            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"Error formatting SQL response: {e}")
            return f"Found {len(data)} results:\n\n{json.dumps(data[:5], indent=2)}"


# Singleton instance
_customer_chat_service = None


def get_customer_chat_service() -> CustomerChatService:
    """Get or create the customer chat service singleton"""
    global _customer_chat_service
    if _customer_chat_service is None:
        _customer_chat_service = CustomerChatService()
    return _customer_chat_service

"""
Workspace Chat Service

Service for workspace-level chat that handles queries across ALL customers.
"""

import json
from typing import Dict, Any, List, Optional
from openai import OpenAI
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings

logger = logging.getLogger(__name__)


class WorkspaceChatService:
    """Service for handling workspace-level chat queries across all customers"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the workspace chat service

        Args:
            api_key: OpenAI API key (defaults to settings)
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY in .env file.")

        self.client = OpenAI(api_key=self.api_key)

    def chat(
        self,
        db: Session,
        workspace_id: str,
        user_query: str
    ) -> Dict[str, Any]:
        """
        Process a chat query about all customers in the workspace

        Args:
            db: Database session
            workspace_id: Workspace ID
            user_query: Natural language query from user

        Returns:
            Dictionary with response and metadata
        """
        try:
            # Step 1: Generate SQL query for the user's question
            sql_query = self.generate_workspace_sql(user_query, workspace_id, db)

            # Step 2: Validate query
            if not self.validate_sql_query(sql_query):
                return {
                    "success": False,
                    "error": "Generated query failed validation",
                    "response": "I couldn't generate a safe query for that question. Please try rephrasing."
                }

            # Step 3: Execute query
            result = db.execute(text(sql_query))
            rows = result.fetchall()

            # Convert rows to list of dicts
            data = []
            for row in rows:
                row_dict = {}
                for key in row._fields:
                    value = getattr(row, key)
                    row_dict[key] = value
                data.append(row_dict)

            logger.info(f"Query returned {len(data)} rows")

            # Step 4: Format response using LLM
            formatted_response = self.format_response(user_query, data)

            return {
                "success": True,
                "response": formatted_response,
                "method": "sql",
                "sql_query": sql_query
            }

        except Exception as e:
            logger.error(f"Error processing workspace chat query: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "response": f"I encountered an error processing your question: {str(e)}. Please try rephrasing."
            }

    def generate_workspace_sql(self, user_query: str, workspace_id: str, db: Session = None) -> str:
        """
        Generate SQL query from natural language for workspace-wide queries

        Args:
            user_query: User's natural language query
            workspace_id: Workspace ID to filter by
            db: Database session to fetch context (optional)

        Returns:
            SQL query string
        """
        # Fetch actual themes for this workspace to provide context
        themes_context = ""
        if db:
            try:
                themes_result = db.execute(
                    text(f"SELECT id, name, description FROM themes WHERE workspace_id = '{workspace_id}'")
                )
                themes = themes_result.fetchall()
                if themes:
                    themes_list = [f"- {row.name} (id: {row.id})" + (f" - {row.description}" if row.description else "")
                                   for row in themes]
                    themes_context = f"""
Available Themes in this workspace:
{chr(10).join(themes_list)}

When user asks about a specific theme name (e.g., "AI features", "Security", "Analytics"), JOIN with themes table and filter by theme name.
"""
            except Exception as e:
                logger.warning(f"Could not fetch themes context: {e}")

        schema_context = f"""
Database Schema (PostgreSQL):

Table: customers
- id (UUID PRIMARY KEY)
- workspace_id (UUID) - ALWAYS filter by this in queries
- name (TEXT) - Customer company name
- domain (TEXT) - Email domain
- industry (TEXT) - Industry sector
- arr (NUMERIC) - Annual Recurring Revenue
- mrr (NUMERIC) - Monthly Recurring Revenue
- deal_stage (TEXT) - Sales stage (e.g., 'prospect', 'customer', 'churned')
- deal_amount (NUMERIC)
- contact_name (TEXT)
- contact_email (TEXT)
- is_active (BOOLEAN) - default TRUE

Table: messages
- id (UUID PRIMARY KEY)
- customer_id (UUID FK to customers.id)
- workspace_id (UUID)
- content (TEXT) - Message content
- source (TEXT) - 'gong', 'fathom', or 'slack'
- title (TEXT)
- sent_at (TIMESTAMP)
- author_name (TEXT)
- ai_insights (JSONB) - Contains extracted insights

Table: features
- id (UUID PRIMARY KEY)
- workspace_id (UUID)
- name (TEXT) - Feature request name
- description (TEXT)
- urgency (TEXT) - 'low', 'medium', 'high', 'critical'
- status (TEXT) - 'requested', 'planned', 'in_progress', 'shipped'
- mention_count (INTEGER)
- theme_id (UUID FK to themes.id)
- first_mentioned (TIMESTAMP)
- last_mentioned (TIMESTAMP)

Table: themes
- id (UUID PRIMARY KEY)
- workspace_id (UUID)
- name (TEXT) - Theme category name
- description (TEXT)

Table: feature_messages (junction table)
- feature_id (UUID FK to features.id)
- message_id (UUID FK to messages.id)

ai_insights JSONB structure in messages table:
{{
  "feature_requests": [{{"name": "", "description": "", "urgency": "", "quote": "", "theme": ""}}],
  "pain_points": [{{"description": "", "impact": "", "quote": ""}}],
  "sentiment": {{"overall": "positive|neutral|negative", "score": 0.0-1.0}}
}}

Current workspace_id: {workspace_id}

{themes_context}
"""

        system_prompt = f"""{schema_context}

You are a SQL expert generating PostgreSQL queries for a customer insights platform.

Generate a valid PostgreSQL query for the user's question.

CRITICAL RULES:
1. ONLY generate SELECT statements
2. ALWAYS include WHERE workspace_id = '{workspace_id}' for customers, messages, features, and themes tables
3. Add LIMIT 100 to prevent huge result sets
4. For JSONB queries, use proper operators: ->, ->>, @>, ?
5. Use JOINs when querying across tables
6. For aggregations, use appropriate GROUP BY
7. Use descriptive column aliases for clarity
8. Ensure all columns referenced exist in the schema
9. IMPORTANT: For "most urgent" or "urgent" queries, use ORDER BY with CASE to sort urgency properly (critical > high > medium > low). DO NOT filter by urgency='critical' alone.

Common query patterns:
- Customers with most messages: SELECT c.name, COUNT(m.id) as message_count FROM customers c LEFT JOIN messages m ON m.customer_id = c.id WHERE c.workspace_id = '{workspace_id}' GROUP BY c.id, c.name ORDER BY message_count DESC LIMIT 100
- Most urgent feature requests by customer: SELECT c.name AS customer_name, f.name AS feature_name, f.urgency FROM customers c JOIN messages m ON m.customer_id = c.id JOIN feature_messages fm ON fm.message_id = m.id JOIN features f ON f.id = fm.feature_id WHERE c.workspace_id = '{workspace_id}' ORDER BY CASE f.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, c.name LIMIT 100
- Feature requests by customer: SELECT c.name, f.name, f.urgency FROM customers c JOIN feature_messages fm ON fm.message_id IN (SELECT id FROM messages WHERE customer_id = c.id) JOIN features f ON f.id = fm.feature_id WHERE c.workspace_id = '{workspace_id}' LIMIT 100
- Top pain points: SELECT content, ai_insights->'pain_points' as pain_points FROM messages WHERE workspace_id = '{workspace_id}' AND ai_insights->'pain_points' IS NOT NULL LIMIT 100
- Industry breakdown: SELECT industry, COUNT(*) as count FROM customers WHERE workspace_id = '{workspace_id}' GROUP BY industry ORDER BY count DESC LIMIT 100

Return ONLY the SQL query, no explanation or markdown formatting."""

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
                lines = sql_query.split("\n")
                sql_query = "\n".join(lines[1:-1])  # Remove first and last line

            # Remove any remaining markdown
            sql_query = sql_query.replace("```sql", "").replace("```", "").strip()

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
            sql_upper = sql_query.upper()

            # Check for dangerous keywords
            dangerous_keywords = [
                'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER',
                'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC'
            ]

            for keyword in dangerous_keywords:
                if keyword in sql_upper:
                    logger.warning(f"Dangerous keyword detected: {keyword}")
                    return False

            # Ensure LIMIT is present
            if 'LIMIT' not in sql_upper:
                logger.warning("No LIMIT clause found")
                return False

            # Must be a SELECT statement
            if not sql_upper.strip().startswith('SELECT'):
                logger.warning("Not a SELECT statement")
                return False

            return True

        except Exception as e:
            logger.error(f"Error validating SQL: {e}")
            return False

    def format_response(self, user_query: str, data: List[Dict[str, Any]]) -> str:
        """
        Format SQL query results into natural language response

        Args:
            user_query: Original query
            data: Query results

        Returns:
            Formatted natural language response
        """
        try:
            if not data:
                return "I couldn't find any results for your query. Try asking a different question."

            system_prompt = """You are a customer insights assistant.

Convert the SQL query results into a conversational, natural language response.
Be specific, concise, and highlight key insights.

Guidelines:
- Use bullet points for lists
- Include numbers and metrics
- Be specific and actionable
- Keep it under 300 words unless there's a lot of important data
- Mention the number of results found
- If there are customer names, mention them
- If there are metrics (message counts, feature requests, etc.), highlight them"""

            # Truncate long text fields to avoid context length issues
            def truncate_long_fields(row_dict: Dict[str, Any], max_length: int = 500) -> Dict[str, Any]:
                """Truncate string fields that are too long"""
                truncated = {}
                for key, value in row_dict.items():
                    if isinstance(value, str) and len(value) > max_length:
                        truncated[key] = value[:max_length] + "... (truncated)"
                    else:
                        truncated[key] = value
                return truncated

            # Limit data and truncate long fields
            # For queries with large content (like message_content), use fewer rows
            has_large_content = any('content' in str(k).lower() for row in data[:1] for k in row.keys())
            preview_count = 5 if has_large_content else 15

            data_preview = [truncate_long_fields(row) for row in data[:preview_count]]

            user_prompt = f"""User question: "{user_query}"

Query results ({len(data)} total rows, showing first {len(data_preview)}):
{json.dumps(data_preview, indent=2, default=str)}

Convert this into a natural, conversational response that directly answers the user's question."""

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
            # Better fallback with truncated data
            try:
                # Try to provide a simple summary instead of raw JSON
                summary = f"I found {len(data)} results"
                if data and len(data) > 0:
                    first_row_keys = list(data[0].keys())
                    summary += f" with fields: {', '.join(first_row_keys[:5])}"
                return summary + ". The data was too large to format properly. Please try a more specific query."
            except:
                return f"Found {len(data)} results, but encountered an error formatting the response. Please try a more specific query."


# Singleton instance
_workspace_chat_service = None


def get_workspace_chat_service() -> WorkspaceChatService:
    """Get or create the workspace chat service singleton"""
    global _workspace_chat_service
    if _workspace_chat_service is None:
        _workspace_chat_service = WorkspaceChatService()
    return _workspace_chat_service

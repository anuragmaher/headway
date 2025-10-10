import os
import logging
from typing import Dict, Any, Optional, List
from openai import OpenAI
import json
from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.theme import Theme
from app.models.data_extraction_field import DataExtractionField
from app.core.database import get_db

logger = logging.getLogger(__name__)


class AIProcessingService:
    """Service for processing messages with AI to extract feature requests and insights"""

    def __init__(self):
        """Initialize OpenAI client"""
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"  # Cost-effective model for analysis

    def _get_workspace_schemas(self, workspace_id: str, db: Session) -> Dict[str, Any]:
        """
        Fetch workspace-specific themes and data extraction fields

        Args:
            workspace_id: The workspace ID to fetch schemas for
            db: Database session

        Returns:
            Dictionary containing themes and data extraction fields
        """
        # Fetch themes
        themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).all()

        theme_list = []
        for theme in themes:
            theme_data = {
                "id": str(theme.id),
                "name": theme.name,
                "description": theme.description
            }
            if theme.parent_theme_id:
                parent = db.query(Theme).filter(Theme.id == theme.parent_theme_id).first()
                if parent:
                    theme_data["parent"] = parent.name
            theme_list.append(theme_data)

        # Fetch data extraction fields
        data_fields = db.query(DataExtractionField).filter(
            DataExtractionField.workspace_id == workspace_id,
            DataExtractionField.is_active == True
        ).all()

        field_list = []
        for field in data_fields:
            field_list.append({
                "field_name": field.field_name,
                "field_type": field.field_type,
                "data_type": field.data_type,
                "description": field.description
            })

        return {
            "themes": theme_list,
            "data_fields": field_list
        }

    def process_message(self, message: Message, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Process a single message to extract feature request insights

        Args:
            message: Message object to process
            workspace_id: The workspace ID to fetch user-defined schemas

        Returns:
            Dictionary containing extracted insights
        """
        try:
            logger.info(f"Processing message {message.id} from {message.author_name}")

            # Get database session
            db = next(get_db())

            # Fetch workspace schemas (themes and data extraction fields)
            schemas = self._get_workspace_schemas(workspace_id, db) if workspace_id else {"themes": [], "data_fields": []}

            # Create the analysis prompt
            prompt = self._create_analysis_prompt(message)

            # Call OpenAI API with dynamic system prompt
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt(schemas)
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,  # Low temperature for consistent analysis
                max_tokens=1000,
                response_format={"type": "json_object"}
            )

            # Parse the response
            result = json.loads(response.choices[0].message.content)

            logger.info(f"Successfully processed message {message.id}")
            return result

        except Exception as e:
            logger.error(f"Error processing message {message.id}: {e}")
            return {
                "error": str(e),
                "is_feature_request": False,
                "confidence": 0.0
            }
        finally:
            db.close()
    
    def _get_system_prompt(self, schemas: Dict[str, Any]) -> str:
        """
        Get the system prompt for feature request analysis based on user-defined schemas

        Args:
            schemas: Dictionary containing themes and data_fields

        Returns:
            Dynamic system prompt based on workspace configuration
        """
        themes = schemas.get("themes", [])
        data_fields = schemas.get("data_fields", [])

        # Build theme list for prompt
        theme_descriptions = []
        if themes:
            for theme in themes:
                if "parent" in theme:
                    theme_descriptions.append(f"  - {theme['name']} (sub-theme of {theme['parent']}): {theme['description']}")
                else:
                    theme_descriptions.append(f"  - {theme['name']}: {theme['description']}")
            themes_section = "Available themes (categorize the request into ONE of these):\n" + "\n".join(theme_descriptions)
        else:
            themes_section = "No themes defined yet. Set theme to null."

        # Build data extraction fields for prompt
        data_field_descriptions = []
        json_fields = {}
        if data_fields:
            for field in data_fields:
                field_desc = f"  - {field['field_name']} ({field['data_type']}): {field['description']}"
                data_field_descriptions.append(field_desc)

                # Build JSON field representation
                if field['data_type'] == 'string':
                    json_fields[field['field_name'].lower().replace(' ', '_')] = "\"extracted value or null\""
                elif field['data_type'] == 'number':
                    json_fields[field['field_name'].lower().replace(' ', '_')] = "number or null"
                elif field['data_type'] == 'boolean':
                    json_fields[field['field_name'].lower().replace(' ', '_')] = "true/false or null"
                elif field['data_type'] == 'date':
                    json_fields[field['field_name'].lower().replace(' ', '_')] = "\"ISO date string or null\""
                elif field['data_type'] == 'array':
                    json_fields[field['field_name'].lower().replace(' ', '_')] = "[\"array\", \"values\"] or null"

            data_fields_section = "Data fields to extract (extract ALL that are mentioned or can be inferred):\n" + "\n".join(data_field_descriptions)
        else:
            data_fields_section = "No data extraction fields defined yet."
            json_fields = {}

        # Build the JSON format string
        json_format_lines = [
            "{",
            "    \"is_feature_request\": boolean,",
            "    \"confidence\": float (0.0 to 1.0),",
            "    \"feature_title\": \"Brief title of the feature request\",",
            "    \"feature_description\": \"Detailed description of what is being requested\","
        ]

        if themes:
            json_format_lines.append("    \"theme\": \"Name of the theme from the available themes list (or null if none match)\",")

        if json_fields:
            json_format_lines.append("    \"extracted_data\": {")
            field_lines = [f"        \"{key}\": {value}" for key, value in json_fields.items()]
            json_format_lines.append(",\n".join(field_lines))
            json_format_lines.append("    },")

        json_format_lines.extend([
            "    \"priority\": \"low/medium/high\",",
            "    \"urgency\": \"low/medium/high\",",
            "    \"business_impact\": \"Description of potential business impact\",",
            "    \"keywords\": [\"array\", \"of\", \"relevant\", \"keywords\"],",
            "    \"sentiment\": \"positive/neutral/negative\",",
            "    \"reasoning\": \"Brief explanation of your analysis\"",
            "}"
        ])

        json_format = "\n".join(json_format_lines)

        return f"""You are an AI assistant specialized in analyzing customer messages to extract feature requests and insights for a product team.

Your task is to analyze each message and determine:
1. Whether it contains a feature request or product feedback
2. Extract key information about the request
3. Categorize the request into user-defined themes
4. Extract specific data fields that the user has configured

{themes_section}

{data_fields_section}

Always respond with valid JSON in this exact format:
{json_format}

IMPORTANT INSTRUCTIONS:
- Only use themes from the provided list. If no theme matches well, set theme to null.
- Extract ALL data fields that are mentioned or can be reasonably inferred from the message.
- For numeric fields (like MRR), extract only the number without currency symbols.
- Be thorough but concise in your analysis.
- If the message is not a feature request, set is_feature_request to false and provide minimal other fields."""
    
    def _create_analysis_prompt(self, message: Message) -> str:
        """
        Create analysis prompt for a specific message
        
        Args:
            message: Message to analyze
            
        Returns:
            Formatted prompt string
        """
        # Extract metadata for context
        metadata = message.message_metadata or {}
        raw_message = metadata.get('raw_message', {})
        
        prompt = f"""Please analyze this customer message for feature requests and insights:

MESSAGE DETAILS:
- Channel: #{message.channel_name}
- Author: {message.author_name or 'Unknown'}
- Date: {message.sent_at}
- Source: {message.source}

MESSAGE CONTENT:
{message.content}

ADDITIONAL CONTEXT:
- Is bot message: {'Yes' if raw_message.get('bot_id') else 'No'}
- Thread context: {'Reply in thread' if message.is_thread_reply else 'Standalone message'}
"""

        # Add any reaction context
        reactions = raw_message.get('reactions', [])
        if reactions:
            prompt += f"- Reactions: {len(reactions)} reactions received\n"
        
        prompt += "\nPlease analyze this message and extract feature request insights in JSON format."
        
        return prompt
    
    def batch_process_messages(self, messages: List[Message], max_messages: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Process multiple messages in batch
        
        Args:
            messages: List of messages to process
            max_messages: Maximum number of messages to process (for rate limiting)
            
        Returns:
            List of analysis results
        """
        if max_messages:
            messages = messages[:max_messages]
        
        results = []
        for message in messages:
            try:
                result = self.process_message(message)
                result['message_id'] = str(message.id)
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to process message {message.id}: {e}")
                results.append({
                    "message_id": str(message.id),
                    "error": str(e),
                    "is_feature_request": False
                })
        
        return results
    
    def get_processing_stats(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate statistics from processing results
        
        Args:
            results: List of processing results
            
        Returns:
            Statistics dictionary
        """
        total_processed = len(results)
        feature_requests = sum(1 for r in results if r.get('is_feature_request', False))
        errors = sum(1 for r in results if 'error' in r)
        
        # Calculate average confidence for feature requests
        confidences = [r.get('confidence', 0) for r in results if r.get('is_feature_request', False)]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        # Count categories, themes, functional areas, and products
        categories = {}
        themes = {}
        functional_areas = {}
        products = {}
        
        for result in results:
            if result.get('is_feature_request', False):
                # Count categories
                category = result.get('category', 'Unknown')
                categories[category] = categories.get(category, 0) + 1
                
                # Count themes
                theme = result.get('theme', 'Unknown')
                themes[theme] = themes.get(theme, 0) + 1
                
                # Count functional areas
                functional_area = result.get('functional_area', 'Unknown')
                functional_areas[functional_area] = functional_areas.get(functional_area, 0) + 1
                
                # Count products
                product = result.get('product', 'Unknown')
                if product and product != 'Unknown':
                    products[product] = products.get(product, 0) + 1
        
        return {
            "total_processed": total_processed,
            "feature_requests_found": feature_requests,
            "feature_request_rate": feature_requests / total_processed if total_processed > 0 else 0,
            "processing_errors": errors,
            "average_confidence": avg_confidence,
            "categories": categories,
            "themes": themes,
            "functional_areas": functional_areas,
            "products": products
        }


# Global service instance  
ai_processing_service = AIProcessingService()
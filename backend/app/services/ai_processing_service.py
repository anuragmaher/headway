import os
import logging
from typing import Dict, Any, Optional, List
from openai import OpenAI
import json

from app.models.message import Message

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
    
    def process_message(self, message: Message) -> Dict[str, Any]:
        """
        Process a single message to extract feature request insights
        
        Args:
            message: Message object to process
            
        Returns:
            Dictionary containing extracted insights
        """
        try:
            logger.info(f"Processing message {message.id} from {message.author_name}")
            
            # Create the analysis prompt
            prompt = self._create_analysis_prompt(message)
            
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt()
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
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for feature request analysis"""
        return """You are an AI assistant specialized in analyzing customer messages to extract feature requests and insights for a product team.

Your task is to analyze each message and determine:
1. Whether it contains a feature request or product feedback
2. Extract key information about the request
3. Categorize and prioritize the request
4. Identify broader themes and patterns

Always respond with valid JSON in this exact format:
{
    "is_feature_request": boolean,
    "confidence": float (0.0 to 1.0),
    "feature_title": "Brief title of the feature request",
    "feature_description": "Detailed description of what is being requested",
    "customer_info": {
        "name": "Customer/company name if mentioned",
        "type": "Customer type (existing, prospect, etc.)",
        "mrr": "Monthly recurring revenue if mentioned (number only, no currency)"
    },
    "product": "Product name mentioned (Gmail, Outlook, WhatsApp, etc.)",
    "theme": "Large overarching theme (User Experience, Performance, Security, Integrations, Mobile, Analytics, Automation, Customization, etc.)",
    "category": "High-level category (Core Features, Integrations, UI/UX, Performance, Security, Mobile, Analytics, Administration)",
    "priority": "low/medium/high",
    "urgency": "low/medium/high",
    "business_impact": "Description of potential business impact",
    "keywords": ["array", "of", "relevant", "keywords"],
    "sentiment": "positive/neutral/negative",
    "reasoning": "Brief explanation of your analysis"
}

Focus on identifying broader themes that can group similar requests together. Use high-level categories that product teams commonly use. Extract MRR as a number if mentioned. Be thorough but concise. If the message is not a feature request, set is_feature_request to false and provide minimal other fields."""
    
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
        
        # Count categories and themes
        categories = {}
        themes = {}
        products = {}
        
        for result in results:
            if result.get('is_feature_request', False):
                # Count categories
                category = result.get('category', 'Unknown')
                categories[category] = categories.get(category, 0) + 1
                
                # Count themes
                theme = result.get('theme', 'Unknown')
                themes[theme] = themes.get(theme, 0) + 1
                
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
            "products": products
        }


# Global service instance  
ai_processing_service = AIProcessingService()
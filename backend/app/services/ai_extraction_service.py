"""
AI-powered feature extraction service using OpenAI

Analyzes customer conversations and extracts:
- Feature requests
- Bug reports
- Pain points
- Sentiment
- Urgency levels
"""

import os
import json
from typing import Dict, List, Any, Optional
from openai import OpenAI
import logging

logger = logging.getLogger(__name__)


class AIExtractionService:
    """Service for extracting features and insights from customer conversations"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the AI extraction service

        Args:
            api_key: OpenAI API key (defaults to env variable)
        """
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY environment variable.")

        self.client = OpenAI(api_key=self.api_key)

    def extract_insights(
        self,
        transcript: str,
        customer_name: Optional[str] = None,
        customer_mrr: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Extract features, bugs, and insights from a conversation transcript

        Args:
            transcript: The conversation transcript text
            customer_name: Optional customer name for context
            customer_mrr: Optional MRR for prioritization context

        Returns:
            Dictionary containing extracted insights
        """
        try:
            # Build context
            context = ""
            if customer_name:
                context += f"Customer: {customer_name}\n"
            if customer_mrr:
                context += f"MRR: ${customer_mrr:,.2f}\n"

            # Create the prompt
            system_prompt = """You are an AI assistant that analyzes customer conversations and extracts actionable insights.

Analyze the conversation and extract:

1. **Feature Requests**: NEW features or capabilities that the customer is requesting to be BUILT
   - ONLY include features that are NOT currently available/supported in the product
   - If the customer asks "do you have X?" and the answer is NO, that's a feature request
   - If the customer asks "can you build X?" or "we need X", that's a feature request
   - DO NOT include features that already exist but the customer doesn't know about
   - DO NOT include questions about existing functionality

2. **Bug Reports**: ACTUAL technical issues, errors, or broken functionality
   - ONLY include things that are genuinely not working as designed
   - Must be reproducible technical problems or errors
   - DO NOT include user confusion about how to use existing features
   - DO NOT include questions like "how do I do X?" unless something is actually broken
   - Look for keywords: "not working", "broken", "error", "bug", "doesn't work", "failing"

3. **Pain Points**: Challenges or frustrations the customer is experiencing with current workflows
   - Can include limitations of existing features
   - Can include workarounds they have to do

4. **Sentiment**: Overall sentiment (positive, neutral, negative)

5. **Urgency**: How urgent their requests are (low, medium, high, critical)

Return ONLY a valid JSON object with this exact structure:
{
  "feature_requests": [
    {
      "title": "Brief title",
      "description": "What they want and why",
      "urgency": "low|medium|high|critical",
      "quote": "Exact quote from transcript"
    }
  ],
  "bug_reports": [
    {
      "title": "Brief title",
      "description": "What's broken",
      "severity": "low|medium|high|critical",
      "quote": "Exact quote from transcript"
    }
  ],
  "pain_points": [
    {
      "description": "What's causing friction",
      "impact": "How it affects them",
      "quote": "Exact quote from transcript"
    }
  ],
  "sentiment": {
    "overall": "positive|neutral|negative",
    "score": 0.0-1.0,
    "reasoning": "Why this sentiment"
  },
  "key_topics": ["topic1", "topic2"],
  "summary": "One paragraph summary of the conversation"
}

IMPORTANT:
- Be specific and actionable
- Extract REAL feature requests (new things to build), not questions about existing features
- Extract REAL bugs (actual technical issues), not user confusion
- When in doubt, leave it out - better to miss something than include false positives"""

            user_prompt = f"""{context}

Conversation Transcript:
{transcript[:8000]}

Extract all feature requests, bug reports, and insights from this conversation."""

            # Call OpenAI API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Fast and cost-effective
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # Lower temperature for more consistent extraction
                response_format={"type": "json_object"}  # Force JSON response
            )

            # Parse the response
            result = json.loads(response.choices[0].message.content)

            # Add metadata
            result['extraction_metadata'] = {
                'model': 'gpt-4o-mini',
                'tokens_used': response.usage.total_tokens,
                'customer_name': customer_name,
                'customer_mrr': customer_mrr
            }

            logger.info(f"Successfully extracted insights. Found {len(result.get('feature_requests', []))} features, {len(result.get('bug_reports', []))} bugs")

            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
            return self._empty_result(f"JSON parsing error: {str(e)}")

        except Exception as e:
            logger.error(f"Error extracting insights: {e}")
            return self._empty_result(f"Extraction error: {str(e)}")

    def extract_features_only(self, transcript: str) -> List[Dict[str, Any]]:
        """
        Quick extraction of just feature requests

        Args:
            transcript: The conversation transcript

        Returns:
            List of feature request dictionaries
        """
        insights = self.extract_insights(transcript)
        return insights.get('feature_requests', [])

    def extract_bugs_only(self, transcript: str) -> List[Dict[str, Any]]:
        """
        Quick extraction of just bug reports

        Args:
            transcript: The conversation transcript

        Returns:
            List of bug report dictionaries
        """
        insights = self.extract_insights(transcript)
        return insights.get('bug_reports', [])

    def _empty_result(self, error: str = None) -> Dict[str, Any]:
        """Return empty result structure"""
        return {
            'feature_requests': [],
            'bug_reports': [],
            'pain_points': [],
            'sentiment': {
                'overall': 'neutral',
                'score': 0.5,
                'reasoning': 'Could not analyze'
            },
            'key_topics': [],
            'summary': 'Analysis failed' if error else 'No insights extracted',
            'error': error
        }


# Singleton instance
_ai_service = None


def get_ai_extraction_service() -> AIExtractionService:
    """Get or create the AI extraction service singleton"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIExtractionService()
    return _ai_service

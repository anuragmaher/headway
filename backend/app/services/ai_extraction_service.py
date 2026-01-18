"""
AI-powered feature extraction service using OpenAI

Analyzes customer conversations and extracts:
- Feature requests
- Bug reports
- Pain points
- Sentiment
- Urgency levels
"""

import json
from typing import Dict, List, Any, Optional
from openai import OpenAI
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIExtractionService:
    """Service for extracting features and insights from customer conversations"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the AI extraction service

        Args:
            api_key: OpenAI API key (defaults to settings)
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY in .env file.")

        self.client = OpenAI(api_key=self.api_key)

    def extract_insights(
        self,
        transcript: str,
        customer_name: Optional[str] = None,
        customer_mrr: Optional[float] = None,
        themes: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Extract features, bugs, and insights from a conversation transcript

        Args:
            transcript: The conversation transcript text
            customer_name: Optional customer name for context
            customer_mrr: Optional MRR for prioritization context
            themes: Optional list of themes to guide feature extraction (only extract features that align with these themes)

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

            # Build themes context
            themes_context = ""
            if themes and len(themes) > 0:
                themes_context = "\n\n**IMPORTANT - Product Themes Context:**\nOur product focuses on these specific themes. ONLY extract feature requests that align with these themes:\n\n"
                for theme in themes:
                    themes_context += f"- **{theme['name']}**: {theme['description']}\n"
                themes_context += "\nDO NOT extract feature requests that fall outside these themes. If a request doesn't fit any theme, skip it.\n"

            # Create the prompt
            system_prompt = f"""You are an AI assistant that analyzes customer conversations and extracts actionable insights.
{themes_context}
Analyze the conversation and extract:

1. **Feature Requests**: NEW features or capabilities that the customer is requesting to be BUILT
   - ONLY include features that are NOT currently available/supported in the product
   - If the customer asks "do you have X?" and the answer is NO, that's a feature request
   - If the customer asks "can you build X?" or "we need X", that's a feature request
   - DO NOT include features that already exist but the customer doesn't know about
   - DO NOT include questions about existing functionality
   - DO NOT include ANY mention of pricing, billing, licensing, contracts, costs, budgets, or financial terms
   - DO NOT include requests for information, documentation, training, demos, or knowledge base content about existing features
   - DO NOT include administrative, sales, or support-related inquiries (e.g., "Can you send me pricing?", "What does X cost?", "When will X be available?", "Can I get a demo?")
   - DO NOT include feature requests about data extraction or information retrieval (these are often disguised pricing/sales inquiries)
   - CRITICAL: If someone mentions pricing OR information retrieval OR demos in relation to a feature, it's NOT a feature request
   - DISTINGUISH: "Can you build X?" (feature request) vs "Can you tell me about X?", "How much does X cost?", "When will X ship?", "Can you demo X?" (NOT feature requests)
   {"- CRITICAL: Feature requests MUST align with one of the product themes listed above" if themes else ""}

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
{{
  "feature_requests": [
    {{
      "title": "Brief title",
      "description": "What they want and why",
      "urgency": "low|medium|high|critical",
      "quote": "Exact quote from transcript",
      "theme": "{f'MUST be one of: {", ".join([t["name"] for t in themes])} (use EXACT name, no variations)' if themes else 'null'}"
    }}
  ],
  "bug_reports": [
    {{
      "title": "Brief title",
      "description": "What's broken",
      "severity": "low|medium|high|critical",
      "quote": "Exact quote from transcript"
    }}
  ],
  "pain_points": [
    {{
      "description": "What's causing friction",
      "impact": "How it affects them",
      "quote": "Exact quote from transcript"
    }}
  ],
  "sentiment": {{
    "overall": "positive|neutral|negative",
    "score": 0.0-1.0,
    "reasoning": "Why this sentiment"
  }},
  "key_topics": ["topic1", "topic2"],
  "summary": "One paragraph summary of the conversation"
}}

IMPORTANT:
- Be specific and actionable
- Extract REAL feature requests (new things to build), not questions about existing features
- Extract REAL bugs (actual technical issues), not user confusion
- When in doubt, leave it out - better to miss something than include false positives
{"- CRITICAL: For 'theme' field, you MUST use ONLY these EXACT theme names (copy-paste, no variations): " + ", ".join([f'"{t["name"]}"' for t in themes]) if themes else ""}
{"- If a feature doesn't clearly fit any theme, choose the closest match - DO NOT invent new theme names" if themes else ""}
{"- Theme names must match EXACTLY - 'AI Features' is correct, 'AI' or 'AI Capabilities' is WRONG" if themes else ""}"""

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

    def check_theme_relevance(
        self,
        transcript: str,
        themes: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Check if a transcript is relevant to any of the workspace themes

        Args:
            transcript: The conversation transcript text
            themes: List of themes to check against

        Returns:
            Dictionary with 'is_relevant' (bool) and 'confidence' (float 0-1)
        """
        try:
            if not themes or len(themes) == 0:
                # No themes defined, so technically relevant to everything
                return {
                    'is_relevant': True,
                    'confidence': 1.0,
                    'matched_themes': [],
                    'reasoning': 'No specific themes to filter by'
                }

            # Build themes list for the prompt
            themes_text = "\n".join([f"- **{t['name']}**: {t['description']}" for t in themes])

            system_prompt = """You are an AI assistant that analyzes customer conversations to determine if they are relevant to specific product themes.

Analyze the conversation and determine:
1. If the customer is discussing topics related to ANY of the provided themes
2. Which specific themes (if any) are being discussed
3. Your confidence that this conversation is relevant to the product

Return a JSON response with:
- is_relevant: boolean - true if conversation discusses ANY of the themes
- confidence: float between 0 and 1 - how confident you are this is relevant
- matched_themes: list of theme names that are discussed
- reasoning: brief explanation of your assessment"""

            user_prompt = f"""Here are the product themes:

{themes_text}

Now analyze this conversation and determine if it's relevant to any of these themes:

---
{transcript[:3000]}  # Limit to first 3000 chars for speed
---

Respond in JSON format with the structure described above."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            logger.info(
                f"Theme relevance check: is_relevant={result.get('is_relevant')}, "
                f"confidence={result.get('confidence')}, "
                f"matched_themes={result.get('matched_themes')}"
            )

            return result

        except Exception as e:
            logger.error(f"Error checking theme relevance: {e}")
            return {
                'is_relevant': True,  # Default to True to not filter out by accident
                'confidence': 0.5,
                'matched_themes': [],
                'reasoning': f'Error checking relevance: {str(e)}'
            }

    def extract_customer_context(
        self,
        messages: List[Dict[str, Any]],
        customer_name: str,
        existing_industry: Optional[str] = None,
        existing_use_cases: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract customer context from all their messages

        Analyzes conversation history to understand:
        - Customer's industry (if not already known)
        - How they use the product (use cases)
        - Key pain points they're experiencing

        Args:
            messages: List of message dictionaries with 'content' and 'sent_at'
            customer_name: Name of the customer
            existing_industry: Current industry value (if any)
            existing_use_cases: Current use cases value (if any)

        Returns:
            Dictionary with extracted context
        """
        try:
            if not messages or len(messages) == 0:
                return self._empty_customer_context()

            # Combine all message content (limit to most recent for performance)
            recent_messages = sorted(messages, key=lambda m: m.get('sent_at', ''), reverse=True)[:20]
            combined_text = "\n\n---\n\n".join([
                f"[{msg.get('sent_at', 'unknown')}]\n{msg.get('content', '')}"
                for msg in recent_messages
                if msg.get('content')
            ])

            if not combined_text.strip():
                return self._empty_customer_context()

            # Build system prompt
            system_prompt = """You are an AI assistant that analyzes customer conversations to understand their business context and challenges.

Analyze all the conversations from this customer and extract:

1. **Industry**: What industry or business sector is this customer in?
   - Be specific (e.g., "Healthcare", "E-commerce", "Financial Services", "SaaS")
   - Look for context clues about their business domain
   - Only extract if there's clear evidence

2. **Use Cases**: Provide a comprehensive description of how this customer uses the product
   FORMAT: Return as a bulleted list (3-5 bullet points), each bullet as a complete sentence
   - What are their primary workflows and day-to-day activities?
   - What specific problems or business challenges are they solving?
   - What features or capabilities do they rely on most heavily?
   - Who are the main users/teams using the product?
   - What are their key goals and objectives with the product?
   - Include specific examples and context from the conversations
   - Be detailed and paint a complete picture of their usage patterns

   Example format:
   "• They use the product for X workflow to achieve Y goal.
   • Their team relies heavily on Z feature for ABC purpose.
   • The main business challenge they're solving is DEF."

3. **Pain Points**: What challenges or frustrations are they experiencing?
   - Current limitations they're hitting
   - Workarounds they have to do
   - Features they wish existed
   - Problems with their workflows
   - Extract 3-5 most significant pain points

Return a JSON object with this structure:
{
  "industry": "Industry name or null if unclear",
  "industry_confidence": 0.0-1.0,
  "use_cases": "Detailed description of how they use the product",
  "pain_points": [
    {
      "description": "Brief pain point description",
      "impact": "How it affects their workflow",
      "severity": "low|medium|high",
      "quote": "Supporting quote from conversation"
    }
  ],
  "key_insights": ["insight1", "insight2"],
  "reasoning": "Brief explanation of how you determined these"
}

IMPORTANT:
- Be specific and evidence-based
- Only include what you can clearly infer from the conversations
- If industry is unclear, set to null
- Focus on actionable insights"""

            # Build context
            context = f"Customer: {customer_name}\n"
            if existing_industry:
                context += f"Current industry record: {existing_industry}\n"
            if existing_use_cases:
                context += f"Current use cases record: {existing_use_cases}\n"

            user_prompt = f"""{context}

Conversation History (most recent first):
{combined_text[:6000]}

Extract the customer context based on these conversations."""

            # Call OpenAI API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            # Parse the response
            result = json.loads(response.choices[0].message.content)

            logger.info(
                f"Extracted customer context for {customer_name}: "
                f"industry={result.get('industry')}, "
                f"{len(result.get('pain_points', []))} pain points"
            )

            return result

        except Exception as e:
            logger.error(f"Error extracting customer context: {e}")
            return self._empty_customer_context(f"Extraction error: {str(e)}")

    def _empty_customer_context(self, error: str = None) -> Dict[str, Any]:
        """Return empty customer context structure"""
        return {
            'industry': None,
            'industry_confidence': 0.0,
            'use_cases': None,
            'pain_points': [],
            'key_insights': [],
            'reasoning': 'Could not analyze' if error else 'No data available',
            'error': error
        }

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

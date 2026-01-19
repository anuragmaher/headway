"""
AI Insights Service - Centralized AI extraction for all message sources

This service provides:
- Unified AI insights extraction for Gmail, Slack, Gong, Fathom
- Theme classification with confidence scoring
- Feature request, pain point, and sentiment extraction
- Batch processing support for efficiency

Architecture:
- Uses OpenAI GPT-4o-mini for cost-effective extraction
- Supports workspace themes for context-aware extraction
- Returns structured insights stored in ai_insights JSONB column
"""

import json
import hashlib
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone
from uuid import UUID

from openai import OpenAI
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.theme import Theme

logger = logging.getLogger(__name__)


class AIInsightsService:
    """
    Centralized service for extracting AI insights from messages.

    This service handles:
    1. Theme relevance classification
    2. Feature request extraction
    3. Pain point identification
    4. Sentiment analysis
    5. Classified themes with confidence scores
    """

    # Processing thresholds
    MIN_CONTENT_LENGTH = 50  # Minimum characters to process
    MAX_CONTENT_LENGTH = 8000  # Max characters sent to AI
    RELEVANCE_THRESHOLD = 0.4  # Minimum confidence to extract

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the AI Insights Service."""
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY in environment.")

        self.client = OpenAI(api_key=self.api_key)
        self._themes_cache: Dict[str, Tuple[List[Dict], datetime]] = {}
        self._cache_ttl_seconds = 300  # 5 minutes

    def get_workspace_themes(
        self,
        db: Session,
        workspace_id: UUID,
        use_cache: bool = True
    ) -> List[Dict[str, str]]:
        """
        Get themes for a workspace with caching.

        Args:
            db: Database session
            workspace_id: Workspace UUID
            use_cache: Whether to use cached themes

        Returns:
            List of theme dictionaries with 'id', 'name', 'description'
        """
        cache_key = str(workspace_id)
        now = datetime.now(timezone.utc)

        # Check cache
        if use_cache and cache_key in self._themes_cache:
            themes, cached_at = self._themes_cache[cache_key]
            if (now - cached_at).total_seconds() < self._cache_ttl_seconds:
                return themes

        # Fetch from database
        db_themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).all()

        themes = [
            {
                'id': str(theme.id),
                'name': theme.name,
                'description': theme.description or ''
            }
            for theme in db_themes
        ]

        # Update cache
        self._themes_cache[cache_key] = (themes, now)

        return themes

    def clear_themes_cache(self, workspace_id: Optional[UUID] = None) -> None:
        """Clear themes cache for a workspace or all workspaces."""
        if workspace_id:
            self._themes_cache.pop(str(workspace_id), None)
        else:
            self._themes_cache.clear()

    def should_process(self, content: str) -> Tuple[bool, str]:
        """
        Check if content should be processed for AI insights.

        Args:
            content: The message content

        Returns:
            Tuple of (should_process, reason)
        """
        if not content:
            return False, "empty_content"

        cleaned = content.strip()
        if len(cleaned) < self.MIN_CONTENT_LENGTH:
            return False, "content_too_short"

        # Check for low-value content patterns
        low_value_patterns = [
            'out of office',
            'automatic reply',
            'unsubscribe',
            'this email was sent',
            'do not reply',
            'no-reply',
        ]

        content_lower = cleaned.lower()
        for pattern in low_value_patterns:
            if pattern in content_lower:
                return False, f"low_value_pattern:{pattern}"

        return True, "ok"

    def extract_insights(
        self,
        content: str,
        source_type: str,
        themes: Optional[List[Dict[str, str]]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Extract comprehensive AI insights from content.

        Args:
            content: The message/transcript content
            source_type: Source type (gmail, slack, gong, fathom)
            themes: Optional list of workspace themes
            metadata: Optional metadata (customer_name, sender, etc.)

        Returns:
            Dictionary containing all extracted insights
        """
        try:
            # Validate content
            should_process, reason = self.should_process(content)
            if not should_process:
                logger.debug(f"Skipping AI extraction: {reason}")
                return self._empty_insights(skip_reason=reason)

            # Truncate content if needed
            processed_content = content[:self.MAX_CONTENT_LENGTH]

            # Build the extraction prompt
            system_prompt = self._build_system_prompt(source_type, themes)
            user_prompt = self._build_user_prompt(processed_content, metadata)

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

            # Parse response
            result = json.loads(response.choices[0].message.content)

            # Add metadata
            result['extraction_metadata'] = {
                'model': 'gpt-4o-mini',
                'tokens_used': response.usage.total_tokens,
                'source_type': source_type,
                'extracted_at': datetime.now(timezone.utc).isoformat(),
                'content_length': len(content),
                'themes_provided': len(themes) if themes else 0
            }

            # Process classified themes
            if themes and result.get('classified_themes'):
                result['classified_themes'] = self._enrich_classified_themes(
                    result['classified_themes'],
                    themes
                )

            logger.info(
                f"AI extraction complete: "
                f"features={len(result.get('feature_requests', []))}, "
                f"pain_points={len(result.get('pain_points', []))}, "
                f"themes={len(result.get('classified_themes', []))}"
            )

            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            return self._empty_insights(error=f"JSON parsing error: {str(e)}")

        except Exception as e:
            logger.error(f"Error extracting AI insights: {e}")
            return self._empty_insights(error=str(e))

    def classify_themes_only(
        self,
        content: str,
        themes: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Quick theme classification without full extraction.

        Useful for:
        - Quick filtering before full extraction
        - Batch classification of many messages

        Args:
            content: Message content
            themes: List of workspace themes

        Returns:
            Dictionary with classified_themes and confidence
        """
        try:
            if not themes:
                return {
                    'classified_themes': [],
                    'is_relevant': True,
                    'confidence': 1.0,
                    'reasoning': 'No themes to classify against'
                }

            should_process, reason = self.should_process(content)
            if not should_process:
                return {
                    'classified_themes': [],
                    'is_relevant': False,
                    'confidence': 0.0,
                    'reasoning': reason
                }

            themes_text = "\n".join([
                f"- **{t['name']}**: {t['description']}"
                for t in themes
            ])

            system_prompt = """You are an AI that classifies messages into product themes.

Analyze the message and determine which themes it relates to.

Return a JSON object:
{
  "classified_themes": [
    {
      "name": "exact theme name",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ],
  "is_relevant": true/false,
  "overall_confidence": 0.0-1.0,
  "summary": "one sentence summary of what this message is about"
}

Rules:
- Only include themes with confidence > 0.5
- Use EXACT theme names from the provided list
- A message can match multiple themes
- is_relevant should be true if ANY theme matches with confidence > 0.5"""

            user_prompt = f"""Available themes:
{themes_text}

Message to classify:
{content[:3000]}

Classify this message."""

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

            # Enrich with theme IDs
            if result.get('classified_themes'):
                result['classified_themes'] = self._enrich_classified_themes(
                    result['classified_themes'],
                    themes
                )

            return result

        except Exception as e:
            logger.error(f"Error classifying themes: {e}")
            return {
                'classified_themes': [],
                'is_relevant': True,  # Default to true to avoid filtering
                'confidence': 0.5,
                'reasoning': f'Classification error: {str(e)}'
            }

    def extract_batch(
        self,
        items: List[Dict[str, Any]],
        themes: Optional[List[Dict[str, str]]] = None,
        classify_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Process multiple items for AI insights.

        Args:
            items: List of dicts with 'id', 'content', 'source_type', 'metadata'
            themes: Optional workspace themes
            classify_only: If True, only classify themes (faster)

        Returns:
            List of results with 'id' and 'insights' for each item
        """
        results = []

        for item in items:
            try:
                item_id = item.get('id')
                content = item.get('content', '')
                source_type = item.get('source_type', 'unknown')
                metadata = item.get('metadata')

                if classify_only:
                    insights = self.classify_themes_only(content, themes or [])
                else:
                    insights = self.extract_insights(
                        content=content,
                        source_type=source_type,
                        themes=themes,
                        metadata=metadata
                    )

                results.append({
                    'id': item_id,
                    'insights': insights,
                    'success': 'error' not in insights
                })

            except Exception as e:
                logger.error(f"Error processing item {item.get('id')}: {e}")
                results.append({
                    'id': item.get('id'),
                    'insights': self._empty_insights(error=str(e)),
                    'success': False
                })

        return results

    def _build_system_prompt(
        self,
        source_type: str,
        themes: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Build the system prompt for AI extraction."""

        # Source-specific context
        source_context = {
            'gmail': "This is an email conversation. Look for feature requests, feedback, and issues mentioned in the email thread.",
            'slack': "This is a Slack message or thread. Look for feature discussions, bug reports, and user feedback.",
            'gong': "This is a sales/customer call transcript from Gong. Look for feature requests, pain points, and customer needs mentioned during the call.",
            'fathom': "This is a meeting transcript from Fathom. Look for action items, feature requests, and discussed improvements."
        }.get(source_type, "This is a customer communication.")

        # Themes context
        themes_context = ""
        if themes:
            themes_list = "\n".join([
                f"- **{t['name']}**: {t['description']}"
                for t in themes
            ])
            themes_context = f"""

**PRODUCT THEMES:**
Classify content against these themes. Use EXACT theme names.
{themes_list}
"""

        return f"""You are an AI assistant that extracts actionable insights from customer communications.

{source_context}
{themes_context}

Extract and return a JSON object with:

{{
  "classified_themes": [
    {{
      "name": "exact theme name from list",
      "confidence": 0.0-1.0,
      "reasoning": "why this theme matches"
    }}
  ],
  "feature_requests": [
    {{
      "title": "brief title (5-10 words)",
      "description": "what they want and why",
      "urgency": "low|medium|high|critical",
      "quote": "exact supporting quote"
    }}
  ],
  "pain_points": [
    {{
      "description": "the problem or frustration",
      "impact": "how it affects them",
      "severity": "low|medium|high",
      "quote": "supporting quote"
    }}
  ],
  "sentiment": {{
    "overall": "positive|neutral|negative",
    "score": 0.0-1.0,
    "reasoning": "brief explanation"
  }},
  "summary": "2-3 sentence summary of the key points",
  "key_topics": ["topic1", "topic2", "topic3"],
  "classification_reasoning": "explain why you classified this way"
}}

IMPORTANT RULES:
1. Feature requests must be NEW capabilities, not questions about existing features
2. Do NOT include pricing, billing, or sales inquiries as feature requests
3. Pain points should be actual frustrations, not simple questions
4. Only include themes with confidence > 0.5
5. Be specific and actionable - vague insights are not useful
6. If nothing actionable found, return empty arrays (that's okay)
7. classification_reasoning should explain WHY you made these classifications
8. CRITICAL: Extract AT MOST ONE feature request and AT MOST ONE pain point
   - If multiple feature requests exist, pick the MOST important/urgent one
   - If multiple pain points exist, pick the MOST severe/impactful one
   - Combine related items into a single comprehensive entry if needed"""

    def _build_user_prompt(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Build the user prompt with content and metadata."""

        context_parts = []

        if metadata:
            if metadata.get('sender'):
                context_parts.append(f"From: {metadata['sender']}")
            if metadata.get('customer_name'):
                context_parts.append(f"Customer: {metadata['customer_name']}")
            if metadata.get('subject'):
                context_parts.append(f"Subject: {metadata['subject']}")
            if metadata.get('channel'):
                context_parts.append(f"Channel: {metadata['channel']}")

        context = "\n".join(context_parts)

        return f"""{context}

Content:
---
{content}
---

Extract all insights from this content."""

    def _enrich_classified_themes(
        self,
        classified_themes: List[Dict],
        workspace_themes: List[Dict[str, str]]
    ) -> List[Dict]:
        """Add theme IDs to classified themes."""

        theme_id_map = {
            t['name'].lower(): t['id']
            for t in workspace_themes
        }

        enriched = []
        for theme in classified_themes:
            theme_name = theme.get('name', '')
            theme_id = theme_id_map.get(theme_name.lower())

            enriched.append({
                **theme,
                'theme_id': theme_id
            })

        return enriched

    def _empty_insights(
        self,
        skip_reason: Optional[str] = None,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Return empty insights structure."""
        return {
            'classified_themes': [],
            'feature_requests': [],
            'pain_points': [],
            'sentiment': {
                'overall': 'neutral',
                'score': 0.5,
                'reasoning': 'No analysis performed'
            },
            'summary': None,
            'key_topics': [],
            'classification_reasoning': None,
            'extraction_metadata': {
                'skipped': True,
                'skip_reason': skip_reason,
                'error': error,
                'extracted_at': datetime.now(timezone.utc).isoformat()
            }
        }

    def compute_content_hash(self, content: str) -> str:
        """Compute a hash for content deduplication."""
        normalized = ' '.join(content.lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]


# Singleton instance
_ai_insights_service: Optional[AIInsightsService] = None


def get_ai_insights_service() -> AIInsightsService:
    """Get or create the AI Insights Service singleton."""
    global _ai_insights_service
    if _ai_insights_service is None:
        _ai_insights_service = AIInsightsService()
    return _ai_insights_service

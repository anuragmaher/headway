"""
AI Insights Service for per-message analysis.

Generates AI insights for individual messages including:
- Theme classification (from existing system themes ONLY)
- Summary generation
- Pain point extraction
- Feature request extraction
- Explanation of why themes apply

Key constraints:
- Temperature = 0 for deterministic output
- Strict JSON output
- AI NEVER invents, renames, or redefines themes
- AI only selects from themes provided in prompt
- Locked themes from feature pipeline cannot be overridden

Uses Langfuse for prompt management (ai_insights_prompt).
"""

import json
import logging
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

from openai import OpenAI
from openai import RateLimitError, APITimeoutError, APIConnectionError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.core.config import settings
from app.services.langfuse_prompt_service import get_ai_insights_chat_prompt

logger = logging.getLogger(__name__)


@dataclass
class AIInsightsResult:
    """Result from AI insights generation."""
    themes: List[Dict[str, Any]] = field(default_factory=list)  # [{theme_id, theme_name, confidence, explanation}]
    summary: Optional[str] = None
    pain_point: Optional[str] = None  # Description of the pain point
    pain_point_quote: Optional[str] = None  # EXACT verbatim quote from customer
    feature_request: Optional[str] = None  # The specific feature being requested
    customer_usecase: Optional[str] = None  # What the customer is trying to accomplish
    explanation: Optional[str] = None
    sentiment: Optional[str] = None  # positive, negative, neutral
    urgency: Optional[str] = None  # low, medium, high, critical
    keywords: List[str] = field(default_factory=list)
    tokens_used: int = 0
    latency_ms: float = 0.0
    model: str = ""
    prompt_version: str = "langfuse"
    error: Optional[str] = None


# Retry decorator for OpenAI API calls
def with_retry(func):
    """Decorator for retry logic with exponential backoff."""
    return retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((RateLimitError, APITimeoutError, APIConnectionError)),
        before_sleep=lambda retry_state: logger.warning(
            f"Retrying {func.__name__} after {retry_state.outcome.exception()}, "
            f"attempt {retry_state.attempt_number}"
        )
    )(func)


class AIInsightsService:
    """
    Service for generating AI insights for individual messages.

    Features:
    - Single-message granularity (no batching)
    - Temperature = 0 for deterministic output
    - Strict JSON output
    - Theme constraints enforced
    - Retry logic with exponential backoff
    - Langfuse-managed prompts (ai_insights_prompt)
    """

    DEFAULT_MODEL = "gpt-4o-mini"
    REQUEST_TIMEOUT = 60  # seconds

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the AI insights service.

        Args:
            api_key: OpenAI API key (defaults to settings)
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY in .env file.")

        self.client = OpenAI(
            api_key=self.api_key,
            timeout=self.REQUEST_TIMEOUT,
            max_retries=0,  # We handle retries ourselves
        )

    def _format_themes_text(self, themes: List[Dict]) -> str:
        """Format available themes for prompt."""
        if not themes:
            return "AVAILABLE THEMES: None (return empty themes array)"

        text = "AVAILABLE THEMES (you may ONLY select from these):\n"
        for theme in themes:
            text += f"- ID: {theme['id']}, Name: \"{theme['name']}\""
            if theme.get('description'):
                text += f", Description: {theme['description']}"
            text += "\n"
        return text

    def _format_locked_theme(self, locked_theme: Optional[Dict]) -> str:
        """Format locked theme for prompt."""
        if not locked_theme:
            return ""
        return f"""
LOCKED THEME (MUST be included in your response):
- ID: {locked_theme['id']}
- Name: "{locked_theme['name']}"
This theme was assigned by the feature extraction pipeline and is canonical.
You must include this theme and explain why it applies.
"""

    def _format_customer_asks(self, customer_asks: Optional[List[Dict]]) -> str:
        """Format linked customer asks for prompt."""
        if not customer_asks:
            return ""
        text = """
LINKED CUSTOMER ASKS (extracted feature requests from this message):
"""
        for i, ca in enumerate(customer_asks, 1):
            desc = ca.get('description', 'No description') or 'No description'
            text += f"""
{i}. "{ca.get('name', 'Unnamed')}"
   Description: {desc[:200]}
   Urgency: {ca.get('urgency', 'medium')}
"""
        text += """
IMPORTANT: Your feature_request field should summarize these customer asks.
If multiple asks exist, combine them into a coherent summary.
"""
        return text

    @with_retry
    def generate_insights(
        self,
        message_content: str,
        available_themes: List[Dict[str, Any]],
        message_title: Optional[str] = None,
        source_type: str = "unknown",
        author_name: Optional[str] = None,
        author_role: Optional[str] = None,
        locked_theme: Optional[Dict[str, Any]] = None,
        linked_customer_asks: Optional[List[Dict[str, Any]]] = None,
    ) -> AIInsightsResult:
        """
        Generate AI insights for a single message using Langfuse prompts.

        Args:
            message_content: The message text to analyze
            available_themes: List of themes the AI can select from
            message_title: Optional title/subject
            source_type: Source type (slack, gmail, gong, fathom)
            author_name: Name of message author
            author_role: Role of author
            locked_theme: Theme already assigned by feature pipeline
            linked_customer_asks: CustomerAsks linked to this message from Tier 2 extraction

        Returns:
            AIInsightsResult with all extracted insights
        """
        start_time = time.time()

        try:
            # Format context for prompt variables
            themes_text = self._format_themes_text(available_themes)
            locked_theme_text = self._format_locked_theme(locked_theme)
            customer_asks_text = self._format_customer_asks(linked_customer_asks)

            # Get chat prompt from Langfuse
            messages = get_ai_insights_chat_prompt(
                message_content=message_content[:4000],
                message_title=message_title or "No title",
                source_type=source_type,
                author_name=author_name or "Unknown",
                author_role=author_role or "Unknown",
                themes_text=themes_text,
                locked_theme_text=locked_theme_text,
                customer_asks_text=customer_asks_text,
            )

            response = self.client.chat.completions.create(
                model=self.DEFAULT_MODEL,
                messages=messages,  # Directly use Langfuse messages
                temperature=0,  # Deterministic output
                response_format={"type": "json_object"},
                max_tokens=1500
            )

            latency_ms = (time.time() - start_time) * 1000
            result = json.loads(response.choices[0].message.content)

            # Validate themes are from allowed list
            validated_themes = self._validate_themes(
                result.get("themes", []),
                available_themes,
                locked_theme
            )

            # Ensure required fields have values (fallback if AI returns null)
            summary = result.get("summary") or "Customer feedback message"
            pain_point = result.get("pain_point") or "Not explicitly stated"
            pain_point_quote = result.get("pain_point_quote") or message_content[:200] if message_content else "No quote available"
            feature_request = result.get("feature_request") or "General feedback - no specific feature request"
            customer_usecase = result.get("customer_usecase") or "General product usage"
            sentiment = result.get("sentiment") or "neutral"
            keywords = result.get("keywords") or []
            if not keywords:
                # Extract basic keywords from title/content as fallback
                keywords = [word.strip().lower() for word in (message_title or "").split()[:5] if len(word) > 3]

            return AIInsightsResult(
                themes=validated_themes,
                summary=summary,
                pain_point=pain_point,
                pain_point_quote=pain_point_quote,
                feature_request=feature_request,
                customer_usecase=customer_usecase,
                explanation=result.get("explanation"),
                sentiment=sentiment,
                urgency=result.get("urgency"),
                keywords=keywords,
                tokens_used=response.usage.total_tokens,
                latency_ms=latency_ms,
                model=self.DEFAULT_MODEL,
                prompt_version="langfuse",
            )

        except json.JSONDecodeError as e:
            logger.error(f"AI Insights JSON decode error: {e}")
            return AIInsightsResult(
                error=f"JSON decode error: {str(e)}",
                latency_ms=(time.time() - start_time) * 1000,
                model=self.DEFAULT_MODEL,
                prompt_version="langfuse",
            )

        except Exception as e:
            logger.error(f"AI Insights generation error: {e}")
            return AIInsightsResult(
                error=f"Generation error: {str(e)}",
                latency_ms=(time.time() - start_time) * 1000,
                model=self.DEFAULT_MODEL,
                prompt_version="langfuse",
            )

    def _validate_themes(
        self,
        ai_themes: List[Dict[str, Any]],
        available_themes: List[Dict[str, Any]],
        locked_theme: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Validate that AI-selected themes are from the allowed list.

        Args:
            ai_themes: Themes returned by AI
            available_themes: Allowed themes
            locked_theme: Locked theme that must be included

        Returns:
            Validated list of themes
        """
        # Create lookup for available themes
        available_ids = {str(t['id']) for t in available_themes}
        available_names = {t['name'].lower() for t in available_themes}

        validated = []

        # Process AI-selected themes
        for theme in ai_themes:
            theme_id = str(theme.get('theme_id', ''))
            theme_name = theme.get('theme_name', '')

            # Check if theme is valid
            if theme_id in available_ids or theme_name.lower() in available_names:
                validated.append(theme)
            else:
                logger.warning(f"AI selected invalid theme: {theme_name} ({theme_id})")

        # Ensure locked theme is included
        if locked_theme:
            locked_id = str(locked_theme['id'])
            if not any(str(t.get('theme_id', '')) == locked_id for t in validated):
                validated.insert(0, {
                    'theme_id': locked_id,
                    'theme_name': locked_theme['name'],
                    'confidence': 1.0,
                    'explanation': 'Locked theme from feature extraction pipeline'
                })

        return validated


# Singleton instance
_ai_insights_service: Optional[AIInsightsService] = None


def get_ai_insights_service() -> AIInsightsService:
    """Get or create the AI insights service singleton."""
    global _ai_insights_service
    if _ai_insights_service is None:
        _ai_insights_service = AIInsightsService()
    return _ai_insights_service

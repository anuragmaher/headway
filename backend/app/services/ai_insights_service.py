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

logger = logging.getLogger(__name__)

# Prompt version for tracking - bump when prompts change
AI_INSIGHTS_PROMPT_VERSION = "v1.4.0"  # Made all core fields REQUIRED (not optional)


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
    prompt_version: str = AI_INSIGHTS_PROMPT_VERSION
    error: Optional[str] = None


# System prompt for AI insights generation
AI_INSIGHTS_SYSTEM_PROMPT = """You are an AI assistant analyzing customer feedback messages for a product intelligence platform.

Your task is to analyze a single message and extract structured insights.

CRITICAL RULES FOR THEME CLASSIFICATION:
1. You may ONLY select themes from the provided theme list - NEVER invent new themes
2. You may ONLY use theme IDs and names exactly as provided
3. A theme should ONLY be selected if the message contains:
   - A DIRECT and EXPLICIT request, feedback, or discussion about that theme's subject matter
   - SPECIFIC mentions of features, capabilities, or problems related to that theme
   - NOT just casual mentions or tangential references to theme-related words
4. If no theme fits DIRECTLY and CLEARLY, return an empty themes array - this is preferred over incorrect classification
5. If a "locked_theme" is provided, you MUST include it in your response and explain why it applies
6. Be CONSERVATIVE with theme assignment - only assign if confidence is 0.7 or higher
7. Consider the MAIN PURPOSE and INTENT of the message, not just keyword matches

THEME MATCHING CRITERIA - BE STRICT:
- The message must contain ACTIONABLE feedback or requests DIRECTLY related to the theme
- Casual conversation that merely mentions a topic is NOT enough for theme assignment
- Look for explicit feature requests, bug reports, pain points, or product suggestions
- If someone discusses a general topic (like "AI" or "integrations") WITHOUT requesting/suggesting anything specific about YOUR PRODUCT's capabilities in that area, do NOT classify under that theme
- Example: A call transcript discussing "AI in the industry" is NOT about "AI Features" theme unless they specifically request AI features for YOUR product

=== REQUIRED FIELDS - YOU MUST ALWAYS PROVIDE THESE (NEVER null) ===

FEATURE REQUEST (REQUIRED):
- You MUST always extract a feature_request from the message
- Even if indirect, identify what the customer is asking for or would benefit from
- If truly nothing, use "General feedback - no specific feature request"

SUMMARY (REQUIRED):
- You MUST always provide a 1-2 sentence summary
- Focus on the customer's main point, request, or feedback

PAIN POINT (REQUIRED):
- You MUST always describe what the customer is struggling with
- If no explicit pain point, infer from context what problem they're trying to solve
- Be specific: "Manual data export is time-consuming" not "Has some issues"

PAIN POINT QUOTE (REQUIRED):
- You MUST always provide a VERBATIM quote from the customer's actual words
- Copy the EXACT phrase that best captures their pain point or request
- Include enough context (a full sentence or two)
- Do NOT paraphrase - use their actual language word-for-word

CUSTOMER USE CASE (REQUIRED):
- You MUST always identify what the customer is trying to accomplish
- Focus on their business goal, workflow, or task
- Examples: "Generating weekly sales reports", "Onboarding new team members", "Tracking support tickets"

SENTIMENT (REQUIRED):
- You MUST classify as one of: positive, negative, or neutral
- Consider tone, word choice, and overall impression

KEYWORDS (REQUIRED):
- You MUST extract 3-8 specific, relevant keywords
- Focus on PRODUCT-RELATED terms: features, capabilities, pain points, use cases
- Avoid generic words like "want", "need", "please", "would", "could"
- Include product/feature names mentioned
- Keywords should be useful for searching and categorizing

=== OPTIONAL FIELDS ===

"explanation": Brief explanation of the overall analysis reasoning (optional)
"urgency": low|medium|high|critical (optional, default to medium if unclear)

Output STRICT JSON with this exact structure:
{
    "themes": [
        {
            "theme_id": "uuid-string",
            "theme_name": "Exact Theme Name",
            "confidence": 0.0-1.0,
            "explanation": "Specific quote or evidence from the message that directly relates to this theme"
        }
    ],
    "summary": "REQUIRED: 1-2 sentence summary focusing on the customer's main request or feedback point",
    "pain_point": "REQUIRED: Brief description of what the customer is struggling with (1-2 sentences)",
    "pain_point_quote": "REQUIRED: EXACT verbatim quote from customer - copy their ACTUAL words word-for-word",
    "feature_request": "REQUIRED: The specific feature or capability being requested or would benefit from",
    "customer_usecase": "REQUIRED: What the customer is trying to accomplish (their business goal/workflow)",
    "explanation": "Optional: Brief explanation of the overall analysis and classification reasoning",
    "sentiment": "REQUIRED: positive|negative|neutral",
    "urgency": "low|medium|high|critical",
    "keywords": ["REQUIRED: keyword1", "keyword2", "keyword3", "...3-8 keywords"]
}

IMPORTANT: All fields marked REQUIRED must have actual values - NEVER return null for these fields."""


def build_ai_insights_prompt(
    message_content: str,
    message_title: Optional[str],
    source_type: str,
    author_name: Optional[str],
    author_role: Optional[str],
    available_themes: List[Dict[str, Any]],
    locked_theme: Optional[Dict[str, Any]] = None,
) -> tuple[str, str]:
    """
    Build the prompt for AI insights generation.

    Args:
        message_content: The message text to analyze
        message_title: Optional title/subject of the message
        source_type: Source type (slack, gmail, gong, fathom)
        author_name: Name of message author
        author_role: Role of author (internal, external, customer)
        available_themes: List of themes the AI can select from
        locked_theme: Theme already assigned by feature pipeline (cannot be overridden)

    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    # Format available themes for the prompt
    themes_text = "AVAILABLE THEMES (you may ONLY select from these):\n"
    for theme in available_themes:
        themes_text += f"- ID: {theme['id']}, Name: \"{theme['name']}\""
        if theme.get('description'):
            themes_text += f", Description: {theme['description']}"
        themes_text += "\n"

    if not available_themes:
        themes_text = "AVAILABLE THEMES: None (return empty themes array)\n"

    # Format locked theme if present
    locked_theme_text = ""
    if locked_theme:
        locked_theme_text = f"""
LOCKED THEME (MUST be included in your response):
- ID: {locked_theme['id']}
- Name: "{locked_theme['name']}"
This theme was assigned by the feature extraction pipeline and is canonical.
You must include this theme and explain why it applies.
"""

    # Build user prompt
    user_prompt = f"""Analyze this message and extract insights.

{themes_text}
{locked_theme_text}

MESSAGE DETAILS:
- Source: {source_type}
- Author: {author_name or 'Unknown'}
- Role: {author_role or 'Unknown'}
- Title: {message_title or 'No title'}

MESSAGE CONTENT:
\"\"\"
{message_content[:4000]}
\"\"\"

Provide your analysis in the specified JSON format."""

    return AI_INSIGHTS_SYSTEM_PROMPT, user_prompt


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
    ) -> AIInsightsResult:
        """
        Generate AI insights for a single message.

        Args:
            message_content: The message text to analyze
            available_themes: List of themes the AI can select from
            message_title: Optional title/subject
            source_type: Source type (slack, gmail, gong, fathom)
            author_name: Name of message author
            author_role: Role of author
            locked_theme: Theme already assigned by feature pipeline

        Returns:
            AIInsightsResult with all extracted insights
        """
        start_time = time.time()

        try:
            system_prompt, user_prompt = build_ai_insights_prompt(
                message_content=message_content,
                message_title=message_title,
                source_type=source_type,
                author_name=author_name,
                author_role=author_role,
                available_themes=available_themes,
                locked_theme=locked_theme,
            )

            response = self.client.chat.completions.create(
                model=self.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
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
                prompt_version=AI_INSIGHTS_PROMPT_VERSION,
            )

        except json.JSONDecodeError as e:
            logger.error(f"AI Insights JSON decode error: {e}")
            return AIInsightsResult(
                error=f"JSON decode error: {str(e)}",
                latency_ms=(time.time() - start_time) * 1000,
                model=self.DEFAULT_MODEL,
                prompt_version=AI_INSIGHTS_PROMPT_VERSION,
            )

        except Exception as e:
            logger.error(f"AI Insights generation error: {e}")
            return AIInsightsResult(
                error=f"Generation error: {str(e)}",
                latency_ms=(time.time() - start_time) * 1000,
                model=self.DEFAULT_MODEL,
                prompt_version=AI_INSIGHTS_PROMPT_VERSION,
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

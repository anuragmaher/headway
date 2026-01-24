"""
Langfuse Prompt Service - Centralized prompt management via Langfuse.

This service fetches chat-type prompts from Langfuse, enabling:
- Version-controlled prompts
- A/B testing capabilities
- Prompt observability and analytics
- Easy prompt updates without code deployment

Chat-type prompts in Langfuse (return messages array):
- tier1_ai_prompt: Tier 1 classification (system + user messages)
- tier2_ai_prompt: Tier 2 extraction (system + user messages)
- ai_insights_prompt: AI Insights generation (system + user messages)
"""

import logging
from typing import Optional, Dict, Any, List
import threading

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global Langfuse client (lazy initialized)
_langfuse_client = None
_langfuse_lock = threading.Lock()


def _get_langfuse_client():
    """Get or create the Langfuse client (singleton)."""
    global _langfuse_client

    if _langfuse_client is not None:
        return _langfuse_client

    with _langfuse_lock:
        # Double-check after acquiring lock
        if _langfuse_client is not None:
            return _langfuse_client

        # Check if Langfuse is configured
        if not settings.LANGFUSE_SECRET_KEY or not settings.LANGFUSE_PUBLIC_KEY:
            logger.warning("Langfuse not configured. Prompts will fail to load.")
            return None

        try:
            from langfuse import Langfuse
            _langfuse_client = Langfuse(
                secret_key=settings.LANGFUSE_SECRET_KEY,
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                host=settings.LANGFUSE_HOST,
            )
            logger.info(f"Langfuse client initialized (host: {settings.LANGFUSE_HOST})")
            return _langfuse_client
        except Exception as e:
            logger.error(f"Failed to initialize Langfuse client: {e}")
            return None


class LangfusePromptService:
    """
    Service for fetching chat-type prompts from Langfuse.

    Features:
    - Fetches chat prompts from Langfuse (returns messages array)
    - Thread-safe
    - No local fallback - prompts MUST be in Langfuse
    """

    # Prompt name mappings (local key -> Langfuse prompt name)
    PROMPT_NAMES = {
        "tier1": "tier1_ai_prompt",
        "tier2": "tier2_ai_prompt",
        "ai_insights": "ai_insights_prompt",
    }

    def __init__(self):
        """Initialize the prompt service."""
        self._cache_lock = threading.Lock()

    def get_chat_prompt(
        self,
        prompt_key: str,
        variables: Optional[Dict[str, Any]] = None
    ) -> Optional[List[Dict[str, str]]]:
        """
        Get a chat-type prompt from Langfuse.

        Chat prompts return a messages array with system and user messages,
        ready to be passed directly to OpenAI's chat completions API.

        Args:
            prompt_key: Key from PROMPT_NAMES mapping (tier1, tier2, ai_insights)
            variables: Variables to interpolate into the prompt messages

        Returns:
            List of message dicts [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
            or None if unavailable
        """
        prompt_name = self.PROMPT_NAMES.get(prompt_key, prompt_key)

        client = _get_langfuse_client()
        if not client:
            logger.error(f"Langfuse client not available for prompt '{prompt_name}'")
            return None

        try:
            # Fetch chat-type prompt from Langfuse
            prompt = client.get_prompt(prompt_name, type="chat")

            if variables:
                # Compile with variables - returns list of ChatMessageDict
                messages = prompt.compile(**variables)
            else:
                # Return raw messages without variable interpolation
                messages = prompt.compile()

            logger.debug(f"Fetched chat prompt '{prompt_name}' from Langfuse (version: {prompt.version})")
            return messages

        except Exception as e:
            logger.error(f"Failed to fetch chat prompt '{prompt_name}' from Langfuse: {e}")
            return None

    def get_chat_prompt_with_version(
        self,
        prompt_key: str,
        variables: Optional[Dict[str, Any]] = None
    ) -> tuple[Optional[List[Dict[str, str]]], Optional[str]]:
        """
        Get a chat prompt and its version from Langfuse.

        Returns:
            Tuple of (messages_list, version_string)
        """
        prompt_name = self.PROMPT_NAMES.get(prompt_key, prompt_key)

        client = _get_langfuse_client()
        if not client:
            return None, None

        try:
            prompt = client.get_prompt(prompt_name, type="chat")
            messages = prompt.compile(**variables) if variables else prompt.compile()
            version = f"langfuse-v{prompt.version}"
            return messages, version
        except Exception as e:
            logger.error(f"Failed to fetch chat prompt '{prompt_name}': {e}")
            return None, None


# Global singleton instance
_prompt_service: Optional[LangfusePromptService] = None
_service_lock = threading.Lock()


def get_langfuse_prompt_service() -> LangfusePromptService:
    """Get or create the Langfuse prompt service singleton."""
    global _prompt_service

    if _prompt_service is None:
        with _service_lock:
            if _prompt_service is None:
                _prompt_service = LangfusePromptService()

    return _prompt_service


# ============================================================================
# Convenience functions for direct chat prompt access
# ============================================================================

def get_tier1_chat_prompt(**variables) -> List[Dict[str, str]]:
    """
    Get Tier 1 classification chat prompt from Langfuse.

    Variables:
        text: Message content (max 4000 chars)
        source_type: slack/gmail/gong/fathom
        actor_role: internal/external/customer/unknown

    Returns:
        List of messages ready for OpenAI chat completions API
    """
    service = get_langfuse_prompt_service()
    messages = service.get_chat_prompt("tier1", variables=variables)
    if not messages:
        raise ValueError("Failed to fetch tier1_ai_prompt from Langfuse. Check your Langfuse configuration.")
    return messages


def get_tier2_chat_prompt(**variables) -> List[Dict[str, str]]:
    """
    Get Tier 2 extraction chat prompt from Langfuse.

    Variables:
        text: Message content (max 5000 chars)
        source_type: slack/gmail/gong/fathom
        actor_name: Author name
        actor_role: internal/external/customer/unknown
        title: Message title/subject
        themes_list: Formatted themes list
        features_list: Formatted existing features list

    Returns:
        List of messages ready for OpenAI chat completions API
    """
    service = get_langfuse_prompt_service()
    messages = service.get_chat_prompt("tier2", variables=variables)
    if not messages:
        raise ValueError("Failed to fetch tier2_ai_prompt from Langfuse. Check your Langfuse configuration.")
    return messages


def get_ai_insights_chat_prompt(**variables) -> List[Dict[str, str]]:
    """
    Get AI Insights chat prompt from Langfuse.

    Variables:
        message_content: Message content (max 4000 chars)
        message_title: Title/subject
        source_type: slack/gmail/gong/fathom
        author_name: Author name
        author_role: Role
        themes_text: Formatted available themes
        locked_theme_text: Locked theme info (if any)
        customer_asks_text: Linked customer asks (if any)

    Returns:
        List of messages ready for OpenAI chat completions API
    """
    service = get_langfuse_prompt_service()
    messages = service.get_chat_prompt("ai_insights", variables=variables)
    if not messages:
        raise ValueError("Failed to fetch ai_insights_prompt from Langfuse. Check your Langfuse configuration.")
    return messages

"""
Langfuse Prompt Service - Centralized prompt management via Langfuse.

This service fetches chat-type prompts from Langfuse, enabling:
- Version-controlled prompts
- A/B testing capabilities
- Prompt observability and analytics
- Easy prompt updates without code deployment

Chat-type prompts in Langfuse:
- transcript_classification_prompt: Classify transcripts into themes/sub-themes
"""

import logging
from typing import Optional, Dict, Any, List
import threading

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global Langfuse client (lazy initialized)
_langfuse_client = None
_langfuse_lock = threading.Lock()


def get_langfuse_client():
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
        "transcript_classification": "classification prompt",
        "signal": "Signal",
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
            prompt_key: Key from PROMPT_NAMES mapping or direct Langfuse prompt name
            variables: Variables to interpolate into the prompt messages

        Returns:
            List of message dicts [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
            or None if unavailable
        """
        prompt_name = self.PROMPT_NAMES.get(prompt_key, prompt_key)

        client = get_langfuse_client()
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

        client = get_langfuse_client()
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

def get_transcript_classification_prompt(**variables) -> List[Dict[str, str]]:
    """
    Get transcript classification chat prompt from Langfuse.

    Variables:
        THEMES_JSON: Complete themes and sub-themes as JSON
        TRANSCRIPT: Complete raw transcript data
        COMPANY_NAME: Company name from onboarding
        COMPANY_DOMAINS: Company email domains (comma-separated)

    Returns:
        List of messages ready for OpenAI/Anthropic chat completions API
    """
    service = get_langfuse_prompt_service()
    messages = service.get_chat_prompt("transcript_classification", variables=variables)
    if not messages:
        raise ValueError("Failed to fetch 'classification prompt' from Langfuse. Check your Langfuse configuration.")
    return messages


# Appended to transcript so the model doesn't echo the prompt's example JSON
_SIGNAL_EXTRACTION_SUFFIX = (
    "\n\n---\nExtract real signals from the transcript above only. "
    "Do not return the example placeholder text from the instructions."
)


def get_signal_extraction_prompt(transcript_text: str) -> List[Dict[str, str]]:
    """
    Get Signal extraction chat prompt from Langfuse.

    Variables:
        TRANSCRIPT_TEXT: Full transcript text to analyze

    Returns:
        List of messages ready for OpenAI chat completions API
    """
    service = get_langfuse_prompt_service()
    transcript_with_nudge = transcript_text + _SIGNAL_EXTRACTION_SUFFIX
    messages = service.get_chat_prompt("signal", variables={"TRANSCRIPT_TEXT": transcript_with_nudge})
    if not messages:
        raise ValueError("Failed to fetch 'Signal' prompt from Langfuse. Check your Langfuse configuration.")
    return messages

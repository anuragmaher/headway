"""
Text Normalization Service

Cleans and normalizes text from various sources (Gmail, Slack, Gong, Fathom)
to produce consistent, clean text for AI processing.
"""

import re
import html
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class NormalizedText:
    """Result of text normalization."""
    clean_text: str
    original_length: int
    clean_length: int
    removed_elements: Dict[str, int]  # Count of removed elements by type


class TextNormalizationService:
    """
    Service for cleaning and normalizing text from various sources.

    Removes:
    - HTML tags and entities
    - Email signatures
    - Email headers (forwarded/replied content markers)
    - Excessive whitespace
    - URLs (optionally)
    - Phone numbers (optionally)
    - Repeated timestamp lines (common in transcripts)
    """

    # Email signature patterns
    EMAIL_SIGNATURE_PATTERNS = [
        r'(?m)^[-_]{2,}\s*$.*',  # Lines starting with -- or __
        r'(?m)^Sent from my .*$',
        r'(?m)^Get Outlook for .*$',
        r'(?m)^On .+ wrote:.*$',
        r'(?m)^From:.*\nSent:.*\nTo:.*\nSubject:.*',  # Forward headers
        r'(?im)^best regards?,?\s*$',
        r'(?im)^kind regards?,?\s*$',
        r'(?im)^thanks?,?\s*$',
        r'(?im)^thank you,?\s*$',
        r'(?im)^cheers?,?\s*$',
        r'(?im)^regards?,?\s*$',
    ]

    # Patterns to identify quoted reply content
    QUOTE_PATTERNS = [
        r'(?m)^>+.*$',  # Lines starting with >
        r'(?m)^On .+ wrote:$',
        r'(?m)^-{3,} Original Message -{3,}',
        r'(?m)^-{3,} Forwarded message -{3,}',
    ]

    # Timestamp spam patterns (common in transcripts)
    TIMESTAMP_SPAM_PATTERNS = [
        r'\[\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\]',  # [10:30 AM]
        r'\(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\)',  # (10:30 AM)
        r'\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?(?=\s+-\s+)',  # 10:30 AM -
    ]

    # URL pattern
    URL_PATTERN = r'https?://[^\s<>"{}|\\^`\[\]]+'

    # Phone pattern (basic)
    PHONE_PATTERN = r'(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'

    def __init__(
        self,
        remove_urls: bool = False,
        remove_phones: bool = False,
        remove_signatures: bool = True,
        remove_quotes: bool = True,
        max_length: Optional[int] = None
    ):
        """
        Initialize the text normalization service.

        Args:
            remove_urls: Whether to remove URLs from text
            remove_phones: Whether to remove phone numbers
            remove_signatures: Whether to remove email signatures
            remove_quotes: Whether to remove quoted reply content
            max_length: Maximum length of output text (truncate if exceeded)
        """
        self.remove_urls = remove_urls
        self.remove_phones = remove_phones
        self.remove_signatures = remove_signatures
        self.remove_quotes = remove_quotes
        self.max_length = max_length

    def normalize(self, text: str, source_type: str = "unknown") -> NormalizedText:
        """
        Normalize text from any source.

        Args:
            text: Raw text to normalize
            source_type: Source type (gmail, slack, gong, fathom) for source-specific handling

        Returns:
            NormalizedText with clean text and metadata
        """
        if not text:
            return NormalizedText(
                clean_text="",
                original_length=0,
                clean_length=0,
                removed_elements={}
            )

        original_length = len(text)
        removed = {}

        # Decode HTML entities first
        text = html.unescape(text)

        # Remove HTML tags
        html_count = len(re.findall(r'<[^>]+>', text))
        if html_count > 0:
            text = re.sub(r'<[^>]+>', ' ', text)
            removed['html_tags'] = html_count

        # Source-specific normalization
        if source_type == "gmail":
            text, gmail_removed = self._normalize_email(text)
            removed.update(gmail_removed)
        elif source_type == "slack":
            text, slack_removed = self._normalize_slack(text)
            removed.update(slack_removed)
        elif source_type in ("gong", "fathom"):
            text, transcript_removed = self._normalize_transcript(text)
            removed.update(transcript_removed)

        # Remove URLs if configured
        if self.remove_urls:
            url_count = len(re.findall(self.URL_PATTERN, text))
            if url_count > 0:
                text = re.sub(self.URL_PATTERN, ' ', text)
                removed['urls'] = url_count

        # Remove phone numbers if configured
        if self.remove_phones:
            phone_count = len(re.findall(self.PHONE_PATTERN, text))
            if phone_count > 0:
                text = re.sub(self.PHONE_PATTERN, ' ', text)
                removed['phones'] = phone_count

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()

        # Truncate if needed
        if self.max_length and len(text) > self.max_length:
            text = text[:self.max_length]
            removed['truncated_chars'] = original_length - self.max_length

        return NormalizedText(
            clean_text=text,
            original_length=original_length,
            clean_length=len(text),
            removed_elements=removed
        )

    def _normalize_email(self, text: str) -> Tuple[str, Dict[str, int]]:
        """Normalize email-specific content."""
        removed = {}

        # Remove email signatures
        if self.remove_signatures:
            for pattern in self.EMAIL_SIGNATURE_PATTERNS:
                matches = len(re.findall(pattern, text))
                if matches > 0:
                    text = re.sub(pattern, '', text, flags=re.DOTALL)
                    removed['signatures'] = removed.get('signatures', 0) + matches

        # Remove quoted content
        if self.remove_quotes:
            for pattern in self.QUOTE_PATTERNS:
                matches = len(re.findall(pattern, text))
                if matches > 0:
                    text = re.sub(pattern, '', text, flags=re.MULTILINE)
                    removed['quotes'] = removed.get('quotes', 0) + matches

        return text, removed

    def _normalize_slack(self, text: str) -> Tuple[str, Dict[str, int]]:
        """Normalize Slack-specific content."""
        removed = {}

        # Remove Slack user mentions <@U12345>
        mentions = len(re.findall(r'<@[A-Z0-9]+>', text))
        if mentions > 0:
            text = re.sub(r'<@[A-Z0-9]+>', '', text)
            removed['slack_mentions'] = mentions

        # Remove Slack channel references <#C12345|channel-name>
        channels = len(re.findall(r'<#[A-Z0-9]+\|[^>]+>', text))
        if channels > 0:
            text = re.sub(r'<#[A-Z0-9]+\|([^>]+)>', r'#\1', text)
            removed['slack_channels'] = channels

        # Remove Slack link formatting <url|text>
        links = len(re.findall(r'<[^>]+\|[^>]+>', text))
        if links > 0:
            text = re.sub(r'<([^>]+)\|([^>]+)>', r'\2', text)
            removed['slack_links'] = links

        # Remove emoji codes :emoji_name:
        emojis = len(re.findall(r':[a-z0-9_+-]+:', text, re.IGNORECASE))
        if emojis > 0:
            text = re.sub(r':[a-z0-9_+-]+:', ' ', text, flags=re.IGNORECASE)
            removed['emojis'] = emojis

        return text, removed

    def _normalize_transcript(self, text: str) -> Tuple[str, Dict[str, int]]:
        """Normalize transcript-specific content (Gong/Fathom)."""
        removed = {}

        # Remove excessive timestamp markers
        total_timestamps = 0
        for pattern in self.TIMESTAMP_SPAM_PATTERNS:
            timestamps = len(re.findall(pattern, text))
            if timestamps > 0:
                text = re.sub(pattern, '', text)
                total_timestamps += timestamps

        if total_timestamps > 0:
            removed['timestamps'] = total_timestamps

        # Normalize speaker labels (e.g., "Speaker 1:" -> just the content)
        # But keep the first occurrence of each speaker for context
        speaker_pattern = r'(?m)^([A-Za-z\s]+):\s*'
        speakers_seen = set()
        lines = text.split('\n')
        cleaned_lines = []

        for line in lines:
            match = re.match(speaker_pattern, line)
            if match:
                speaker = match.group(1).strip()
                if speaker not in speakers_seen:
                    speakers_seen.add(speaker)
                    cleaned_lines.append(line)  # Keep first occurrence
                else:
                    # Remove speaker prefix from subsequent lines
                    cleaned_lines.append(re.sub(speaker_pattern, '', line))
            else:
                cleaned_lines.append(line)

        text = '\n'.join(cleaned_lines)

        return text, removed

    def extract_key_sentences(self, text: str, max_sentences: int = 10) -> str:
        """
        Extract key sentences from text for summarization.

        Prioritizes sentences that contain feature-related keywords.

        Args:
            text: Normalized text
            max_sentences: Maximum number of sentences to return

        Returns:
            String with key sentences
        """
        # Simple sentence splitting (can be improved with NLP)
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

        # Feature-related keywords for prioritization
        feature_keywords = [
            'need', 'want', 'would like', 'wish', 'should',
            'feature', 'functionality', 'capability',
            'integration', 'support', 'ability',
            'currently', 'today', 'right now',
            'pain', 'frustrat', 'difficult', 'hard',
            'improve', 'better', 'easier',
        ]

        # Score sentences by keyword presence
        scored = []
        for sentence in sentences:
            score = sum(1 for kw in feature_keywords if kw.lower() in sentence.lower())
            scored.append((score, sentence))

        # Sort by score and take top sentences
        scored.sort(key=lambda x: x[0], reverse=True)
        top_sentences = [s[1] for s in scored[:max_sentences]]

        return '. '.join(top_sentences)


# Singleton instance
_text_normalizer: Optional[TextNormalizationService] = None


def get_text_normalization_service() -> TextNormalizationService:
    """Get or create the text normalization service singleton."""
    global _text_normalizer
    if _text_normalizer is None:
        _text_normalizer = TextNormalizationService()
    return _text_normalizer

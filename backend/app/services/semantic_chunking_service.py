"""
Semantic Chunking Service

Splits large text content into semantic chunks for efficient AI processing.
Unlike token-based chunking, this preserves meaning by splitting on natural
boundaries:
- Email: Per message in thread
- Slack: Small message groups (3-5 messages)
- Gong/Fathom: 30-60 second transcript windows with speaker turns

Target chunk size: 200-600 tokens (roughly 800-2400 characters)
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TextChunk:
    """A semantic chunk of text."""
    text: str
    chunk_index: int
    token_estimate: int
    start_offset: int
    end_offset: int
    speaker: Optional[str] = None
    speaker_role: Optional[str] = None
    start_time_seconds: Optional[float] = None
    end_time_seconds: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class SemanticChunkingService:
    """
    Service for splitting text into semantic chunks.

    Key principles:
    - Preserve semantic meaning (don't split mid-sentence/mid-thought)
    - Keep chunks small (200-600 tokens) for accurate AI processing
    - Maintain context (speaker info, timestamps)
    - Reference back to original content
    """

    # Token estimation: ~4 characters per token for English
    CHARS_PER_TOKEN = 4

    # Target chunk sizes (in tokens)
    MIN_CHUNK_TOKENS = 150
    TARGET_CHUNK_TOKENS = 400
    MAX_CHUNK_TOKENS = 600

    # Character limits derived from token targets
    MIN_CHUNK_CHARS = MIN_CHUNK_TOKENS * CHARS_PER_TOKEN  # ~600 chars
    TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN  # ~1600 chars
    MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN  # ~2400 chars

    # Transcript chunk duration (seconds)
    TRANSCRIPT_CHUNK_DURATION = 45  # 30-60 seconds per chunk

    def __init__(
        self,
        min_tokens: int = MIN_CHUNK_TOKENS,
        target_tokens: int = TARGET_CHUNK_TOKENS,
        max_tokens: int = MAX_CHUNK_TOKENS
    ):
        """
        Initialize the chunking service.

        Args:
            min_tokens: Minimum tokens per chunk (below this, merge with next)
            target_tokens: Target token count per chunk
            max_tokens: Maximum tokens per chunk (above this, must split)
        """
        self.min_tokens = min_tokens
        self.target_tokens = target_tokens
        self.max_tokens = max_tokens

        self.min_chars = min_tokens * self.CHARS_PER_TOKEN
        self.target_chars = target_tokens * self.CHARS_PER_TOKEN
        self.max_chars = max_tokens * self.CHARS_PER_TOKEN

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for text."""
        return len(text) // self.CHARS_PER_TOKEN

    def chunk(self, text: str, source_type: str, metadata: Optional[Dict] = None) -> List[TextChunk]:
        """
        Split text into semantic chunks based on source type.

        Args:
            text: Text content to chunk
            source_type: Source type (gmail, slack, gong, fathom)
            metadata: Optional metadata for chunking hints

        Returns:
            List of TextChunk objects
        """
        if not text or len(text.strip()) < self.min_chars:
            # Text too short to chunk
            return [TextChunk(
                text=text.strip(),
                chunk_index=0,
                token_estimate=self.estimate_tokens(text),
                start_offset=0,
                end_offset=len(text)
            )]

        # Route to source-specific chunking
        if source_type == "gmail":
            return self._chunk_email(text, metadata or {})
        elif source_type == "slack":
            return self._chunk_slack(text, metadata or {})
        elif source_type in ("gong", "fathom"):
            return self._chunk_transcript(text, metadata or {})
        else:
            return self._chunk_generic(text)

    def _chunk_email(self, text: str, metadata: Dict) -> List[TextChunk]:
        """
        Chunk email content by messages in thread.

        Email threads typically have multiple messages separated by
        forward/reply markers.
        """
        chunks = []
        current_offset = 0

        # Common email message separators
        separators = [
            r'\n-{3,}\s*Original Message\s*-{3,}',
            r'\n-{3,}\s*Forwarded message\s*-{3,}',
            r'\nOn .+ wrote:\n',
            r'\nFrom:.*\nSent:.*\nTo:.*\nSubject:.*\n',
            r'\n>{2,}',  # Multiple quoted lines
        ]

        # Combine into one pattern
        combined_pattern = '|'.join(f'({sep})' for sep in separators)

        # Split by email separators
        parts = re.split(combined_pattern, text, flags=re.IGNORECASE | re.MULTILINE)

        # Filter out None and empty parts
        parts = [p for p in parts if p and p.strip()]

        if len(parts) <= 1:
            # No separators found, use generic chunking
            return self._chunk_generic(text)

        # Process each email message
        for i, part in enumerate(parts):
            # Skip separator matches (they appear as separate groups)
            if any(re.match(sep, part, re.IGNORECASE) for sep in separators):
                continue

            part = part.strip()
            if not part:
                continue

            start_offset = text.find(part, current_offset)
            if start_offset == -1:
                start_offset = current_offset

            # If part is too large, chunk it further
            if len(part) > self.max_chars:
                sub_chunks = self._chunk_by_paragraphs(part, start_offset)
                for j, sub_chunk in enumerate(sub_chunks):
                    sub_chunk.chunk_index = len(chunks)
                    chunks.append(sub_chunk)
            elif len(part) >= self.min_chars:
                chunks.append(TextChunk(
                    text=part,
                    chunk_index=len(chunks),
                    token_estimate=self.estimate_tokens(part),
                    start_offset=start_offset,
                    end_offset=start_offset + len(part)
                ))

            current_offset = start_offset + len(part)

        return chunks if chunks else self._chunk_generic(text)

    def _chunk_slack(self, text: str, metadata: Dict) -> List[TextChunk]:
        """
        Chunk Slack messages.

        Groups of 3-5 related messages, maintaining conversation flow.
        """
        chunks = []

        # Slack messages often have newlines between them
        # But we want to group related messages together
        lines = text.split('\n')
        lines = [l for l in lines if l.strip()]

        if not lines:
            return []

        current_chunk_lines = []
        current_chunk_start = 0
        current_offset = 0

        for i, line in enumerate(lines):
            current_chunk_lines.append(line)
            chunk_text = '\n'.join(current_chunk_lines)

            # Check if we should end this chunk
            should_end = False

            if len(chunk_text) >= self.target_chars:
                should_end = True
            elif len(chunk_text) >= self.min_chars and len(current_chunk_lines) >= 3:
                # At least 3 messages and minimum size
                should_end = True
            elif i == len(lines) - 1:
                # Last line
                should_end = True

            if should_end and chunk_text.strip():
                start_offset = text.find(current_chunk_lines[0], current_offset)
                if start_offset == -1:
                    start_offset = current_offset

                chunks.append(TextChunk(
                    text=chunk_text,
                    chunk_index=len(chunks),
                    token_estimate=self.estimate_tokens(chunk_text),
                    start_offset=start_offset,
                    end_offset=start_offset + len(chunk_text)
                ))

                current_offset = start_offset + len(chunk_text)
                current_chunk_lines = []

        return chunks if chunks else self._chunk_generic(text)

    def _chunk_transcript(self, text: str, metadata: Dict) -> List[TextChunk]:
        """
        Chunk transcript content (Gong/Fathom).

        Uses speaker turns and time windows to create semantic chunks.
        Target: 30-60 seconds per chunk, respecting speaker boundaries.
        """
        chunks = []

        # Common transcript patterns
        # "Speaker Name: content" or "[00:01:30] Speaker Name: content"
        speaker_pattern = r'(?:(?:\[[\d:]+\]\s*)?([A-Za-z\s]+):\s*)'

        # Split by speaker turns
        parts = re.split(speaker_pattern, text)

        if len(parts) <= 1:
            # No speaker pattern, use paragraph chunking
            return self._chunk_by_paragraphs(text, 0)

        # Process speaker turns
        current_speaker = None
        current_chunk_parts = []
        current_chunk_start = 0
        current_offset = 0

        i = 0
        while i < len(parts):
            part = parts[i]

            # Check if this is a speaker name
            if i + 1 < len(parts) and part and ':' not in parts[i + 1][:20]:
                # This looks like a speaker name
                speaker = part.strip()

                # Get the content
                if i + 1 < len(parts):
                    content = parts[i + 1].strip()
                    i += 2
                else:
                    content = ""
                    i += 1

                if not content:
                    continue

                # Check if we should start a new chunk
                current_text = '\n'.join([p for p in current_chunk_parts if p])
                should_end = False

                if len(current_text) >= self.target_chars:
                    should_end = True
                elif len(current_text) >= self.min_chars and speaker != current_speaker:
                    # Speaker change and minimum size met
                    should_end = True

                if should_end and current_text.strip():
                    start_offset = text.find(current_chunk_parts[0], current_offset)
                    if start_offset == -1:
                        start_offset = current_offset

                    chunks.append(TextChunk(
                        text=current_text,
                        chunk_index=len(chunks),
                        token_estimate=self.estimate_tokens(current_text),
                        start_offset=start_offset,
                        end_offset=start_offset + len(current_text),
                        speaker=current_speaker
                    ))

                    current_offset = start_offset + len(current_text)
                    current_chunk_parts = []

                current_speaker = speaker
                current_chunk_parts.append(f"{speaker}: {content}")
            else:
                # Regular content
                if part.strip():
                    current_chunk_parts.append(part.strip())
                i += 1

        # Add remaining content
        if current_chunk_parts:
            current_text = '\n'.join([p for p in current_chunk_parts if p])
            if current_text.strip():
                start_offset = text.find(current_chunk_parts[0], current_offset)
                if start_offset == -1:
                    start_offset = current_offset

                chunks.append(TextChunk(
                    text=current_text,
                    chunk_index=len(chunks),
                    token_estimate=self.estimate_tokens(current_text),
                    start_offset=start_offset,
                    end_offset=start_offset + len(current_text),
                    speaker=current_speaker
                ))

        return chunks if chunks else self._chunk_by_paragraphs(text, 0)

    def _chunk_by_paragraphs(self, text: str, base_offset: int = 0) -> List[TextChunk]:
        """
        Chunk text by paragraphs (generic fallback).

        Splits on double newlines first, then single newlines if needed.
        """
        chunks = []

        # Split by double newlines (paragraphs)
        paragraphs = re.split(r'\n\s*\n', text)

        current_chunk_paras = []
        current_offset = base_offset

        for i, para in enumerate(paragraphs):
            para = para.strip()
            if not para:
                continue

            current_chunk_paras.append(para)
            chunk_text = '\n\n'.join(current_chunk_paras)

            should_end = False

            if len(chunk_text) >= self.max_chars:
                # Too big, need to split
                if len(current_chunk_paras) > 1:
                    # Pop last paragraph and end chunk
                    current_chunk_paras.pop()
                    chunk_text = '\n\n'.join(current_chunk_paras)
                    should_end = True
                    # Put para back for next chunk
                    current_chunk_paras = [para]
                else:
                    # Single paragraph too big, split by sentences
                    sub_chunks = self._chunk_by_sentences(para, current_offset)
                    for sub_chunk in sub_chunks:
                        sub_chunk.chunk_index = len(chunks)
                        chunks.append(sub_chunk)
                    current_chunk_paras = []
                    current_offset = sub_chunks[-1].end_offset if sub_chunks else current_offset
                    continue
            elif len(chunk_text) >= self.target_chars:
                should_end = True
            elif i == len(paragraphs) - 1:
                should_end = True

            if should_end and chunk_text.strip():
                start_offset = text.find(current_chunk_paras[0], current_offset - base_offset) + base_offset
                if start_offset < base_offset:
                    start_offset = current_offset

                chunks.append(TextChunk(
                    text=chunk_text,
                    chunk_index=len(chunks),
                    token_estimate=self.estimate_tokens(chunk_text),
                    start_offset=start_offset,
                    end_offset=start_offset + len(chunk_text)
                ))

                current_offset = start_offset + len(chunk_text)
                if len(current_chunk_paras) > 1 or not should_end:
                    current_chunk_paras = []

        return chunks

    def _chunk_by_sentences(self, text: str, base_offset: int = 0) -> List[TextChunk]:
        """
        Chunk text by sentences (for very long paragraphs).
        """
        chunks = []

        # Simple sentence splitting
        sentences = re.split(r'(?<=[.!?])\s+', text)

        current_sentences = []
        current_offset = base_offset

        for i, sentence in enumerate(sentences):
            sentence = sentence.strip()
            if not sentence:
                continue

            current_sentences.append(sentence)
            chunk_text = ' '.join(current_sentences)

            should_end = False

            if len(chunk_text) >= self.target_chars:
                should_end = True
            elif i == len(sentences) - 1:
                should_end = True

            if should_end and chunk_text.strip():
                start_offset = text.find(current_sentences[0], current_offset - base_offset) + base_offset
                if start_offset < base_offset:
                    start_offset = current_offset

                chunks.append(TextChunk(
                    text=chunk_text,
                    chunk_index=len(chunks),
                    token_estimate=self.estimate_tokens(chunk_text),
                    start_offset=start_offset,
                    end_offset=start_offset + len(chunk_text)
                ))

                current_offset = start_offset + len(chunk_text)
                current_sentences = []

        return chunks

    def _chunk_generic(self, text: str) -> List[TextChunk]:
        """Generic chunking fallback."""
        return self._chunk_by_paragraphs(text, 0)

    def should_chunk(self, text: str) -> bool:
        """
        Determine if text needs to be chunked.

        Args:
            text: Text to check

        Returns:
            True if text should be chunked, False if it's small enough as-is
        """
        return len(text) > self.target_chars


# Singleton instance
_chunking_service: Optional[SemanticChunkingService] = None


def get_semantic_chunking_service() -> SemanticChunkingService:
    """Get or create the semantic chunking service singleton."""
    global _chunking_service
    if _chunking_service is None:
        _chunking_service = SemanticChunkingService()
    return _chunking_service

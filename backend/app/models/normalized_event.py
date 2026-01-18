"""
NormalizedEvent model for unified data representation.

All data from Gmail, Slack, Gong, and Fathom is normalized into this
canonical model before AI processing. This provides:
- Clean, consistent text (no HTML, signatures, timestamp spam)
- Unified schema across all sources
- Efficient querying for AI processing pipeline
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Float, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class NormalizedEvent(Base):
    """
    Normalized representation of events from all data sources.

    This is the single source of truth for AI processing. All source-specific
    data (Gmail threads, Slack messages, Gong calls, Fathom sessions) is
    normalized into this format before any AI processing.
    """

    __tablename__ = "normalized_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)

    # Source tracking - links back to original record
    source_type = Column(String(50), nullable=False, index=True)  # gmail, slack, gong, fathom
    source_id = Column(String(255), nullable=False)  # Original message/thread/call ID
    source_table = Column(String(100), nullable=False)  # messages, gmail_threads, etc.
    source_record_id = Column(UUID(as_uuid=True), nullable=False)  # FK to original record

    # Clean text content (normalized - no HTML, signatures, etc.)
    clean_text = Column(Text, nullable=False)
    text_length = Column(Integer, nullable=False)  # Character count for quick filtering

    # Actor/speaker information
    actor_name = Column(String(255), nullable=True)
    actor_email = Column(String(255), nullable=True, index=True)
    actor_role = Column(String(100), nullable=True)  # internal, external, customer, vendor

    # Event metadata
    title = Column(String(500), nullable=True)
    event_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    channel_or_label = Column(String(255), nullable=True)  # Slack channel, Gmail label, etc.

    # Additional metadata (source-specific fields stored as JSON)
    # Note: 'metadata' is reserved in SQLAlchemy, so we use 'event_metadata'
    event_metadata = Column(JSONB, nullable=True, default=dict)

    # Deterministic signal scoring (computed before AI)
    signal_score = Column(Float, nullable=True)  # 0.0 - 1.0, computed by heuristics
    signal_reason = Column(String(500), nullable=True)  # Why this score was assigned
    signal_keywords = Column(JSONB, nullable=True)  # Keywords that triggered the score

    # Processing pipeline state
    processing_stage = Column(String(50), nullable=False, default="pending")
    # Stages: pending -> scored -> chunked -> classified -> extracted -> completed

    skip_ai_processing = Column(Boolean, default=False, nullable=False)  # Skip if signal_score too low

    # Chunking references (if event was split into chunks)
    is_chunked = Column(Boolean, default=False, nullable=False)
    chunk_count = Column(Integer, nullable=True)

    # Classification results (from Tier-1)
    is_feature_relevant = Column(Boolean, nullable=True)  # Does this contain feature request?
    classification_confidence = Column(Float, nullable=True)  # 0.0 - 1.0
    classification_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Error tracking
    processing_error = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Per-stage progress timestamps (state-driven execution)
    # These enable idempotent processing and safe state transitions
    scored_at = Column(DateTime(timezone=True), nullable=True)
    chunked_at = Column(DateTime(timezone=True), nullable=True)
    classified_at = Column(DateTime(timezone=True), nullable=True)
    extracted_at = Column(DateTime(timezone=True), nullable=True)

    # Lock token for concurrency control (UUID set when row is locked for processing)
    lock_token = Column(UUID(as_uuid=True), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="normalized_events")
    chunks = relationship("EventChunk", back_populates="normalized_event", cascade="all, delete-orphan")
    extracted_facts = relationship("ExtractedFact", back_populates="normalized_event", cascade="all, delete-orphan")

    # Performance indexes
    __table_args__ = (
        Index('idx_normalized_events_workspace_stage', 'workspace_id', 'processing_stage'),
        Index('idx_normalized_events_workspace_source', 'workspace_id', 'source_type'),
        Index('idx_normalized_events_workspace_timestamp', 'workspace_id', 'event_timestamp'),
        Index('idx_normalized_events_signal_score', 'signal_score'),
        Index('idx_normalized_events_pending', 'workspace_id', 'processing_stage', 'skip_ai_processing'),
        Index('idx_normalized_events_source_record', 'source_table', 'source_record_id'),
    )

    def __repr__(self) -> str:
        return f"<NormalizedEvent(id={self.id}, source={self.source_type}, stage={self.processing_stage})>"


class EventChunk(Base):
    """
    Semantic chunks of normalized events.

    Large events (long transcripts, email threads) are split into semantic
    chunks for more accurate AI processing. Each chunk references its parent
    NormalizedEvent.
    """

    __tablename__ = "event_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    normalized_event_id = Column(UUID(as_uuid=True), ForeignKey("normalized_events.id"), nullable=False, index=True)

    # Chunk content
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)  # Order within parent event
    token_estimate = Column(Integer, nullable=True)  # Estimated token count

    # Chunk boundaries (for transcript sources)
    start_offset = Column(Integer, nullable=True)  # Character offset in original
    end_offset = Column(Integer, nullable=True)
    start_timestamp_seconds = Column(Float, nullable=True)  # For Gong/Fathom transcripts
    end_timestamp_seconds = Column(Float, nullable=True)

    # Speaker info (for transcript chunks)
    speaker_name = Column(String(255), nullable=True)
    speaker_role = Column(String(100), nullable=True)

    # Processing state
    processing_stage = Column(String(50), nullable=False, default="pending")
    # Stages: pending -> classified -> extracted -> completed

    # Tier-1 classification results
    is_feature_relevant = Column(Boolean, nullable=True)
    classification_confidence = Column(Float, nullable=True)
    classification_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Skip flag for chunks below threshold
    skip_extraction = Column(Boolean, default=False, nullable=False)

    # Error tracking
    processing_error = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Per-stage progress timestamps (state-driven execution)
    classified_at = Column(DateTime(timezone=True), nullable=True)
    extracted_at = Column(DateTime(timezone=True), nullable=True)

    # Lock token for concurrency control
    lock_token = Column(UUID(as_uuid=True), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="event_chunks")
    normalized_event = relationship("NormalizedEvent", back_populates="chunks")
    extracted_facts = relationship("ExtractedFact", back_populates="chunk", cascade="all, delete-orphan")

    # Performance indexes
    __table_args__ = (
        Index('idx_event_chunks_workspace_stage', 'workspace_id', 'processing_stage'),
        Index('idx_event_chunks_event_index', 'normalized_event_id', 'chunk_index'),
        Index('idx_event_chunks_pending', 'workspace_id', 'processing_stage', 'skip_extraction'),
    )

    def __repr__(self) -> str:
        return f"<EventChunk(id={self.id}, event={self.normalized_event_id}, index={self.chunk_index})>"

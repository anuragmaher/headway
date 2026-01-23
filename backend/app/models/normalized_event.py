"""
NormalizedEvent model - Minimal schema for AI processing pipeline.

All data from Gmail, Slack, Gong, and Fathom is normalized into this
canonical model before AI processing.
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

    Minimal schema - only stores what's essential for the AI pipeline.
    Extra metadata (actor info, title, channel) stored in event_metadata JSONB.
    """

    __tablename__ = "normalized_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)

    # Source tracking - links back to original record
    source_type = Column(String(50), nullable=False, index=True)  # gmail, slack, gong, fathom
    source_id = Column(String(255), nullable=False)  # External ID from source system
    source_table = Column(String(100), nullable=False)  # "messages"
    source_record_id = Column(UUID(as_uuid=True), nullable=False)  # FK to Message.id

    # Content
    clean_text = Column(Text, nullable=False)
    event_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    event_metadata = Column(JSONB, nullable=True, default=dict)  # actor_name, actor_email, title, channel, etc.

    # Pipeline state
    processing_stage = Column(String(50), nullable=False, default="pending")
    # Stages: pending -> normalized -> chunked -> classified -> extracted -> completed

    # Chunking
    is_chunked = Column(Boolean, default=False, nullable=False)
    chunk_count = Column(Integer, nullable=True)

    # Classification results (from Tier-1)
    is_feature_relevant = Column(Boolean, nullable=True)
    classification_confidence = Column(Float, nullable=True)

    # Error handling
    processing_error = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Progress timestamps
    chunked_at = Column(DateTime(timezone=True), nullable=True)
    classified_at = Column(DateTime(timezone=True), nullable=True)
    extracted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="normalized_events")
    chunks = relationship("EventChunk", back_populates="normalized_event", cascade="all, delete-orphan")
    extracted_facts = relationship("ExtractedFact", back_populates="normalized_event", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_normalized_events_workspace_stage', 'workspace_id', 'processing_stage'),
        Index('idx_normalized_events_source_record', 'source_table', 'source_record_id'),
    )

    def __repr__(self) -> str:
        return f"<NormalizedEvent(id={self.id}, source={self.source_type}, stage={self.processing_stage})>"

    # Helper properties to access metadata
    @property
    def actor_name(self):
        return (self.event_metadata or {}).get('actor_name')

    @property
    def actor_email(self):
        return (self.event_metadata or {}).get('actor_email')

    @property
    def actor_role(self):
        return (self.event_metadata or {}).get('actor_role')

    @property
    def title(self):
        return (self.event_metadata or {}).get('title')


class EventChunk(Base):
    """
    Semantic chunks of normalized events.

    Minimal schema - extra metadata (speaker, timestamps) stored in chunk_metadata JSONB.
    """

    __tablename__ = "event_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    normalized_event_id = Column(UUID(as_uuid=True), ForeignKey("normalized_events.id"), nullable=False, index=True)

    # Content
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_metadata = Column(JSONB, nullable=True, default=dict)  # speaker_name, speaker_role, timestamps, etc.

    # Pipeline state
    processing_stage = Column(String(50), nullable=False, default="pending")
    # Stages: pending -> classified -> extracted -> completed

    # Classification results
    is_feature_relevant = Column(Boolean, nullable=True)
    classification_confidence = Column(Float, nullable=True)

    # Error handling
    processing_error = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Progress timestamps
    classified_at = Column(DateTime(timezone=True), nullable=True)
    extracted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="event_chunks")
    normalized_event = relationship("NormalizedEvent", back_populates="chunks")
    extracted_facts = relationship("ExtractedFact", back_populates="chunk", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_event_chunks_workspace_stage', 'workspace_id', 'processing_stage'),
        Index('idx_event_chunks_event_index', 'normalized_event_id', 'chunk_index'),
    )

    def __repr__(self) -> str:
        return f"<EventChunk(id={self.id}, event={self.normalized_event_id}, index={self.chunk_index})>"

    # Helper properties to access metadata
    @property
    def speaker_name(self):
        return (self.chunk_metadata or {}).get('speaker_name')

    @property
    def speaker_role(self):
        return (self.chunk_metadata or {}).get('speaker_role')

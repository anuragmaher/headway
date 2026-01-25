"""
Raw Transcript model for storing raw Gong/Fathom transcript data before AI processing.
"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, text
import uuid

from app.core.database import Base


class RawTranscript(Base):
    """
    Raw transcript landing zone for Gong/Fathom data before AI processing.

    This table stores the complete raw transcript data from external sources.
    A Celery task processes unprocessed transcripts and stores results in
    the transcript_classifications table.
    """

    __tablename__ = "raw_transcripts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Workspace relationship
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)

    # Source identification
    source_type = Column(String(50), nullable=False)  # 'gong', 'fathom'
    source_id = Column(String(255), nullable=False)  # External ID (Gong call ID, Fathom session ID)

    # Raw data storage - complete transcript + metadata from API
    raw_data = Column(JSONB, nullable=False, default=dict)

    # Processing flags
    ai_processed = Column(Boolean, default=False, nullable=False, index=True)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_error = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Metadata extracted during ingestion (for quick access without parsing raw_data)
    title = Column(String(500), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    transcript_date = Column(DateTime(timezone=True), nullable=True)
    participant_count = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="raw_transcripts")

    __table_args__ = (
        # Unique constraint to prevent duplicate transcripts
        UniqueConstraint('workspace_id', 'source_type', 'source_id', name='uq_raw_transcript_source'),
        # Standard indexes
        Index('idx_raw_transcripts_workspace', 'workspace_id'),
        Index('idx_raw_transcripts_source', 'source_type', 'source_id'),
        Index('idx_raw_transcripts_date', 'transcript_date'),
        # Partial index for unprocessed transcripts (most common query pattern)
        Index(
            'idx_raw_transcripts_unprocessed',
            'workspace_id', 'ai_processed',
            postgresql_where=text('ai_processed = false')
        ),
    )

    def __repr__(self) -> str:
        return f"<RawTranscript(id={self.id}, source_type='{self.source_type}', processed={self.ai_processed})>"

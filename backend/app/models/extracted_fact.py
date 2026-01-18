"""
ExtractedFact model for intermediate AI extraction results.

This is the "facts table" that stores AI extraction results before
they are aggregated into the final Features table. This provides:
- Replayability: Can re-aggregate without re-running AI
- Auditing: Full trace of what was extracted and from where
- Confidence tracking: Per-fact confidence scores
- Safe retries: Idempotent processing without duplicates
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Float, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class ExtractedFact(Base):
    """
    Intermediate storage for AI-extracted feature requests.

    Each fact represents a single feature request extracted from a chunk
    or normalized event. Multiple facts may later be aggregated into a
    single Feature if they represent the same underlying request.
    """

    __tablename__ = "extracted_facts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)

    # Source linkage
    normalized_event_id = Column(UUID(as_uuid=True), ForeignKey("normalized_events.id"), nullable=False, index=True)
    chunk_id = Column(UUID(as_uuid=True), ForeignKey("event_chunks.id"), nullable=True, index=True)

    # Original source reference (for audit trail)
    source_type = Column(String(50), nullable=False)  # gmail, slack, gong, fathom
    source_id = Column(String(255), nullable=True)  # Original message/thread/call ID

    # Actor information from source
    actor_name = Column(String(255), nullable=True)
    actor_email = Column(String(255), nullable=True)
    event_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Extracted feature data (Tier-2 structured extraction output)
    feature_title = Column(String(500), nullable=False)
    feature_description = Column(Text, nullable=True)
    problem_statement = Column(Text, nullable=True)  # What problem does user have?
    desired_outcome = Column(Text, nullable=True)  # What do they want to achieve?
    user_persona = Column(String(255), nullable=True)  # Who is requesting? (admin, end-user, etc.)
    use_case = Column(Text, nullable=True)  # Use case description
    priority_hint = Column(String(50), nullable=True)  # low, medium, high, critical
    urgency_hint = Column(String(50), nullable=True)  # low, medium, high, critical
    sentiment = Column(String(50), nullable=True)  # positive, neutral, negative, frustrated
    keywords = Column(JSONB, nullable=True)  # List of extracted keywords

    # AI extraction metadata
    extraction_confidence = Column(Float, nullable=False)  # 0.0 - 1.0
    extraction_model = Column(String(100), nullable=True)  # gpt-4o-mini, etc.
    extraction_prompt_version = Column(String(50), nullable=True)  # For A/B testing prompts

    # Raw AI response (for debugging/auditing)
    raw_ai_response = Column(JSONB, nullable=True)

    # Theme classification
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id"), nullable=True, index=True)
    theme_confidence = Column(Float, nullable=True)

    # Aggregation state
    aggregation_status = Column(String(50), nullable=False, default="pending")
    # Statuses: pending -> processing -> aggregated -> skipped
    aggregation_run_id = Column(UUID(as_uuid=True), ForeignKey("aggregation_runs.id"), nullable=True, index=True)

    # Link to final Feature (set during aggregation)
    feature_id = Column(UUID(as_uuid=True), ForeignKey("features.id"), nullable=True, index=True)
    aggregation_confidence = Column(Float, nullable=True)  # Confidence that this fact matches the feature
    aggregation_reasoning = Column(Text, nullable=True)

    # Deduplication tracking
    content_hash = Column(String(64), nullable=True, index=True)  # Hash of title+description for dedup
    is_duplicate = Column(Boolean, default=False, nullable=False)
    duplicate_of_id = Column(UUID(as_uuid=True), ForeignKey("extracted_facts.id"), nullable=True)

    # Quality flags
    is_valid = Column(Boolean, default=True, nullable=False)  # False if flagged as invalid during review
    quality_score = Column(Float, nullable=True)  # Combined quality metric
    validation_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    aggregated_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="extracted_facts")
    normalized_event = relationship("NormalizedEvent", back_populates="extracted_facts")
    chunk = relationship("EventChunk", back_populates="extracted_facts")
    feature = relationship("Feature", back_populates="extracted_facts")
    theme = relationship("Theme")
    duplicate_of = relationship("ExtractedFact", remote_side=[id], foreign_keys=[duplicate_of_id])

    # Performance indexes
    __table_args__ = (
        Index('idx_extracted_facts_workspace_status', 'workspace_id', 'aggregation_status'),
        Index('idx_extracted_facts_workspace_theme', 'workspace_id', 'theme_id'),
        Index('idx_extracted_facts_pending', 'workspace_id', 'aggregation_status', 'is_valid'),
        Index('idx_extracted_facts_feature', 'feature_id'),
        Index('idx_extracted_facts_confidence', 'extraction_confidence'),
        Index('idx_extracted_facts_hash', 'workspace_id', 'content_hash'),
    )

    def __repr__(self) -> str:
        return f"<ExtractedFact(id={self.id}, title='{self.feature_title[:50]}...', status={self.aggregation_status})>"


class AggregationRun(Base):
    """
    Tracks aggregation runs for auditing and debugging.

    Each time the Tier-3 aggregation task runs, it creates a record
    to track what was processed and the outcomes.
    """

    __tablename__ = "aggregation_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)

    # Run metadata
    status = Column(String(50), nullable=False, default="running")  # running, completed, failed
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Processing stats
    facts_processed = Column(Integer, default=0, nullable=False)
    facts_aggregated = Column(Integer, default=0, nullable=False)
    facts_skipped = Column(Integer, default=0, nullable=False)
    features_created = Column(Integer, default=0, nullable=False)
    features_updated = Column(Integer, default=0, nullable=False)
    duplicates_found = Column(Integer, default=0, nullable=False)

    # Configuration used
    config = Column(JSONB, nullable=True)  # Thresholds, batch sizes, etc.

    # Error tracking
    error_message = Column(Text, nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="aggregation_runs")

    __table_args__ = (
        Index('idx_aggregation_runs_workspace', 'workspace_id'),
        Index('idx_aggregation_runs_status', 'status'),
    )

    def __repr__(self) -> str:
        return f"<AggregationRun(id={self.id}, workspace={self.workspace_id}, status={self.status})>"

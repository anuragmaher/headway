"""
AI Message Insight models for per-message AI analysis.

Provides:
- AIMessageInsight: Stores AI-generated insights for individual messages
- AIInsightsProgress: Tracks workspace-level progress for UI visibility
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Float, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class AIMessageInsight(Base):
    """
    AI-generated insights for individual messages.

    One row per message per model_version.
    Idempotent: never recomputed if completed row exists for same message + model_version.
    """

    __tablename__ = "ai_message_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False, index=True)

    # Model versioning for idempotency
    model_version = Column(String(50), nullable=False, default="v1.0.0")

    # Processing status
    status = Column(String(20), nullable=False, default="queued")
    # Status values: queued | processing | completed | failed

    # AI-generated insights
    themes = Column(JSONB, nullable=True)  # [{theme_id, theme_name, confidence, explanation}]
    summary = Column(Text, nullable=True)  # Short summary of message
    pain_point = Column(Text, nullable=True)  # Extracted pain point with exact customer quotes
    feature_request = Column(Text, nullable=True)  # Extracted feature request (if any)
    customer_usecase = Column(Text, nullable=True)  # What the customer is trying to accomplish
    explanation = Column(Text, nullable=True)  # Why themes apply

    # Additional metadata from AI
    sentiment = Column(String(20), nullable=True)  # positive, negative, neutral
    urgency = Column(String(20), nullable=True)  # low, medium, high, critical
    keywords = Column(JSONB, nullable=True)  # Extracted keywords

    # Locked theme from feature pipeline (canonical, cannot be overridden)
    locked_theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id"), nullable=True)
    locked_theme_name = Column(String(255), nullable=True)

    # Processing metadata
    tokens_used = Column(Integer, nullable=True)
    latency_ms = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Lock token for concurrency control
    lock_token = Column(UUID(as_uuid=True), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    queued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace = relationship("Workspace", backref="ai_message_insights")
    message = relationship("Message", backref="ai_insights_records")
    locked_theme = relationship("Theme", foreign_keys=[locked_theme_id])

    # Unique constraint: one insight per message per model version
    __table_args__ = (
        UniqueConstraint('message_id', 'model_version', name='uix_message_model_version'),
        Index('idx_ai_insights_workspace_status', 'workspace_id', 'status'),
        Index('idx_ai_insights_workspace_created', 'workspace_id', 'created_at'),
        Index('idx_ai_insights_pending', 'workspace_id', 'status', 'retry_count'),
        Index('idx_ai_insights_message', 'message_id'),
        Index('idx_ai_insights_queued_at', 'queued_at'),
    )

    def __repr__(self) -> str:
        return f"<AIMessageInsight(id={self.id}, message={self.message_id}, status={self.status})>"


class AIInsightsProgress(Base):
    """
    Workspace-level progress tracking for AI insights.

    Lightweight table for efficient querying by UI progress bar.
    Updated periodically by background tasks.
    """

    __tablename__ = "ai_insights_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, unique=True)

    # Progress counts (for recent messages, e.g., last 7 days)
    total_eligible = Column(Integer, default=0, nullable=False)
    completed_count = Column(Integer, default=0, nullable=False)
    pending_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    processing_count = Column(Integer, default=0, nullable=False)

    # Rate tracking
    avg_processing_rate_per_hour = Column(Float, nullable=True)  # Messages per hour
    last_rate_calculation = Column(DateTime(timezone=True), nullable=True)

    # Time window for progress calculation
    progress_window_days = Column(Integer, default=7, nullable=False)

    # Feature flag
    ai_insights_enabled = Column(Boolean, default=True, nullable=False)

    # Rate limits (per-workspace)
    rate_limit_per_minute = Column(Integer, default=10, nullable=False)
    rate_limit_per_hour = Column(Integer, default=300, nullable=False)

    # Current rate tracking
    current_minute_count = Column(Integer, default=0, nullable=False)
    current_hour_count = Column(Integer, default=0, nullable=False)
    minute_reset_at = Column(DateTime(timezone=True), nullable=True)
    hour_reset_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace = relationship("Workspace", backref="ai_insights_progress")

    __table_args__ = (
        Index('idx_ai_progress_workspace', 'workspace_id'),
    )

    def __repr__(self) -> str:
        return f"<AIInsightsProgress(workspace={self.workspace_id}, completed={self.completed_count}/{self.total_eligible})>"


class AIInsightsConfig(Base):
    """
    Global configuration for AI insights system.

    Single row table for system-wide settings.
    """

    __tablename__ = "ai_insights_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Feature flag (global kill switch)
    enabled = Column(Boolean, default=True, nullable=False)

    # Global rate limits
    global_rate_limit_per_minute = Column(Integer, default=50, nullable=False)
    global_rate_limit_per_hour = Column(Integer, default=1000, nullable=False)

    # Processing thresholds
    min_signal_score = Column(Float, default=0.3, nullable=False)  # Minimum signal score to process
    max_retry_count = Column(Integer, default=3, nullable=False)

    # Backfill settings
    backfill_batch_size = Column(Integer, default=10, nullable=False)
    backfill_max_age_days = Column(Integer, default=30, nullable=False)

    # Model configuration
    current_model_version = Column(String(50), default="v1.0.0", nullable=False)

    # Current rate tracking
    current_minute_count = Column(Integer, default=0, nullable=False)
    current_hour_count = Column(Integer, default=0, nullable=False)
    minute_reset_at = Column(DateTime(timezone=True), nullable=True)
    hour_reset_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    def __repr__(self) -> str:
        return f"<AIInsightsConfig(enabled={self.enabled}, version={self.current_model_version})>"

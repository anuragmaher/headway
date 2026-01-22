from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class AIInsight(Base):
    """AIInsight model for storing AI-extracted insights per message"""

    __tablename__ = "ai_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Message relationship (required)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)

    # Workspace relationship (denormalized for query efficiency)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)

    # Theme relationships (AI-assigned)
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id", ondelete="SET NULL"), nullable=True)
    sub_theme_id = Column(UUID(as_uuid=True), ForeignKey("sub_themes.id", ondelete="SET NULL"), nullable=True)

    # Customer ask relationship (which feature request this relates to)
    customer_ask_id = Column(UUID(as_uuid=True), ForeignKey("customer_asks.id", ondelete="SET NULL"), nullable=True)

    # AI model info
    model_version = Column(String(50), nullable=True)

    # Extracted insights
    summary = Column(Text, nullable=True)
    pain_point = Column(Text, nullable=True)
    pain_point_quote = Column(Text, nullable=True)  # Direct quote from message
    feature_request = Column(Text, nullable=True)
    customer_usecase = Column(Text, nullable=True)
    sentiment = Column(String(20), nullable=True)  # 'positive', 'negative', 'neutral', 'mixed'
    keywords = Column(JSONB, nullable=True)  # Array of keywords

    # Processing metadata
    tokens_used = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    message = relationship("Message", back_populates="ai_insights")
    workspace = relationship("Workspace", back_populates="ai_insights")
    theme = relationship("Theme", back_populates="ai_insights")
    sub_theme = relationship("SubTheme", back_populates="ai_insights")
    customer_ask = relationship("CustomerAsk", back_populates="ai_insights")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint('message_id', 'model_version', name='uq_ai_insight_message_model'),
        Index('idx_ai_insights_message', 'message_id'),
        Index('idx_ai_insights_workspace', 'workspace_id'),
        Index('idx_ai_insights_theme', 'theme_id'),
        Index('idx_ai_insights_sub_theme', 'sub_theme_id'),
        Index('idx_ai_insights_customer_ask', 'customer_ask_id'),
    )

    def __repr__(self) -> str:
        return f"<AIInsight(id={self.id}, message_id={self.message_id}, sentiment='{self.sentiment}')>"

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Index, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Feature(Base):
    """Feature model representing extracted feature requests"""

    __tablename__ = "features"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, nullable=False, default="medium")  # low, medium, high, critical
    urgency = Column(String, nullable=False, default="medium")  # low, medium, high, critical
    status = Column(String, nullable=False, default="new")  # new, under-review, planned, shipped
    mention_count = Column(Integer, nullable=False, default=1)

    # Workspace and theme relationships
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id"), nullable=True)

    # AI matching confidence and extraction metadata
    match_confidence = Column(Float, nullable=True)  # 0.0-1.0 confidence score from LLM matching
    extraction_index = Column(Integer, nullable=True)  # Order of extraction from message/call (1st, 2nd, 3rd)

    # AI reasoning and metadata (renamed for consistency)
    feature_metadata = Column(JSONB, nullable=True, default=dict)
    ai_metadata = Column(JSONB, nullable=True, default=dict)  # Kept for backwards compatibility

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    first_mentioned_at = Column(DateTime(timezone=True), nullable=True)
    last_mentioned_at = Column(DateTime(timezone=True), nullable=True)
    # Keep old column names for backwards compatibility
    first_mentioned = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_mentioned = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="features")
    theme = relationship("Theme", back_populates="features")
    messages = relationship(
        "Message",
        secondary="feature_messages",
        back_populates="features"
    )
    extracted_facts = relationship("ExtractedFact", back_populates="feature")

    # Indexes for performance
    __table_args__ = (
        Index('idx_features_workspace', 'workspace_id'),
        Index('idx_features_theme', 'theme_id'),
        Index('idx_features_workspace_theme', 'workspace_id', 'theme_id'),
        Index('idx_features_last_mentioned', 'last_mentioned'),
        Index('idx_features_workspace_last_mentioned', 'workspace_id', 'last_mentioned'),
    )

    def __repr__(self) -> str:
        return f"<Feature(id={self.id}, name='{self.name}', mentions={self.mention_count})>"
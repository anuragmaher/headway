from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Index
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
    urgency = Column(String, nullable=False, default="medium")  # low, medium, high, critical
    status = Column(String, nullable=False, default="new")  # new, under-review, planned, shipped
    mention_count = Column(Integer, nullable=False, default=1)

    # Workspace and theme relationships
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
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
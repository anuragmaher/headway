from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Theme(Base):
    """Theme model for categorizing features (Design, Analytics, Security, etc.)"""

    __tablename__ = "themes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    color = Column(String, nullable=False, default="#1976d2")  # Material UI primary blue
    icon = Column(String, nullable=False, default="CategoryIcon")  # Material UI icon name
    sort_order = Column(Integer, nullable=False, default=0)
    is_default = Column(Boolean, default=False, nullable=False)

    # Workspace relationship
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)

    # Hierarchical relationship - self-referencing foreign key
    parent_theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id"), nullable=True)

    # Slack integration for theme notifications
    slack_integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=True)
    slack_channel_id = Column(String, nullable=True)  # Slack channel ID
    slack_channel_name = Column(String, nullable=True)  # Slack channel name (for display)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="themes")
    features = relationship("Feature", back_populates="theme", cascade="all, delete-orphan")
    slack_integration = relationship("Integration", foreign_keys=[slack_integration_id])

    # Hierarchical relationships
    parent_theme = relationship("Theme", remote_side=[id], back_populates="sub_themes")
    sub_themes = relationship("Theme", back_populates="parent_theme", cascade="all, delete-orphan")

    # Indexes for performance
    __table_args__ = (
        Index('idx_themes_workspace', 'workspace_id'),
        Index('idx_themes_workspace_sort', 'workspace_id', 'sort_order'),
        Index('idx_themes_parent', 'parent_theme_id'),
    )

    def __repr__(self) -> str:
        return f"<Theme(id={self.id}, name='{self.name}', workspace_id={self.workspace_id})>"
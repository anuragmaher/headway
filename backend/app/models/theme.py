from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Theme(Base):
    """Theme model for top-level categorization (Design, Analytics, Security, etc.)"""

    __tablename__ = "themes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    # Workspace relationship
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="themes")
    sub_themes = relationship("SubTheme", back_populates="theme", cascade="all, delete-orphan")
    ai_insights = relationship("AIInsight", back_populates="theme")

    # Indexes for performance
    __table_args__ = (
        Index('idx_themes_workspace', 'workspace_id'),
        Index('idx_themes_workspace_sort', 'workspace_id', 'sort_order'),
    )

    def __repr__(self) -> str:
        return f"<Theme(id={self.id}, name='{self.name}', workspace_id={self.workspace_id})>"

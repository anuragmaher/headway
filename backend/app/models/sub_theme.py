from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class SubTheme(Base):
    """SubTheme model for nested categorization under themes"""

    __tablename__ = "sub_themes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    # Parent theme relationship (required)
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id", ondelete="CASCADE"), nullable=False)

    # Workspace relationship (denormalized for query efficiency)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    theme = relationship("Theme", back_populates="sub_themes")
    workspace = relationship("Workspace", back_populates="sub_themes")
    customer_asks = relationship("CustomerAsk", back_populates="sub_theme", cascade="all, delete-orphan")
    transcript_classifications = relationship("TranscriptClassification", back_populates="sub_theme")

    # Indexes for performance
    __table_args__ = (
        Index('idx_sub_themes_theme', 'theme_id'),
        Index('idx_sub_themes_workspace', 'workspace_id'),
        Index('idx_sub_themes_theme_sort', 'theme_id', 'sort_order'),
    )

    def __repr__(self) -> str:
        return f"<SubTheme(id={self.id}, name='{self.name}', theme_id={self.theme_id})>"

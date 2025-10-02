from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
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
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="themes")
    features = relationship("Feature", back_populates="theme", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Theme(id={self.id}, name='{self.name}', workspace_id={self.workspace_id})>"
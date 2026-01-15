"""Competitor model for tracking company competitors"""

from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Competitor(Base):
    """Competitor model for tracking competitors of a workspace"""

    __tablename__ = "competitors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Competitor details
    name = Column(String(255), nullable=False)
    website = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="competitors")
    
    def __repr__(self) -> str:
        return f"<Competitor(id={self.id}, name='{self.name}', workspace_id={self.workspace_id})>"

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Integration(Base):
    """Integration model for external services (Slack, Gmail, etc.)"""
    
    __tablename__ = "integrations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)  # "slack", "gmail", etc.
    provider = Column(String, nullable=False)  # "slack", "google", etc.
    is_active = Column(Boolean, default=True, nullable=False)
    
    # OAuth tokens (encrypted in production)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Provider-specific metadata
    provider_metadata = Column(JSONB, nullable=True)  # Store selected channels, team info, etc.
    
    # External identifiers
    external_user_id = Column(String, nullable=True)
    external_team_id = Column(String, nullable=True)
    external_team_name = Column(String, nullable=True)
    
    # Workspace relationship
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Sync status
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_status = Column(String, default="pending", nullable=False)  # pending, syncing, success, error
    sync_error = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="integrations")
    messages = relationship("Message", back_populates="integration", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Integration(id={self.id}, provider='{self.provider}', team='{self.external_team_name}')>"
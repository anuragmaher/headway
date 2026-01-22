from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, UniqueConstraint, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum
import uuid

from app.core.database import Base


class ConnectorType(str, Enum):
    """Enum for supported connector types"""
    SLACK = "slack"
    GMAIL = "gmail"
    GONG = "gong"
    FATHOM = "fathom"
    INTERCOM = "intercom"
    ZENDESK = "zendesk"
    MANUAL = "manual"


class WorkspaceConnector(Base):
    """Unified connector model for all data sources (Slack, Gmail, Gong, Fathom, etc.)"""

    __tablename__ = "workspace_connectors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Workspace relationship
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)

    # User who connected this source
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Connector type
    connector_type = Column(String(50), nullable=False)  # 'slack', 'gmail', 'gong', 'fathom', 'intercom'

    # Display info
    name = Column(String(255), nullable=True)  # "Acme Slack Workspace", "john@acme.com"

    # OAuth tokens (for Slack, Gmail)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Generic credentials (for API-key based connectors like Gong)
    credentials = Column(JSONB, nullable=True)

    # External identifiers
    external_id = Column(String(255), nullable=True)  # Slack team_id, Gmail email
    external_name = Column(String(255), nullable=True)  # Slack team name, Gmail display name

    # Connector-specific config (channels, labels, filters)
    config = Column(JSONB, nullable=True)

    # Sync status
    is_active = Column(Boolean, default=True, nullable=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_status = Column(String(50), default="pending", nullable=False)  # 'pending', 'syncing', 'success', 'error'
    sync_error = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="workspace_connectors")
    user = relationship("User")
    messages = relationship("Message", back_populates="connector", cascade="all, delete-orphan")
    connector_labels = relationship("ConnectorLabel", back_populates="connector", cascade="all, delete-orphan")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint('workspace_id', 'connector_type', 'external_id', name='uq_workspace_connector_external'),
        Index('idx_workspace_connectors_workspace', 'workspace_id'),
        Index('idx_workspace_connectors_type', 'connector_type'),
        Index('idx_workspace_connectors_workspace_type', 'workspace_id', 'connector_type'),
    )

    def __repr__(self) -> str:
        return f"<WorkspaceConnector(id={self.id}, type='{self.connector_type}', workspace_id={self.workspace_id})>"

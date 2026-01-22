from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class ConnectorLabel(Base):
    """ConnectorLabel model for tracking Gmail labels, Slack channels, etc."""

    __tablename__ = "connector_labels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Connector relationship
    connector_id = Column(UUID(as_uuid=True), ForeignKey("workspace_connectors.id", ondelete="CASCADE"), nullable=False)

    # Label information
    label_id = Column(String(255), nullable=False)  # Gmail label ID, Slack channel ID
    label_name = Column(String(255), nullable=True)  # Display name

    # Whether this label is enabled for syncing
    is_enabled = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    connector = relationship("WorkspaceConnector", back_populates="connector_labels")

    # Indexes
    __table_args__ = (
        Index('idx_connector_labels_connector', 'connector_id'),
        Index('idx_connector_labels_enabled', 'connector_id', 'is_enabled'),
    )

    def __repr__(self) -> str:
        return f"<ConnectorLabel(id={self.id}, label_name='{self.label_name}', is_enabled={self.is_enabled})>"

"""
SyncHistory model for tracking data source and theme synchronization history
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.core.database import Base


class SyncType(str, enum.Enum):
    """Type of sync operation"""
    SOURCE = "source"
    THEME = "theme"


class SyncStatus(str, enum.Enum):
    """Status of sync operation"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"


class TriggerType(str, enum.Enum):
    """How the sync was triggered"""
    MANUAL = "manual"  # User-initiated on-demand sync
    PERIODIC = "periodic"  # Celery scheduled periodic sync


class SyncHistory(Base):
    """
    Model for tracking synchronization history of data sources and themes.
    
    Records when syncs started, their status, how many items were processed,
    and links to relevant sources/themes.
    """
    
    __tablename__ = "sync_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    
    # Sync type: 'source' for data source sync, 'theme' for theme processing
    sync_type = Column(String, nullable=False)  # 'source' or 'theme'
    
    # Source information (for source syncs)
    source_type = Column(String, nullable=True)  # 'gmail', 'slack', 'gong', 'fathom'
    source_name = Column(String, nullable=True)  # Display name
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=True)
    gmail_account_id = Column(UUID(as_uuid=True), ForeignKey("gmail_accounts.id"), nullable=True)
    connector_id = Column(UUID(as_uuid=True), ForeignKey("workspace_connectors.id"), nullable=True)
    
    # Theme information (for theme syncs)
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id"), nullable=True)
    theme_name = Column(String, nullable=True)
    # Source types that contributed to this theme sync (stored as JSON array)
    theme_sources = Column(JSONB, nullable=True)  # ['gmail', 'slack', 'gong']
    
    # Sync status
    status = Column(String, nullable=False, default="pending")  # pending, in_progress, success, failed
    error_message = Column(Text, nullable=True)

    # Trigger type: how the sync was initiated
    trigger_type = Column(String, nullable=False, default="manual")  # 'manual' or 'periodic'
    
    # Metrics
    items_processed = Column(Integer, nullable=False, default=0)
    items_new = Column(Integer, nullable=False, default=0)
    items_updated = Column(Integer, nullable=False, default=0)
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="sync_history", lazy='select')
    integration = relationship("Integration", foreign_keys=[integration_id], lazy='select')
    gmail_account = relationship("GmailAccounts", foreign_keys=[gmail_account_id], lazy='select')
    connector = relationship("WorkspaceConnector", foreign_keys=[connector_id], lazy='select')
    theme = relationship("Theme", foreign_keys=[theme_id], lazy='select')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_sync_history_workspace', 'workspace_id'),
        Index('idx_sync_history_workspace_type', 'workspace_id', 'sync_type'),
        Index('idx_sync_history_workspace_started', 'workspace_id', 'started_at'),
        Index('idx_sync_history_status', 'status'),
        Index('idx_sync_history_trigger_type', 'trigger_type'),
    )
    
    def __repr__(self) -> str:
        return f"<SyncHistory(id={self.id}, type='{self.sync_type}', status='{self.status}')>"
    
    def mark_in_progress(self) -> None:
        """Mark sync as in progress"""
        self.status = SyncStatus.IN_PROGRESS.value
    
    def mark_success(self, processed: int = 0, new: int = 0, updated: int = 0) -> None:
        """Mark sync as successful with metrics"""
        from datetime import datetime, timezone
        self.status = SyncStatus.SUCCESS.value
        self.completed_at = datetime.now(timezone.utc)
        self.items_processed = processed
        self.items_new = new
        self.items_updated = updated
    
    def mark_failed(self, error: str) -> None:
        """Mark sync as failed with error message"""
        from datetime import datetime, timezone
        self.status = SyncStatus.FAILED.value
        self.completed_at = datetime.now(timezone.utc)
        self.error_message = error

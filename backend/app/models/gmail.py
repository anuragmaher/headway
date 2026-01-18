from sqlalchemy import Column, String, DateTime, ForeignKey, Index, Boolean, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base

class GmailAccounts(Base):

    __tablename__ = "gmail_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True)
    gmail_email = Column(String, nullable=False, unique=True)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    token_expiry = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Sync status
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_status = Column(String, default="pending", nullable=False)  # pending, syncing, success, error
    sync_error = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="gmail_accounts")
    workspace = relationship("Workspace", back_populates="gmail_accounts")
    labels = relationship("GmailLabels", back_populates="gmail_account", cascade="all, delete-orphan")
    threads = relationship("GmailThread", back_populates="gmail_account", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_gmail_accounts_user', 'user_id'),
        Index('idx_gmail_accounts_workspace', 'workspace_id'),
    )

    def __repr__(self) -> str:
        return f"<GmailAccount(id={self.id}, user_id={self.user_id})>"


class GmailLabels(Base):

    __tablename__ = "gmail_labels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    gmail_account_id = Column(UUID(as_uuid=True), ForeignKey("gmail_accounts.id"), nullable=False)
    label_id = Column(String, nullable=False)
    label_name = Column(String, nullable=False)
    watch_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    gmail_account = relationship("GmailAccounts", back_populates="labels")

    # Indexes for performance
    __table_args__ = (
        Index('idx_gmail_labels_gmail_account', 'gmail_account_id'),
    )

    def __repr__(self) -> str:
        return f"<GmailLabel(id={self.id}, label_id={self.label_id})>"


class GmailThread(Base):
    """Model for storing Gmail threads fetched for AI ingestion"""
    
    __tablename__ = "gmail_threads"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    gmail_account_id = Column(UUID(as_uuid=True), ForeignKey("gmail_accounts.id"), nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    
    # Gmail thread identifiers
    thread_id = Column(String, nullable=False, index=True)  # Gmail thread ID
    label_id = Column(String, nullable=False)  # Label this thread belongs to
    label_name = Column(String, nullable=True)
    
    # Thread metadata
    subject = Column(String(500), nullable=True)
    snippet = Column(String(500), nullable=True)  # Preview snippet
    from_email = Column(String(255), nullable=True)
    from_name = Column(String(255), nullable=True)
    to_emails = Column(Text, nullable=True)  # Can be long list of recipients
    
    # Full thread content (all messages concatenated)
    content = Column(Text, nullable=True)  # Use Text for large email content
    message_count = Column(Integer, nullable=True)  # Number of messages in thread
    
    # Timestamps from Gmail
    thread_date = Column(DateTime(timezone=True), nullable=True)  # Date of latest message
    
    # Processing status for AI ingestion
    is_processed = Column(Boolean, default=False, nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    ai_insights = Column(JSONB, nullable=True)  # AI-extracted insights

    # AI Processing state management
    ai_processed_at = Column(DateTime(timezone=True), nullable=True)
    ai_processing_error = Column(Text, nullable=True)
    ai_processing_retry_count = Column(Integer, default=0, nullable=False)
    processing_lock_token = Column(String(36), nullable=True)
    processing_locked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    gmail_account = relationship("GmailAccounts", back_populates="threads")
    workspace = relationship("Workspace", back_populates="gmail_threads")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_gmail_threads_account', 'gmail_account_id'),
        Index('idx_gmail_threads_workspace', 'workspace_id'),
        Index('idx_gmail_threads_thread_id', 'thread_id'),
        Index('idx_gmail_threads_processed', 'is_processed'),
    )
    
    def __repr__(self) -> str:
        return f"<GmailThread(id={self.id}, thread_id={self.thread_id}, subject={self.subject})>"
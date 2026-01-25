from typing import List, TYPE_CHECKING

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Index, Integer, Float, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.customer_ask import CustomerAsk


class Message(Base):
    """Unified message model for storing content from all sources (Slack, Gmail, Gong, etc.)"""

    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Workspace relationship
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)

    # Connector relationship (which data source this came from)
    connector_id = Column(UUID(as_uuid=True), ForeignKey("workspace_connectors.id", ondelete="CASCADE"), nullable=False)

    # Customer ask relationship (DEPRECATED - use customer_ask_links for many-to-many)
    # Kept for backward compatibility during migration
    customer_ask_id = Column(UUID(as_uuid=True), ForeignKey("customer_asks.id", ondelete="SET NULL"), nullable=True)

    # Customer relationship (who sent this message)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)

    # Source identification
    source = Column(String(50), nullable=False)  # 'slack', 'gmail', 'gong', 'fathom', 'intercom'
    external_id = Column(String(255), nullable=False)  # Slack message ID, Gmail thread ID, etc.
    thread_id = Column(String(255), nullable=True)

    # Content
    content = Column(Text, nullable=False)
    title = Column(String(500), nullable=True)  # Email subject, call title, etc.

    # Channel/Label info
    channel_name = Column(String(255), nullable=True)  # Slack channel name, Gmail label name
    channel_id = Column(String(255), nullable=True)
    label_name = Column(String(255), nullable=True)  # Gmail label

    # Author info
    author_name = Column(String(255), nullable=True)
    author_email = Column(String(255), nullable=True)
    author_id = Column(String(255), nullable=True)

    # Email-specific fields (merged from gmail_threads)
    from_email = Column(String(255), nullable=True)
    to_emails = Column(Text, nullable=True)  # Comma-separated
    message_count = Column(Integer, default=1, nullable=False)  # For email threads

    # Metadata
    message_metadata = Column(JSONB, nullable=True)  # Reactions, attachments, thread info, etc.

    # Processing status - Tiered AI pipeline
    # tier1_processed: True after Tier 1 classification completes (feature_score stored)
    # tier2_processed: True after Tier 2 extraction completes (CustomerAsk linked)
    tier1_processed = Column(Boolean, default=False, nullable=False)
    tier2_processed = Column(Boolean, default=False, nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    feature_score = Column(Float, nullable=True)  # AI relevance score (0-10 from Tier 1)

    # Timestamps
    sent_at = Column(DateTime(timezone=True), nullable=True)  # Original message time
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="messages")
    connector = relationship("WorkspaceConnector", back_populates="messages")
    customer_ask = relationship("CustomerAsk", back_populates="messages")  # DEPRECATED - use customer_ask_links
    customer = relationship("Customer", back_populates="messages")

    # NEW: Many-to-many relationship via junction table
    # One message can link to multiple CustomerAsks (e.g., call transcript with multiple features)
    customer_ask_links = relationship(
        "MessageCustomerAsk",
        back_populates="message",
        cascade="all, delete-orphan",
        lazy="dynamic"  # Use dynamic for efficient querying
    )

    @property
    def customer_asks(self) -> List["CustomerAsk"]:
        """Get all linked CustomerAsks via junction table."""
        return [link.customer_ask for link in self.customer_ask_links]

    @property
    def primary_customer_ask(self) -> "CustomerAsk | None":
        """Get the primary (first) CustomerAsk link for this message."""
        primary_link = self.customer_ask_links.filter_by(is_primary=True).first()
        return primary_link.customer_ask if primary_link else None

    # Indexes and constraints
    # Note: Partial indexes for tier processing are created in migration 0006
    # - idx_messages_tier1_processed: Partial index for tier1_processed=False
    # - idx_messages_tier2_pending: Partial index for tier2_processed=False AND feature_score >= 6
    __table_args__ = (
        UniqueConstraint('workspace_id', 'connector_id', 'external_id', name='uq_message_external'),
        Index('idx_messages_workspace', 'workspace_id'),
        Index('idx_messages_connector', 'connector_id'),
        Index('idx_messages_customer_ask', 'customer_ask_id'),
        Index('idx_messages_customer', 'customer_id'),
        Index('idx_messages_workspace_sent', 'workspace_id', 'sent_at'),
        Index('idx_messages_source', 'source'),
    )

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, source='{self.source}', connector_id={self.connector_id})>"

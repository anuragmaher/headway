"""
MessageCustomerAsk - Junction table for many-to-many Message <-> CustomerAsk relationship.

This enables a single message (e.g., a call transcript with multiple feature requests)
to be linked to multiple CustomerAsks. Each chunk from a long message can create
its own CustomerAsk link.

Example:
- A 30-min Gong call is chunked into 5 segments
- Chunk 1 discusses "Dashboard Export" feature
- Chunk 3 discusses "Mobile App" feature
- Result: The message links to BOTH CustomerAsks via this junction table
"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Float, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class MessageCustomerAsk(Base):
    """Junction table for many-to-many relationship between messages and customer asks."""

    __tablename__ = "message_customer_asks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign keys
    message_id = Column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False
    )
    customer_ask_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customer_asks.id", ondelete="CASCADE"),
        nullable=False
    )

    # Metadata about this specific link
    extraction_confidence = Column(Float, nullable=True)  # AI confidence for this extraction
    match_reason = Column(String(50), nullable=True)  # "matched_existing" or "created_new"
    is_primary = Column(Boolean, default=False, nullable=False)  # First link for this message
    chunk_id = Column(
        UUID(as_uuid=True),
        ForeignKey("event_chunks.id", ondelete="SET NULL"),
        nullable=True
    )  # Which chunk created this link (null for non-chunked messages)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    message = relationship("Message", back_populates="customer_ask_links")
    customer_ask = relationship("CustomerAsk", back_populates="message_links")

    # Indexes and constraints
    __table_args__ = (
        # Prevent duplicate links
        UniqueConstraint('message_id', 'customer_ask_id', name='uq_message_customer_ask'),
        # Index for querying by message
        Index('idx_mca_message', 'message_id'),
        # Index for querying by customer_ask (used in mentions API)
        Index('idx_mca_customer_ask', 'customer_ask_id'),
        # Index for finding primary links
        Index('idx_mca_primary', 'message_id', 'is_primary'),
    )

    def __repr__(self) -> str:
        return f"<MessageCustomerAsk(message_id={self.message_id}, customer_ask_id={self.customer_ask_id}, is_primary={self.is_primary})>"

from typing import List, TYPE_CHECKING

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.message import Message


class CustomerAsk(Base):
    """CustomerAsk model representing feature requests extracted from messages"""

    __tablename__ = "customer_asks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)

    # Sub-theme relationship (required - every customer ask must belong to a sub_theme)
    sub_theme_id = Column(UUID(as_uuid=True), ForeignKey("sub_themes.id", ondelete="CASCADE"), nullable=False)

    # Workspace relationship (denormalized for query efficiency)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)

    # Priority and urgency
    urgency = Column(String(20), default="medium", nullable=False)  # 'low', 'medium', 'high', 'critical'
    status = Column(String(50), default="new", nullable=False)  # 'new', 'under_review', 'planned', 'shipped'

    # AI extraction metadata
    match_confidence = Column(Float, nullable=True)
    mention_count = Column(Integer, default=0, nullable=False)
    extraction_index = Column(Integer, nullable=True)
    ai_metadata = Column(JSONB, nullable=True)

    # Mention timestamps
    first_mentioned_at = Column(DateTime(timezone=True), nullable=True)
    last_mentioned_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    sub_theme = relationship("SubTheme", back_populates="customer_asks")
    workspace = relationship("Workspace", back_populates="customer_asks")
    messages = relationship("Message", back_populates="customer_ask")  # DEPRECATED - use message_links

    # NEW: Many-to-many relationship via junction table
    # One CustomerAsk can have multiple messages linked (mentions)
    message_links = relationship(
        "MessageCustomerAsk",
        back_populates="customer_ask",
        cascade="all, delete-orphan",
        lazy="dynamic"  # Use dynamic for efficient querying
    )

    @property
    def linked_messages(self) -> List["Message"]:
        """Get all linked Messages via junction table."""
        return [link.message for link in self.message_links]

    @property
    def linked_message_count(self) -> int:
        """Get count of linked messages via junction table."""
        return self.message_links.count()

    # Indexes for performance
    __table_args__ = (
        Index('idx_customer_asks_sub_theme', 'sub_theme_id'),
        Index('idx_customer_asks_workspace', 'workspace_id'),
        Index('idx_customer_asks_workspace_status', 'workspace_id', 'status'),
        Index('idx_customer_asks_last_mentioned', 'last_mentioned_at'),
    )

    def __repr__(self) -> str:
        return f"<CustomerAsk(id={self.id}, name='{self.name}', sub_theme_id={self.sub_theme_id})>"

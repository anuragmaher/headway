from sqlalchemy import Column, String, DateTime, ForeignKey, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base

class GmailAccounts(Base):

    __tablename__ = "gmail_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    gmail_email = Column(String, nullable=False, unique=True)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    token_expiry = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="gmail_accounts")

    # Indexes for performance
    __table_args__ = (
        Index('idx_gmail_accounts_user', 'user_id'),
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
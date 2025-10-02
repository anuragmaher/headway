from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base

# Association table for many-to-many relationship between features and messages
feature_messages = Table(
    'feature_messages',
    Base.metadata,
    Column('feature_id', UUID(as_uuid=True), ForeignKey('features.id'), primary_key=True),
    Column('message_id', UUID(as_uuid=True), ForeignKey('messages.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False)
)


class Message(Base):
    """Message model for storing messages from external sources (Slack, email, etc.)"""
    
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    external_id = Column(String, nullable=False, index=True)  # Slack message ID, email ID, etc.
    content = Column(Text, nullable=False)
    source = Column(String, nullable=False)  # "slack", "email", etc.
    channel_name = Column(String, nullable=True)  # Slack channel, email folder, etc.
    channel_id = Column(String, nullable=True)
    
    # Author information
    author_name = Column(String, nullable=True)
    author_id = Column(String, nullable=True)
    author_email = Column(String, nullable=True)
    
    # Message metadata
    message_metadata = Column(JSONB, nullable=True)  # Reactions, thread info, attachments, etc.
    thread_id = Column(String, nullable=True)
    is_thread_reply = Column(Boolean, default=False, nullable=False)
    
    # Processing status
    is_processed = Column(Boolean, default=False, nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=False)  # Original message timestamp
    
    # Relationships
    workspace = relationship("Workspace", back_populates="messages")
    integration = relationship("Integration", back_populates="messages")
    features = relationship(
        "Feature",
        secondary=feature_messages,
        back_populates="messages"
    )
    
    def __repr__(self) -> str:
        return f"<Message(id={self.id}, source='{self.source}', channel='{self.channel_name}')>"
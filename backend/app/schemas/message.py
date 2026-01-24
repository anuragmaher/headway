"""
Schemas for Messages and AI Insights
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class SourceType(str, Enum):
    """Message source types"""
    SLACK = "slack"
    GMAIL = "gmail"
    GONG = "gong"
    FATHOM = "fathom"
    INTERCOM = "intercom"


class SentimentType(str, Enum):
    """Sentiment analysis results"""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    FRUSTRATED = "frustrated"


# === Message Schemas ===

class MessageBase(BaseModel):
    """Base schema for messages"""
    source: SourceType
    external_id: str
    content: str
    title: Optional[str] = None
    thread_id: Optional[str] = None
    channel_name: Optional[str] = None
    channel_id: Optional[str] = None
    label_name: Optional[str] = None
    author_name: Optional[str] = None
    author_email: Optional[str] = None
    author_id: Optional[str] = None
    sent_at: Optional[datetime] = None


class MessageCreate(MessageBase):
    """Schema for creating a message"""
    connector_id: UUID
    customer_ask_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    from_email: Optional[str] = None
    to_emails: Optional[str] = None
    message_count: int = 1
    message_metadata: Optional[Dict[str, Any]] = None


class MessageUpdate(BaseModel):
    """Schema for updating a message"""
    customer_ask_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    tier1_processed: Optional[bool] = None
    tier2_processed: Optional[bool] = None
    feature_score: Optional[float] = None


class MessageResponse(MessageBase):
    """Schema for message response"""
    id: UUID
    workspace_id: UUID
    connector_id: UUID
    customer_ask_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    from_email: Optional[str] = None
    to_emails: Optional[str] = None
    message_count: int = 1
    message_metadata: Optional[Dict[str, Any]] = None
    tier1_processed: bool = False
    tier2_processed: bool = False
    processed_at: Optional[datetime] = None
    feature_score: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageWithInsights(MessageResponse):
    """Message with AI insights"""
    ai_insights: Optional["AIInsightResponse"] = None
    customer_ask: Optional["CustomerAskSummary"] = None


class MessageListResponse(BaseModel):
    """List of messages"""
    messages: List[MessageResponse]
    total: int
    page: int = 1
    page_size: int = 50


# === AI Insight Schemas ===

class AIInsightBase(BaseModel):
    """Base schema for AI insights"""
    model_version: Optional[str] = None
    summary: Optional[str] = None
    pain_point: Optional[str] = None
    pain_point_quote: Optional[str] = None
    feature_request: Optional[str] = None
    customer_usecase: Optional[str] = None
    sentiment: Optional[SentimentType] = None
    keywords: Optional[List[str]] = None


class AIInsightCreate(AIInsightBase):
    """Schema for creating an AI insight"""
    message_id: UUID
    theme_id: Optional[UUID] = None
    sub_theme_id: Optional[UUID] = None
    customer_ask_id: Optional[UUID] = None
    tokens_used: Optional[int] = None


class AIInsightResponse(AIInsightBase):
    """Schema for AI insight response"""
    id: UUID
    message_id: UUID
    workspace_id: UUID
    theme_id: Optional[UUID] = None
    sub_theme_id: Optional[UUID] = None
    customer_ask_id: Optional[UUID] = None
    tokens_used: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AIInsightListResponse(BaseModel):
    """List of AI insights"""
    insights: List[AIInsightResponse]
    total: int


# === Summary schemas for nested responses ===

class CustomerAskSummary(BaseModel):
    """Summary of customer ask for nested responses"""
    id: UUID
    name: str
    urgency: str
    status: str

    class Config:
        from_attributes = True


# === Sync History Schemas ===

class SyncType(str, Enum):
    """Type of sync operation"""
    SOURCE = "source"
    THEME = "theme"


class SyncStatus(str, Enum):
    """Status of sync operation"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"


class TriggerType(str, Enum):
    """How the sync was triggered"""
    MANUAL = "manual"
    PERIODIC = "periodic"


class SyncHistoryResponse(BaseModel):
    """Schema for sync history response"""
    id: UUID
    workspace_id: UUID
    sync_type: str
    source_type: Optional[str] = None
    source_name: Optional[str] = None
    connector_id: Optional[UUID] = None
    theme_id: Optional[UUID] = None
    theme_name: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    trigger_type: str
    items_processed: int = 0
    items_new: int = 0
    items_updated: int = 0
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SyncHistoryListResponse(BaseModel):
    """List of sync history"""
    history: List[SyncHistoryResponse]
    total: int


# Update forward references
MessageWithInsights.model_rebuild()

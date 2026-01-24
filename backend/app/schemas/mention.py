"""
Schemas for Mentions (Messages linked to CustomerAsks with AI insights)

Supports many-to-many relationship where one message can link to multiple CustomerAsks.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class LinkedCustomerAsk(BaseModel):
    """Minimal CustomerAsk info for displaying in mention UI with full hierarchy"""
    id: UUID
    name: str
    sub_theme_id: Optional[UUID] = None
    sub_theme_name: Optional[str] = None
    theme_id: Optional[UUID] = None
    theme_name: Optional[str] = None

    class Config:
        from_attributes = True


class AIInsightResponse(BaseModel):
    """AI insight data for a mention"""
    id: UUID
    message_id: UUID
    model_version: Optional[str] = None
    summary: Optional[str] = None
    pain_point: Optional[str] = None
    pain_point_quote: Optional[str] = None
    feature_request: Optional[str] = None
    customer_usecase: Optional[str] = None
    sentiment: Optional[str] = None
    keywords: Optional[List[str]] = None
    tokens_used: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MentionResponse(BaseModel):
    """Response schema for a mention (message with AI insights)

    Supports many-to-many: one message can link to multiple CustomerAsks.
    - customer_ask_id: The current/context CustomerAsk (the one whose mentions we're viewing)
    - customer_ask_ids: ALL CustomerAsk IDs this message is linked to
    - linked_customer_asks: Full info for UI display (names, sub_theme names)
    """
    id: UUID
    customer_ask_id: Optional[UUID] = None  # Current context (which CustomerAsk we're viewing)
    customer_ask_ids: List[UUID] = []  # ALL linked CustomerAsk IDs (for filtering/navigation)
    linked_customer_asks: List[LinkedCustomerAsk] = []  # Full info for UI display
    workspace_id: UUID
    source: str
    external_id: str
    thread_id: Optional[str] = None
    content: str
    title: Optional[str] = None
    channel_name: Optional[str] = None
    label_name: Optional[str] = None
    author_name: Optional[str] = None
    author_email: Optional[str] = None
    from_email: Optional[str] = None
    to_emails: Optional[str] = None
    message_count: int = 1
    sent_at: Optional[datetime] = None
    tier1_processed: bool = False
    tier2_processed: bool = False
    ai_insights: Optional[AIInsightResponse] = None

    class Config:
        from_attributes = True


class MentionListResponse(BaseModel):
    """List response for mentions"""
    mentions: List[MentionResponse]
    total: int
    has_more: bool = False
    next_cursor: Optional[str] = None

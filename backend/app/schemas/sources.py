"""
Schemas for Sources API endpoints
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class SourceType(str, Enum):
    """Supported data source types"""
    GMAIL = "gmail"
    SLACK = "slack"
    GONG = "gong"
    FATHOM = "fathom"
    OUTLOOK = "outlook"


class MessageType(str, Enum):
    """Types of messages"""
    EMAIL = "email"
    TRANSCRIPT = "transcript"
    MEETING = "meeting"
    SLACK = "slack"


class SyncType(str, Enum):
    """Types of sync operations"""
    SOURCE = "source"
    THEME = "theme"


class SyncStatus(str, Enum):
    """Status of sync operations"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"


class TriggerType(str, Enum):
    """How the sync was triggered"""
    MANUAL = "manual"  # User-initiated on-demand sync
    PERIODIC = "periodic"  # Celery scheduled periodic sync


# ============ Message Schemas ============

class MessageAIInsight(BaseModel):
    """Embedded AI insight data for message list view"""
    id: str
    summary: Optional[str] = None
    pain_point: Optional[str] = None
    pain_point_quote: Optional[str] = None
    feature_request: Optional[str] = None
    customer_usecase: Optional[str] = None
    sentiment: Optional[str] = None
    keywords: List[str] = []
    model_version: Optional[str] = None
    tokens_used: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Response schema for a single message"""
    id: str
    title: Optional[str] = None
    sender: Optional[str] = None
    sender_email: Optional[str] = None
    source_type: str  # email, transcript, meeting, slack
    source: str  # gmail, slack, gong, fathom
    preview: Optional[str] = None
    content: Optional[str] = None
    timestamp: datetime
    channel_name: Optional[str] = None
    tier1_processed: bool = False
    tier2_processed: bool = False
    ai_insights: Optional[MessageAIInsight] = None  # Included when fetching with insights

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    """Paginated response for messages list"""
    messages: List[MessageResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


# ============ Sync History Schemas ============

class SyncHistoryResponse(BaseModel):
    """Response schema for a single sync history entry"""
    id: str
    sync_type: str  # 'source' or 'theme'
    source_type: Optional[str] = None  # gmail, slack, gong, fathom
    source_name: Optional[str] = None
    theme_name: Optional[str] = None
    theme_sources: Optional[List[str]] = None  # Sources that contributed to theme
    status: str  # pending, in_progress, success, failed
    trigger_type: str = "manual"  # 'manual' (user-initiated) or 'periodic' (celery scheduled)
    started_at: datetime
    completed_at: Optional[datetime] = None
    items_processed: int = 0
    items_new: int = 0
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class SyncHistoryListResponse(BaseModel):
    """Paginated response for sync history list"""
    items: List[SyncHistoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


# ============ Sync Operation Schemas ============

class SyncSourceRequest(BaseModel):
    """Request to sync a specific data source"""
    source_type: Optional[str] = None  # If None, sync all sources
    hours_back: int = Field(default=24, ge=1, le=168)  # 1-168 hours (1 week max)


class SyncThemeRequest(BaseModel):
    """Request to sync/update themes"""
    theme_ids: Optional[List[str]] = None  # If None, sync all themes
    reprocess_all: bool = False  # If True, reprocess all messages


class SyncOperationResponse(BaseModel):
    """Response for sync operation initiation"""
    sync_id: str
    status: str
    message: str
    source_type: Optional[str] = None
    estimated_items: Optional[int] = None
    task_id: Optional[str] = None  # Celery task ID for tracking


class SyncAllSourcesResponse(BaseModel):
    """Response for syncing all data sources"""
    message: str
    sync_operations: List[SyncOperationResponse]
    total_sources: int


class SyncThemesResponse(BaseModel):
    """Response for syncing themes"""
    message: str
    sync_id: str
    status: str
    themes_to_process: int
    task_id: Optional[str] = None  # Celery task ID for tracking


# ============ Data Source Status Schemas ============

class DataSourceStatus(BaseModel):
    """Status of a connected data source"""
    source_type: str
    source_name: str
    is_active: bool
    last_synced_at: Optional[datetime] = None
    sync_status: Optional[str] = None
    message_count: int = 0


class DataSourcesStatusResponse(BaseModel):
    """Response with status of all connected data sources"""
    sources: List[DataSourceStatus]
    total_messages: int
    last_sync_at: Optional[datetime] = None


# ============ AI Insights Schemas ============

class AIInsightsTheme(BaseModel):
    """Theme assigned to a message by AI insights"""
    theme_id: str
    theme_name: str
    confidence: float
    explanation: Optional[str] = None


class LinkedCustomerAskInfo(BaseModel):
    """Customer ask linked to this message for displaying in UI"""
    id: str
    name: str
    sub_theme_id: Optional[str] = None
    sub_theme_name: Optional[str] = None
    theme_id: Optional[str] = None
    theme_name: Optional[str] = None


class AIInsightsResponse(BaseModel):
    """AI insights for a single message"""
    id: str
    message_id: str
    status: str  # queued, processing, completed, failed
    themes: Optional[List[AIInsightsTheme]] = None
    summary: Optional[str] = None
    pain_point: Optional[str] = None
    pain_point_quote: Optional[str] = None  # Direct quote from message
    feature_request: Optional[str] = None
    customer_usecase: Optional[str] = None  # Use case extracted by AI
    explanation: Optional[str] = None
    sentiment: Optional[str] = None
    urgency: Optional[str] = None
    keywords: Optional[List[str]] = None
    locked_theme_id: Optional[str] = None
    locked_theme_name: Optional[str] = None
    linked_customer_asks: List[LinkedCustomerAskInfo] = []  # Customer asks linked to this message
    model_version: str
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class AIInsightsProgressResponse(BaseModel):
    """Workspace-level AI insights progress for UI progress bar"""
    workspace_id: str
    # Progress counts (for recent messages)
    total_eligible: int
    completed_count: int
    pending_count: int
    processing_count: int
    failed_count: int
    # Computed fields
    percent_complete: float  # 0.0 - 100.0
    # Rate information
    avg_processing_rate_per_hour: Optional[float] = None
    estimated_time_remaining_minutes: Optional[float] = None
    # Time window
    progress_window_days: int = 7
    # Feature flag
    ai_insights_enabled: bool = True
    # Timestamps
    last_sync_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QueueInsightsRequest(BaseModel):
    """Request to queue a message for AI insights"""
    message_id: str
    priority: int = Field(default=5, ge=1, le=10, description="Priority 1-10, lower = higher priority")


class QueueInsightsResponse(BaseModel):
    """Response for queue insights request"""
    status: str
    message_id: str
    insight_id: Optional[str] = None
    error: Optional[str] = None



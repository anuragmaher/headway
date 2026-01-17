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


# ============ Message Schemas ============

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
    is_processed: bool = False

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

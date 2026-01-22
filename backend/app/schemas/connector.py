"""
Schemas for WorkspaceConnector (unified connector for Slack, Gmail, Gong, Fathom, etc.)
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class ConnectorType(str, Enum):
    """Supported connector types"""
    SLACK = "slack"
    GMAIL = "gmail"
    GONG = "gong"
    FATHOM = "fathom"
    INTERCOM = "intercom"


class SyncStatus(str, Enum):
    """Connector sync status"""
    PENDING = "pending"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"


# === Base Schemas ===

class ConnectorLabelBase(BaseModel):
    """Base schema for connector labels (Gmail labels, Slack channels, etc.)"""
    label_id: str
    label_name: Optional[str] = None
    is_enabled: bool = False


class ConnectorLabelCreate(ConnectorLabelBase):
    """Schema for creating a connector label"""
    pass


class ConnectorLabelResponse(ConnectorLabelBase):
    """Schema for connector label response"""
    id: UUID
    connector_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ConnectorBase(BaseModel):
    """Base schema for workspace connectors"""
    connector_type: ConnectorType
    name: Optional[str] = None
    external_id: Optional[str] = None
    external_name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class ConnectorCreate(ConnectorBase):
    """Schema for creating a connector"""
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    credentials: Optional[Dict[str, Any]] = None


class ConnectorUpdate(BaseModel):
    """Schema for updating a connector"""
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ConnectorResponse(ConnectorBase):
    """Schema for connector response"""
    id: UUID
    workspace_id: UUID
    user_id: Optional[UUID] = None
    is_active: bool
    last_synced_at: Optional[datetime] = None
    sync_status: str
    sync_error: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    labels: List[ConnectorLabelResponse] = []

    class Config:
        from_attributes = True


class ConnectorListResponse(BaseModel):
    """Schema for list of connectors"""
    connectors: List[ConnectorResponse]
    total: int


# === Slack-specific Schemas ===

class SlackChannelInfo(BaseModel):
    """Slack channel information"""
    id: str
    name: str
    is_private: bool = False
    is_member: bool = False
    num_members: Optional[int] = None


class SlackOAuthCallback(BaseModel):
    """Slack OAuth callback data"""
    code: str
    state: Optional[str] = None


class SlackConnectorResponse(ConnectorResponse):
    """Extended connector response for Slack"""
    team_name: Optional[str] = None
    channels: List[SlackChannelInfo] = []


# === Gmail-specific Schemas ===

class GmailLabelInfo(BaseModel):
    """Gmail label information"""
    id: str
    name: str
    type: str = "user"
    messages_total: Optional[int] = None
    messages_unread: Optional[int] = None


class GmailOAuthCallback(BaseModel):
    """Gmail OAuth callback data"""
    code: str
    state: Optional[str] = None


class GmailConnectorResponse(ConnectorResponse):
    """Extended connector response for Gmail"""
    email: Optional[str] = None
    labels: List[ConnectorLabelResponse] = []


# === Gong/Fathom Schemas ===

class APIConnectorCreate(BaseModel):
    """Schema for creating API-based connectors (Gong, Fathom)"""
    connector_type: ConnectorType
    name: str
    api_key: str
    api_secret: Optional[str] = None
    base_url: Optional[str] = None


class APIConnectorResponse(ConnectorResponse):
    """Response for API-based connectors"""
    has_credentials: bool = False


# === Sync Schemas ===

class SyncRequest(BaseModel):
    """Request to trigger a sync"""
    connector_id: UUID
    full_sync: bool = False


class SyncStatusResponse(BaseModel):
    """Response for sync status"""
    connector_id: UUID
    status: SyncStatus
    last_synced_at: Optional[datetime] = None
    items_synced: int = 0
    error_message: Optional[str] = None

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class SlackTokensRequest(BaseModel):
    """Request schema for Slack token validation"""
    user_token: str = Field(..., description="Slack user OAuth token (xoxp-)")


class SlackChannel(BaseModel):
    """Slack channel information"""
    id: str = Field(..., description="Channel ID")
    name: str = Field(..., description="Channel name")
    is_private: bool = Field(..., description="Whether channel is private")
    member_count: Optional[int] = Field(None, description="Number of members")
    purpose: Optional[str] = Field(None, description="Channel purpose")
    topic: Optional[str] = Field(None, description="Channel topic")


class SlackChannelsResponse(BaseModel):
    """Response schema for Slack channels"""
    channels: List[SlackChannel]
    team_id: str = Field(..., description="Slack team/workspace ID")
    team_name: str = Field(..., description="Slack team/workspace name")


class SlackConnectionRequest(BaseModel):
    """Request schema for connecting Slack workspace"""
    user_token: str = Field(..., description="Slack user OAuth token")
    selected_channels: List[str] = Field(..., description="List of selected channel IDs", min_items=1, max_items=5)


class SlackConnectionResponse(BaseModel):
    """Response schema for Slack connection"""
    integration_id: str = Field(..., description="Created integration ID")
    team_name: str = Field(..., description="Connected team name")
    channels: List[SlackChannel] = Field(..., description="Connected channels")
    status: str = Field(..., description="Connection status")


class SlackAuthTestResponse(BaseModel):
    """Schema for Slack auth.test API response"""
    ok: bool
    team_id: str
    team: str
    user_id: str
    user: str
    bot_id: Optional[str] = None
    is_enterprise_install: Optional[bool] = None


class SlackConversationsListResponse(BaseModel):
    """Schema for Slack conversations.list API response"""
    ok: bool
    channels: List[dict]
    response_metadata: Optional[dict] = None
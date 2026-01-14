from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class Gmail_account(BaseModel):
    id: UUID = Field(default_factory=UUID)
    user_id: UUID
    access_token: str
    refresh_token: str
    token_expiry: datetime
    history_id: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True

class Gmail_labels(BaseModel):
    id : UUID = Field(default_factory=UUID)
    gmail_account_id : UUID
    label_id: str
    label_name: str
    watch_enabled: bool
    created_at: datetime

    class Config: 
        orm_mode = True


class GmailLabelInput(BaseModel):
    """Simple input schema for label selection from frontend"""
    id: str  # Gmail label ID (e.g., "Label_123")
    name: str
    type: str


class SelectLabelsRequest(BaseModel):
    selected: List[GmailLabelInput]

class GmailAuthURLResponse(BaseModel):
    auth_url: str
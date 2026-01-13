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
    id = UUID(as_uuid=True)
    gmail_accoubt_id = UUID(as_uuid=True)
    label_id: str
    label_name: str
    watch_enabled: bool
    created_at: datetime

    class Config: 
        orm_mode = True


class SelectLabelsRequest(BaseModel):
    label_ids: List[str]
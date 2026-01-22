"""
Schemas for Theme hierarchy (Theme -> SubTheme -> CustomerAsk)
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class UrgencyLevel(str, Enum):
    """Urgency levels for customer asks"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CustomerAskStatus(str, Enum):
    """Status for customer asks"""
    NEW = "new"
    UNDER_REVIEW = "under_review"
    PLANNED = "planned"
    SHIPPED = "shipped"


# === CustomerAsk Schemas ===

class CustomerAskBase(BaseModel):
    """Base schema for customer asks"""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    urgency: UrgencyLevel = UrgencyLevel.MEDIUM
    status: CustomerAskStatus = CustomerAskStatus.NEW


class CustomerAskCreate(CustomerAskBase):
    """Schema for creating a customer ask"""
    sub_theme_id: UUID


class CustomerAskUpdate(BaseModel):
    """Schema for updating a customer ask"""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    urgency: Optional[UrgencyLevel] = None
    status: Optional[CustomerAskStatus] = None
    sub_theme_id: Optional[UUID] = None


class CustomerAskResponse(CustomerAskBase):
    """Schema for customer ask response"""
    id: UUID
    sub_theme_id: UUID
    workspace_id: UUID
    match_confidence: Optional[float] = None
    mention_count: int = 0
    first_mentioned_at: Optional[datetime] = None
    last_mentioned_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    message_count: int = 0  # Computed from related messages

    class Config:
        from_attributes = True


class CustomerAskWithMessages(CustomerAskResponse):
    """Customer ask with related messages"""
    messages: List["MessageSummary"] = []


# === SubTheme Schemas ===

class SubThemeBase(BaseModel):
    """Base schema for sub-themes"""
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class SubThemeCreate(SubThemeBase):
    """Schema for creating a sub-theme"""
    theme_id: UUID


class SubThemeUpdate(BaseModel):
    """Schema for updating a sub-theme"""
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class SubThemeResponse(SubThemeBase):
    """Schema for sub-theme response"""
    id: UUID
    theme_id: UUID
    workspace_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    customer_ask_count: int = 0  # Computed

    class Config:
        from_attributes = True


class SubThemeWithCustomerAsks(SubThemeResponse):
    """Sub-theme with nested customer asks"""
    customer_asks: List[CustomerAskResponse] = []


# === Theme Schemas ===

class ThemeBase(BaseModel):
    """Base schema for themes"""
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class ThemeCreate(ThemeBase):
    """Schema for creating a theme"""
    pass


class ThemeUpdate(BaseModel):
    """Schema for updating a theme"""
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class ThemeResponse(ThemeBase):
    """Schema for theme response"""
    id: UUID
    workspace_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    sub_theme_count: int = 0  # Computed
    customer_ask_count: int = 0  # Computed (total across sub-themes)

    class Config:
        from_attributes = True


class ThemeWithSubThemes(ThemeResponse):
    """Theme with nested sub-themes"""
    sub_themes: List[SubThemeResponse] = []


class ThemeHierarchy(ThemeResponse):
    """Full theme hierarchy with sub-themes and customer asks"""
    sub_themes: List[SubThemeWithCustomerAsks] = []


# === List Responses ===

class ThemeListResponse(BaseModel):
    """List of themes"""
    themes: List[ThemeResponse]
    total: int


class SubThemeListResponse(BaseModel):
    """List of sub-themes"""
    sub_themes: List[SubThemeResponse]
    total: int


class CustomerAskListResponse(BaseModel):
    """List of customer asks"""
    customer_asks: List[CustomerAskResponse]
    total: int


# === Message Summary (for nested responses) ===

class MessageSummary(BaseModel):
    """Summary of a message for nested responses"""
    id: UUID
    source: str
    content: str
    author_name: Optional[str] = None
    sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Update forward references
CustomerAskWithMessages.model_rebuild()

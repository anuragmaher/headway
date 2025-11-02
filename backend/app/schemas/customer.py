from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class CustomerBase(BaseModel):
    """Base customer schema"""
    name: str = Field(..., min_length=1, max_length=255)
    domain: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    mrr: Optional[float] = Field(None, ge=0)
    arr: Optional[float] = Field(None, ge=0)
    deal_stage: Optional[str] = None
    deal_amount: Optional[float] = Field(None, ge=0)


class CustomerCreate(CustomerBase):
    """Schema for creating a customer"""
    pass


class CustomerUpdate(BaseModel):
    """Schema for updating a customer (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    domain: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    mrr: Optional[float] = Field(None, ge=0)
    arr: Optional[float] = Field(None, ge=0)
    deal_stage: Optional[str] = None
    deal_amount: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


class CustomerResponse(CustomerBase):
    """Schema for customer response"""
    id: UUID
    workspace_id: UUID
    external_system: Optional[str] = None
    external_id: Optional[str] = None
    deal_close_date: Optional[datetime] = None
    deal_probability: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    message_count: Optional[int] = None  # Number of messages from this customer

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    """Schema for paginated customer list"""
    customers: list[CustomerResponse]
    total: int
    page: int
    page_size: int


class CustomerBulkImport(BaseModel):
    """Schema for bulk customer import"""
    customers: list[CustomerCreate]


class CustomerImportResult(BaseModel):
    """Schema for import results"""
    success_count: int
    error_count: int
    errors: list[Dict[str, Any]] = []
    created_ids: list[UUID] = []


class CustomerFeatureRequest(BaseModel):
    """Schema for feature request linked to customer"""
    id: UUID
    name: str
    description: Optional[str] = None
    urgency: str
    status: str
    mention_count: int
    first_mentioned: datetime
    last_mentioned: datetime
    theme_name: Optional[str] = None

    class Config:
        from_attributes = True


class CustomerMessage(BaseModel):
    """Schema for message linked to customer"""
    id: UUID
    title: Optional[str] = None
    content: str
    source: str
    channel_name: Optional[str] = None
    author_name: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True


class CustomerConsolidatedView(BaseModel):
    """Schema for consolidated customer view with all related data"""
    customer: CustomerResponse
    feature_requests: list[CustomerFeatureRequest] = []
    recent_messages: list[CustomerMessage] = []
    total_messages: int = 0
    pain_points: list[str] = []  # Extracted pain points
    summary: Optional[str] = None  # AI-generated summary
    highlights: list[str] = []  # Key highlights

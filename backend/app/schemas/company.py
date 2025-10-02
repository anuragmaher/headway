"""
Company schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CompanyBase(BaseModel):
    """Base company schema with common fields"""
    name: str = Field(..., min_length=2, max_length=100)
    size: str = Field(..., pattern="^(1-10|11-50|51-200|201-1000|1000\+)$")
    domain: Optional[str] = Field(None, max_length=100)
    industry: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=200)


class CompanyCreate(CompanyBase):
    """Schema for company creation"""
    pass


class CompanyUpdate(BaseModel):
    """Schema for company updates"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    size: Optional[str] = Field(None, pattern="^(1-10|11-50|51-200|201-1000|1000\+)$")
    domain: Optional[str] = Field(None, max_length=100)
    industry: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=200)


class Company(CompanyBase):
    """Schema for company response"""
    id: str
    is_active: bool = True
    subscription_plan: str = "free"
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Acme Corporation",
                "size": "51-200",
                "domain": "acmecorp.com",
                "industry": "Technology",
                "description": "Leading provider of innovative solutions",
                "website": "https://acmecorp.com",
                "is_active": True,
                "subscription_plan": "pro",
                "created_at": "2023-10-01T12:00:00Z"
            }
        }


class CompanyWithUsers(Company):
    """Schema for company with users list"""
    users: List['UserInCompany'] = []


# Forward reference to avoid circular imports
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.schemas.auth import UserInCompany
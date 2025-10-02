"""
Authentication schemas for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Union
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    job_title: Optional[str] = Field(None, max_length=100)
    role: str = Field(default="member", pattern="^(owner|admin|member)$")
    is_active: bool = True
    theme_preference: str = Field(default="light", pattern="^(light|dark)$")


class UserCreate(UserBase):
    """Schema for user creation"""
    password: str = Field(..., min_length=8, max_length=100)
    company_name: str = Field(..., min_length=2, max_length=100)
    company_size: str = Field(..., pattern="^(1-10|11-50|51-200|201-1000|1000\+)$")
    
    class Config:
        schema_extra = {
            "example": {
                "email": "john.doe@acmecorp.com",
                "first_name": "John",
                "last_name": "Doe",
                "company_name": "Acme Corporation",
                "company_size": "51-200",
                "job_title": "Product Manager",
                "password": "securepassword123",
                "role": "owner",
                "theme_preference": "light"
            }
        }


class UserUpdate(BaseModel):
    """Schema for user updates"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    job_title: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field(None, pattern="^(owner|admin|member)$")
    theme_preference: Optional[str] = Field(None, pattern="^(light|dark)$")
    
    class Config:
        schema_extra = {
            "example": {
                "first_name": "John",
                "last_name": "Smith",
                "job_title": "Senior Product Manager",
                "role": "admin",
                "theme_preference": "dark"
            }
        }


class UserInDB(UserBase):
    """Schema for user in database (includes hashed password)"""
    id: Union[UUID, str]
    hashed_password: str
    onboarding_completed: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


class User(UserBase):
    """Schema for user response (no password)"""
    id: Union[UUID, str]
    company_id: Optional[Union[UUID, str]] = None
    company_name: Optional[str] = None
    onboarding_completed: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "john.doe@acmecorp.com",
                "first_name": "John",
                "last_name": "Doe",
                "company_id": "987e6543-e21b-32d1-a654-426614174000",
                "company_name": "Acme Corporation",
                "job_title": "Product Manager",
                "role": "owner",
                "is_active": True,
                "theme_preference": "light",
                "onboarding_completed": False,
                "created_at": "2023-10-01T12:00:00Z"
            }
        }


class UserInCompany(BaseModel):
    """Simplified user schema for company listings"""
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    job_title: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    
    class Config:
        schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "expires_in": 1800
            }
        }


class TokenData(BaseModel):
    """Schema for token data"""
    user_id: Optional[str] = None


class LoginRequest(BaseModel):
    """Schema for login request"""
    email: EmailStr
    password: str = Field(..., min_length=1)
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword123"
            }
        }


class RefreshTokenRequest(BaseModel):
    """Schema for refresh token request"""
    refresh_token: str
    
    class Config:
        schema_extra = {
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }


class PasswordResetRequest(BaseModel):
    """Schema for password reset request"""
    email: EmailStr
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com"
            }
        }


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation"""
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)
    
    class Config:
        schema_extra = {
            "example": {
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "new_password": "newsecurepassword123"
            }
        }


class ChangePasswordRequest(BaseModel):
    """Schema for password change request"""
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
    
    class Config:
        schema_extra = {
            "example": {
                "current_password": "oldpassword123",
                "new_password": "newsecurepassword123"
            }
        }
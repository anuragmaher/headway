"""
Workspace Connector schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class WorkspaceConnectorBase(BaseModel):
    """Base connector schema with common fields"""
    connector_type: str = Field(..., pattern="^(gong|fathom)$")


class GongConnectorCreate(WorkspaceConnectorBase):
    """Schema for creating Gong connector"""
    connector_type: str = "gong"
    gong_access_key: str = Field(..., min_length=1)
    gong_secret_key: str = Field(..., min_length=1)


class FathomConnectorCreate(WorkspaceConnectorBase):
    """Schema for creating Fathom connector"""
    connector_type: str = "fathom"
    fathom_api_token: str = Field(..., min_length=1)


class WorkspaceConnectorUpdate(BaseModel):
    """Schema for updating connector credentials"""
    gong_access_key: Optional[str] = Field(None, min_length=1)
    gong_secret_key: Optional[str] = Field(None, min_length=1)
    fathom_api_token: Optional[str] = Field(None, min_length=1)


class WorkspaceConnectorResponse(WorkspaceConnectorBase):
    """Schema for connector response (without sensitive data)"""
    id: UUID
    workspace_id: UUID
    connector_type: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Only return partial info (not full keys)
    gong_access_key: Optional[str] = Field(None)  # Masked
    gong_secret_key: Optional[str] = Field(None)  # Masked
    fathom_api_token: Optional[str] = Field(None)  # Masked

    class Config:
        from_attributes = True

    def mask_credentials(self):
        """Mask sensitive credentials in response"""
        if self.gong_access_key:
            self.gong_access_key = self.gong_access_key[:4] + "***" if len(self.gong_access_key) > 4 else "***"
        if self.gong_secret_key:
            self.gong_secret_key = self.gong_secret_key[:4] + "***" if len(self.gong_secret_key) > 4 else "***"
        if self.fathom_api_token:
            self.fathom_api_token = self.fathom_api_token[:4] + "***" if len(self.fathom_api_token) > 4 else "***"
        return self


class WorkspaceConnectorInput(BaseModel):
    """Schema for connector input (used in settings form)"""
    connector_type: str = Field(..., pattern="^(gong|fathom)$")
    gong_access_key: Optional[str] = None
    gong_secret_key: Optional[str] = None
    fathom_api_token: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "connector_type": "gong",
                "gong_access_key": "your-gong-access-key",
                "gong_secret_key": "your-gong-secret-key"
            }
        }

"""
Workspace schemas for API requests/responses
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class WorkspaceDomainsUpdate(BaseModel):
    """Schema for updating workspace company domains"""
    company_domains: List[str] = Field(
        default_factory=list,
        description="List of company domains to exclude from customer tracking (e.g., ['hiverhq.com', 'hiver.com'])"
    )


class WorkspaceResponse(BaseModel):
    """Schema for workspace response"""
    id: str
    name: str
    slug: str
    company_domains: Optional[List[str]] = None

    class Config:
        from_attributes = True

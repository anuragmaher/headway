"""Pydantic schemas for onboarding wizard API"""

from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime


# ============================================
# Company Setup (Step 1)
# ============================================

class CompanySetupData(BaseModel):
    """Company information collected in Step 1 (request)"""
    name: str = Field(..., min_length=1, max_length=255, description="Company name")
    website: Optional[str] = Field(None, max_length=500, description="Company website URL")
    industry: str = Field(..., min_length=1, max_length=100, description="Industry category")
    team_size: Optional[str] = Field(None, max_length=50, description="Team size range")
    role: Optional[str] = Field(None, max_length=100, description="User's role in the company")


class CompanyDataResponse(BaseModel):
    """Company data response (from companies table)"""
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    team_size: Optional[str] = None


# ============================================
# Product Taxonomy (Step 2)
# ============================================

class SubThemeSchema(BaseModel):
    """Sub-theme within a main theme"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., max_length=500)
    confidence: float = Field(..., ge=0, le=100, description="Confidence score 0-100")


class ThemeSchema(BaseModel):
    """Main theme with sub-themes"""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., max_length=500)
    confidence: float = Field(..., ge=0, le=100, description="Confidence score 0-100")
    sub_themes: List[SubThemeSchema] = Field(default_factory=list)


class TaxonomyGenerateRequest(BaseModel):
    """Request to generate taxonomy from a website URL"""
    url: str = Field(..., min_length=1, description="Website URL to analyze")
    workspace_id: UUID


class TaxonomyGenerateResponse(BaseModel):
    """Response with generated taxonomy (6 themes, each with 6 sub-themes)"""
    themes: List[ThemeSchema]


# ============================================
# Competitors (Step 4)
# ============================================

class CompetitorSchema(BaseModel):
    """Competitor information"""
    name: str = Field(..., min_length=1, max_length=255)
    website: Optional[str] = Field(None, max_length=500)


# ============================================
# Progress Persistence
# ============================================

class OnboardingProgressRequest(BaseModel):
    """Request to save onboarding progress (company data saved separately)"""
    current_step: int = Field(..., ge=0, le=3)
    taxonomy_url: Optional[str] = None
    taxonomy_data: Optional[dict] = None
    selected_themes: Optional[List[str]] = None
    connected_sources: Optional[List[str]] = None
    selected_competitors: Optional[List[CompetitorSchema]] = None


class OnboardingProgressResponse(BaseModel):
    """Response with saved onboarding progress (company data fetched separately)"""
    id: UUID
    workspace_id: UUID
    current_step: int
    taxonomy_url: Optional[str] = None
    taxonomy_data: Optional[dict] = None
    selected_themes: Optional[List[str]] = None
    connected_sources: Optional[List[str]] = None
    selected_competitors: Optional[List[dict]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================
# Industry and Role Options
# ============================================

INDUSTRIES = [
    "SaaS / Software",
    "E-commerce",
    "FinTech",
    "HealthTech",
    "EdTech",
    "Marketing",
    "HR / Recruiting",
    "Developer Tools",
    "Security",
    "Analytics",
    "Other",
]

TEAM_SIZES = [
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "500+",
]

ROLES = [
    "Product Manager",
    "Engineering",
    "Design",
    "Customer Success",
    "Sales",
    "Marketing",
    "Founder / Executive",
    "Other",
]


class OnboardingOptionsResponse(BaseModel):
    """Response with dropdown options for onboarding"""
    industries: List[str] = Field(default=INDUSTRIES)
    team_sizes: List[str] = Field(default=TEAM_SIZES)
    roles: List[str] = Field(default=ROLES)

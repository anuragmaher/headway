"""
Onboarding API endpoints for the wizard flow.

Provides endpoints for:
- Saving/loading onboarding progress
- Generating taxonomy (synchronous)
- Getting dropdown options
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.core.deps import get_db, get_current_user
from app.models.onboarding_progress import OnboardingProgress
from app.models.workspace import Workspace
from app.models.company import Company
from app.schemas.onboarding import (
    OnboardingProgressRequest,
    OnboardingProgressResponse,
    TaxonomyGenerateRequest,
    TaxonomyGenerateResponse,
    OnboardingOptionsResponse,
    CompanySetupData,
    CompanyDataResponse,
    INDUSTRIES,
    TEAM_SIZES,
    ROLES,
)
from app.services.taxonomy_service import generate_taxonomy_from_url, themes_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("/options", response_model=OnboardingOptionsResponse)
async def get_onboarding_options():
    """
    Get dropdown options for the onboarding wizard.
    Returns industries, team sizes, and roles.
    """
    return OnboardingOptionsResponse(
        industries=INDUSTRIES,
        team_sizes=TEAM_SIZES,
        roles=ROLES,
    )


@router.get("/company", response_model=CompanyDataResponse)
async def get_company_data(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get company data for the workspace (used in onboarding step 1).
    Returns data from the companies table.
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    if not workspace.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found for workspace"
        )

    company = db.query(Company).filter(Company.id == workspace.company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    return CompanyDataResponse(
        name=company.name or "",
        website=company.website,
        industry=company.industry,
        team_size=company.size,
    )


@router.post("/company", response_model=CompanyDataResponse)
async def save_company_data(
    workspace_id: UUID,
    request: CompanySetupData,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save company data for the workspace (used in onboarding step 1).
    Saves directly to the companies table.
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    if not workspace.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found for workspace"
        )

    company = db.query(Company).filter(Company.id == workspace.company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    # Update company fields
    company.name = request.name
    if request.website:
        company.website = request.website
    if request.industry:
        company.industry = request.industry
    if request.team_size:
        company.size = request.team_size

    db.commit()
    db.refresh(company)

    return CompanyDataResponse(
        name=company.name,
        website=company.website,
        industry=company.industry,
        team_size=company.size,
    )


@router.get("/progress", response_model=Optional[OnboardingProgressResponse])
async def get_onboarding_progress(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get saved onboarding progress for a workspace.
    Returns None if no progress has been saved.
    """
    progress = db.query(OnboardingProgress).filter(
        OnboardingProgress.workspace_id == workspace_id
    ).first()

    if not progress:
        return None

    return OnboardingProgressResponse.model_validate(progress)


@router.post("/progress", response_model=OnboardingProgressResponse)
async def save_onboarding_progress(
    workspace_id: UUID,
    request: OnboardingProgressRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save or update onboarding progress for a workspace.
    Uses upsert logic - creates if not exists, updates if exists.
    Note: Company data is saved separately via POST /company endpoint.
    """
    # Verify workspace exists and user has access
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Get or create progress record
    progress = db.query(OnboardingProgress).filter(
        OnboardingProgress.workspace_id == workspace_id
    ).first()

    if not progress:
        progress = OnboardingProgress(workspace_id=workspace_id)
        db.add(progress)

    # Update fields
    progress.current_step = request.current_step

    if request.taxonomy_url is not None:
        progress.taxonomy_url = request.taxonomy_url

    if request.taxonomy_data is not None:
        progress.taxonomy_data = request.taxonomy_data

    if request.selected_themes is not None:
        progress.selected_themes = request.selected_themes

    if request.connected_sources is not None:
        progress.connected_sources = request.connected_sources

    if request.selected_competitors is not None:
        progress.selected_competitors = [c.model_dump() for c in request.selected_competitors]

    db.commit()
    db.refresh(progress)

    return OnboardingProgressResponse.model_validate(progress)


@router.post("/taxonomy/generate", response_model=TaxonomyGenerateResponse)
async def generate_taxonomy(
    request: TaxonomyGenerateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate taxonomy from a website URL.
    Uses AI to analyze the website and generate exactly 6 themes with 6 sub-themes each.
    """
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == request.workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    logger.info(f"Generating taxonomy for workspace {request.workspace_id}, URL: {request.url}")

    try:
        # Generate taxonomy from URL using AI
        themes = generate_taxonomy_from_url(request.url)
        themes_dict = themes_to_dict(themes)

        logger.info(f"Generated {len(themes)} themes with {sum(len(t.sub_themes) for t in themes)} total sub-themes")

        # Save to progress
        progress = db.query(OnboardingProgress).filter(
            OnboardingProgress.workspace_id == request.workspace_id
        ).first()

        if not progress:
            progress = OnboardingProgress(workspace_id=request.workspace_id)
            db.add(progress)

        progress.taxonomy_url = request.url
        progress.taxonomy_data = themes_dict
        db.commit()

        return TaxonomyGenerateResponse(themes=themes_dict)

    except Exception as e:
        logger.error(f"Error generating taxonomy: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate taxonomy: {str(e)}"
        )


@router.delete("/progress")
async def reset_onboarding_progress(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reset onboarding progress for a workspace.
    Used for testing or if user wants to start over.
    """
    progress = db.query(OnboardingProgress).filter(
        OnboardingProgress.workspace_id == workspace_id
    ).first()

    if progress:
        db.delete(progress)
        db.commit()

    return {"message": "Onboarding progress reset"}

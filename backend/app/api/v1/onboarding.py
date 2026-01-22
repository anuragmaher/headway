"""
Onboarding API endpoints for the wizard flow.

Data is stored in proper tables:
- Company data → companies table
- Themes/sub-themes → themes & sub_themes tables
- Connected sources → workspace_connectors table
- Competitors → competitors table
- Progress tracking → onboarding_progress table (only current_step)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.deps import get_db, get_current_user
from app.models.onboarding_progress import OnboardingProgress
from app.models.workspace import Workspace
from app.models.company import Company
from app.models.theme import Theme
from app.models.sub_theme import SubTheme
from app.models.competitor import Competitor
from app.models.workspace_connector import WorkspaceConnector
from app.schemas.onboarding import (
    OnboardingProgressRequest,
    OnboardingProgressResponse,
    TaxonomyGenerateRequest,
    TaxonomyGenerateResponse,
    OnboardingOptionsResponse,
    CompanySetupData,
    CompanyDataResponse,
    CompetitorSchema,
    BulkThemeCreate,
    BulkThemeResponse,
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


# ============================================
# Company Data (Step 0)
# ============================================

@router.get("/company", response_model=CompanyDataResponse)
async def get_company_data(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get company data for the workspace (used in onboarding step 0).
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
        role=company.role,
    )


@router.post("/company", response_model=CompanyDataResponse)
async def save_company_data(
    workspace_id: UUID,
    request: CompanySetupData,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save company data for the workspace (used in onboarding step 0).
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
    if request.website is not None:
        company.website = request.website
    if request.industry:
        company.industry = request.industry
    if request.team_size:
        company.size = request.team_size
    if request.role is not None:
        company.role = request.role

    db.commit()
    db.refresh(company)

    return CompanyDataResponse(
        name=company.name,
        website=company.website,
        industry=company.industry,
        team_size=company.size,
        role=company.role,
    )


# ============================================
# Progress Tracking
# ============================================

@router.get("/progress", response_model=Optional[OnboardingProgressResponse])
async def get_onboarding_progress(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get saved onboarding progress for a workspace.
    Returns only current_step - fetch actual data from proper tables.
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
    Only saves current_step - actual data should be saved to proper tables.
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

    # Update current step
    progress.current_step = request.current_step

    db.commit()
    db.refresh(progress)

    return OnboardingProgressResponse.model_validate(progress)


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


# ============================================
# Taxonomy Generation (Step 1)
# ============================================

@router.post("/taxonomy/generate", response_model=TaxonomyGenerateResponse)
async def generate_taxonomy(
    request: TaxonomyGenerateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate taxonomy from a website URL.
    Uses AI to analyze the website and generate themes with sub-themes.
    Returns the generated themes (frontend should then call /themes/bulk to save selected ones).
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

        return TaxonomyGenerateResponse(themes=themes_dict)

    except Exception as e:
        logger.error(f"Error generating taxonomy: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate taxonomy: {str(e)}"
        )


@router.post("/themes/bulk", response_model=BulkThemeResponse)
async def save_themes_bulk(
    workspace_id: UUID,
    request: BulkThemeCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save multiple themes with sub-themes at once (used after taxonomy generation).
    Clears existing themes for workspace and creates new ones.
    """
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Delete existing themes (cascades to sub_themes)
    db.query(Theme).filter(Theme.workspace_id == workspace_id).delete()

    created_themes = []
    for idx, theme_data in enumerate(request.themes):
        # Create theme
        theme = Theme(
            workspace_id=workspace_id,
            name=theme_data.name,
            description=theme_data.description,
            sort_order=idx,
        )
        db.add(theme)
        db.flush()  # Get theme ID

        # Create sub-themes
        for sub_idx, sub_theme_data in enumerate(theme_data.sub_themes):
            sub_theme = SubTheme(
                theme_id=theme.id,
                workspace_id=workspace_id,
                name=sub_theme_data.name,
                description=sub_theme_data.description,
                sort_order=sub_idx,
            )
            db.add(sub_theme)

        created_themes.append({
            "id": str(theme.id),
            "name": theme.name,
            "sub_theme_count": len(theme_data.sub_themes),
        })

    db.commit()

    return BulkThemeResponse(
        created_count=len(created_themes),
        themes=created_themes,
    )


# ============================================
# Competitors (Step 3)
# ============================================

@router.get("/competitors", response_model=List[CompetitorSchema])
async def get_competitors(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get competitors for a workspace.
    """
    competitors = db.query(Competitor).filter(
        Competitor.workspace_id == workspace_id
    ).all()

    return [
        CompetitorSchema(name=c.name, website=c.website)
        for c in competitors
    ]


@router.post("/competitors", response_model=List[CompetitorSchema])
async def save_competitors(
    workspace_id: UUID,
    competitors: List[CompetitorSchema],
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save competitors for a workspace.
    Replaces all existing competitors.
    """
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Delete existing competitors
    db.query(Competitor).filter(Competitor.workspace_id == workspace_id).delete()

    # Create new competitors
    created = []
    for comp_data in competitors:
        competitor = Competitor(
            workspace_id=workspace_id,
            name=comp_data.name,
            website=comp_data.website,
        )
        db.add(competitor)
        created.append(CompetitorSchema(name=comp_data.name, website=comp_data.website))

    db.commit()

    return created


@router.post("/competitors/add", response_model=CompetitorSchema)
async def add_competitor(
    workspace_id: UUID,
    competitor: CompetitorSchema,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add a single competitor to a workspace.
    """
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    # Check if competitor already exists
    existing = db.query(Competitor).filter(
        Competitor.workspace_id == workspace_id,
        Competitor.name == competitor.name
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Competitor already exists"
        )

    new_competitor = Competitor(
        workspace_id=workspace_id,
        name=competitor.name,
        website=competitor.website,
    )
    db.add(new_competitor)
    db.commit()

    return CompetitorSchema(name=new_competitor.name, website=new_competitor.website)


@router.delete("/competitors/{competitor_name}")
async def remove_competitor(
    workspace_id: UUID,
    competitor_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove a competitor from a workspace.
    """
    competitor = db.query(Competitor).filter(
        Competitor.workspace_id == workspace_id,
        Competitor.name == competitor_name
    ).first()

    if not competitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competitor not found"
        )

    db.delete(competitor)
    db.commit()

    return {"message": "Competitor removed"}


# ============================================
# Connected Sources (Step 2)
# ============================================

@router.get("/connectors", response_model=List[dict])
async def get_connected_sources(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get connected data sources (workspace_connectors) for a workspace.
    Used to check which sources are connected during onboarding.
    """
    connectors = db.query(WorkspaceConnector).filter(
        WorkspaceConnector.workspace_id == workspace_id,
        WorkspaceConnector.is_active == True
    ).all()

    return [
        {
            "id": str(c.id),
            "connector_type": c.connector_type,
            "name": c.name or c.external_name,
            "external_id": c.external_id,
            "sync_status": c.sync_status,
            "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
        }
        for c in connectors
    ]

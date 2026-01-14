"""
Workspace API endpoints for connector management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
import logging
from typing import Union, List

from app.core.deps import get_current_user, get_db
from app.services.workspace_service import WorkspaceService
from app.schemas.workspace_connector import (
    WorkspaceConnectorResponse,
    GongConnectorCreate,
    FathomConnectorCreate,
    WorkspaceConnectorUpdate,
    WorkspaceConnectorInput,
)
from app.schemas.workspace import WorkspaceDomainsUpdate, WorkspaceResponse
from app.schemas.company import CompanyUpdate
from app.schemas.customer import CustomerChatRequest, CustomerChatResponse
from app.models.user import User
from pydantic import BaseModel
from app.services.workspace_chat_service import get_workspace_chat_service
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/my-workspace",
    response_model=dict,
    status_code=status.HTTP_200_OK
)
async def get_my_workspace(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
) -> dict:
    """
    Get the workspace ID for the current user.

    Args:
        current_user: Current authenticated user (as dict)
        db: Database session

    Returns:
        Dictionary with workspace_id

    Raises:
        HTTPException: If workspace not found
    """
    try:
        from app.models.workspace import Workspace

        # Handle both dict and User object
        user_company_id = current_user.get('company_id') if isinstance(current_user, dict) else current_user.company_id

        workspace = db.query(Workspace).filter(
            Workspace.company_id == user_company_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found for user's company"
            )

        return {"workspace_id": str(workspace.id)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user workspace: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch workspace"
        )


@router.post(
    "/{workspace_id}/connectors",
    response_model=WorkspaceConnectorResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_or_update_connector(
    workspace_id: UUID,
    connector_data: WorkspaceConnectorInput,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> WorkspaceConnectorResponse:
    """
    Create or update a workspace connector (Gong or Fathom).

    Args:
        workspace_id: UUID of the workspace
        connector_data: Connector credentials (GongConnectorCreate or FathomConnectorCreate)
        current_user: Current authenticated user
        db: Database session

    Returns:
        WorkspaceConnectorResponse with masked credentials

    Raises:
        HTTPException: If workspace not found or validation fails
    """
    try:
        user_email = current_user.email if isinstance(current_user, User) else current_user.get('email', 'unknown')
        logger.info(
            f"User {user_email} creating/updating {connector_data.connector_type} "
            f"connector for workspace {workspace_id}"
        )

        # Convert WorkspaceConnectorInput to appropriate schema type
        if connector_data.connector_type == "gong":
            validated_data = GongConnectorCreate(
                connector_type="gong",
                gong_access_key=connector_data.gong_access_key,
                gong_secret_key=connector_data.gong_secret_key
            )
        elif connector_data.connector_type == "fathom":
            validated_data = FathomConnectorCreate(
                connector_type="fathom",
                fathom_api_token=connector_data.fathom_api_token
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid connector type"
            )

        service = WorkspaceService(db)
        connector = service.save_connector(workspace_id, validated_data)

        logger.info(f"Connector saved successfully for workspace {workspace_id}")
        return connector

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating connector: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create connector"
        )


@router.get(
    "/{workspace_id}/connectors",
    response_model=List[WorkspaceConnectorResponse],
    status_code=status.HTTP_200_OK
)
async def get_workspace_connectors(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> List[WorkspaceConnectorResponse]:
    """
    Get all connectors for a workspace.

    Args:
        workspace_id: UUID of the workspace
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of WorkspaceConnectorResponse with masked credentials

    Raises:
        HTTPException: If workspace not found
    """
    try:
        logger.info(f"Fetching connectors for workspace {workspace_id}")

        service = WorkspaceService(db)
        connectors = service.get_connectors(workspace_id)

        return connectors

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching connectors: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch connectors"
        )


@router.get(
    "/{workspace_id}/connectors/{connector_id}",
    response_model=WorkspaceConnectorResponse,
    status_code=status.HTTP_200_OK
)
async def get_connector(
    workspace_id: UUID,
    connector_id: UUID,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> WorkspaceConnectorResponse:
    """
    Get a specific connector for a workspace.

    Args:
        workspace_id: UUID of the workspace
        connector_id: UUID of the connector
        current_user: Current authenticated user
        db: Database session

    Returns:
        WorkspaceConnectorResponse with masked credentials

    Raises:
        HTTPException: If connector not found
    """
    try:
        logger.info(f"Fetching connector {connector_id} for workspace {workspace_id}")

        service = WorkspaceService(db)
        connector = service.get_connector(workspace_id, connector_id)

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connector not found"
            )

        return connector

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching connector: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch connector"
        )


@router.put(
    "/{workspace_id}/connectors/{connector_id}",
    response_model=WorkspaceConnectorResponse,
    status_code=status.HTTP_200_OK
)
async def update_connector(
    workspace_id: UUID,
    connector_id: UUID,
    connector_data: WorkspaceConnectorUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> WorkspaceConnectorResponse:
    """
    Update a specific connector's credentials.

    Args:
        workspace_id: UUID of the workspace
        connector_id: UUID of the connector
        connector_data: Update data with optional credentials
        current_user: Current authenticated user
        db: Database session

    Returns:
        Updated WorkspaceConnectorResponse with masked credentials

    Raises:
        HTTPException: If connector not found or validation fails
    """
    try:
        logger.info(
            f"User {current_user.email} updating connector {connector_id} "
            f"for workspace {workspace_id}"
        )

        service = WorkspaceService(db)
        connector = service.update_connector(workspace_id, connector_id, connector_data)

        logger.info(f"Connector {connector_id} updated successfully")
        return connector

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating connector: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update connector"
        )


@router.delete(
    "/{workspace_id}/connectors/{connector_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def delete_connector(
    workspace_id: UUID,
    connector_id: UUID,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Delete a connector from a workspace.

    Args:
        workspace_id: UUID of the workspace
        connector_id: UUID of the connector
        current_user: Current authenticated user
        db: Database session

    Raises:
        HTTPException: If connector not found
    """
    try:
        logger.info(
            f"User {current_user.email} deleting connector {connector_id} "
            f"from workspace {workspace_id}"
        )

        service = WorkspaceService(db)
        service.delete_connector(workspace_id, connector_id)

        logger.info(f"Connector {connector_id} deleted successfully")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting connector: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete connector"
        )


@router.get(
    "/{workspace_id}/company-details",
    response_model=dict,
    status_code=status.HTTP_200_OK
)
async def get_company_details(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> dict:
    """
    Get company details for a workspace.

    Args:
        workspace_id: UUID of the workspace
        current_user: Current authenticated user
        db: Database session

    Returns:
        Company details or empty object if not set

    Raises:
        HTTPException: If workspace not found
    """
    try:
        from app.models.workspace import Workspace
        from app.models.company import Company

        workspace = db.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        company = db.query(Company).filter(
            Company.id == workspace.company_id
        ).first()

        if not company:
            # Return empty object if company not found
            return {
                "name": "",
                "website": "",
                "size": "",
                "description": "",
            }

        return {
            "id": str(company.id),
            "name": company.name or "",
            "website": company.website or "",
            "size": company.size or "",
            "description": company.description or "",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching company details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch company details"
        )


@router.put(
    "/{workspace_id}/company-details",
    response_model=dict,
    status_code=status.HTTP_200_OK
)
async def update_company_details(
    workspace_id: UUID,
    company_data: CompanyUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> dict:
    """
    Update company details for a workspace.

    Args:
        workspace_id: UUID of the workspace
        company_data: Company details to update (name, website, size, description)
        current_user: Current authenticated user
        db: Database session

    Returns:
        Updated company details

    Raises:
        HTTPException: If workspace or company not found
    """
    try:
        user_email = current_user.email if isinstance(current_user, User) else current_user.get('email', 'unknown')
        logger.info(
            f"User {user_email} updating company details for workspace {workspace_id}"
        )

        service = WorkspaceService(db)
        company_details = service.update_company_details(workspace_id, company_data)

        logger.info(f"Company details updated successfully for workspace {workspace_id}")
        return company_details

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating company details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update company details"
        )


class GenerateDescriptionRequest(BaseModel):
    """Request model for description generation"""
    website_url: str = None


class GenerateThemeSuggestionsRequest(BaseModel):
    """Request model for theme suggestions generation"""
    already_suggested: list[dict] = None  # List of already suggested themes: [{"name": "...", "description": "..."}, ...]


class GenerateFeatureSuggestionsRequest(BaseModel):
    """Request model for feature suggestions generation"""
    theme_name: str  # Name of the selected theme
    existing_features: list[dict] = None  # List of existing features in DB: [{"name": "...", "description": "..."}, ...]
    already_suggested: list[dict] = None  # List of already suggested features: [{"name": "...", "description": "..."}, ...]


@router.post(
    "/{workspace_id}/generate-description",
    response_model=dict,
    status_code=status.HTTP_200_OK
)
async def generate_description(
    workspace_id: UUID,
    request: GenerateDescriptionRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> dict:
    """
    Generate company description from website URL using OpenAI.

    Args:
        workspace_id: UUID of the workspace
        request: Request containing website URL
        current_user: Current authenticated user
        db: Database session

    Returns:
        Dictionary with generated description

    Raises:
        HTTPException: If website fetch or generation fails
    """
    try:
        if not request.website_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="website_url is required"
            )

        user_email = current_user.email if isinstance(current_user, User) else current_user.get('email', 'unknown')
        logger.info(
            f"User {user_email} requesting description generation for {request.website_url}"
        )

        service = WorkspaceService(db)
        result = service.generate_description_from_website(workspace_id, request.website_url)

        logger.info(f"Description generated successfully for workspace {workspace_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating description: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate description"
        )


@router.post(
    "/{workspace_id}/generate-theme-suggestions",
    response_model=dict,
    status_code=status.HTTP_200_OK
)
async def generate_theme_suggestions(
    workspace_id: UUID,
    request: GenerateThemeSuggestionsRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> dict:
    """
    Generate AI-powered theme suggestions based on company details.

    Args:
        workspace_id: UUID of the workspace
        request: Request containing already_suggested themes to avoid
        current_user: Current authenticated user
        db: Database session

    Returns:
        Dictionary with list of theme suggestions

    Raises:
        HTTPException: If company details not found or generation fails
    """
    try:
        user_email = current_user.email if isinstance(current_user, User) else current_user.get('email', 'unknown')
        logger.info(
            f"User {user_email} requesting theme suggestions for workspace {workspace_id}"
        )

        service = WorkspaceService(db)
        already_suggested = request.already_suggested or []
        suggestions = service.generate_theme_suggestions(workspace_id, already_suggested)

        logger.info(f"Theme suggestions generated successfully for workspace {workspace_id}")
        return suggestions

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating theme suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate theme suggestions"
        )


@router.post(
    "/{workspace_id}/generate-feature-suggestions",
    response_model=dict,
    status_code=status.HTTP_200_OK
)
async def generate_feature_suggestions(
    workspace_id: UUID,
    request: GenerateFeatureSuggestionsRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> dict:
    """
    Generate AI-powered feature suggestions based on company details and selected theme.

    Args:
        workspace_id: UUID of the workspace
        request: Request containing theme_name and already_suggested features
        current_user: Current authenticated user
        db: Database session

    Returns:
        Dictionary with list of feature suggestions

    Raises:
        HTTPException: If company details not found or generation fails
    """
    try:
        user_email = current_user.email if isinstance(current_user, User) else current_user.get('email', 'unknown')
        logger.info(
            f"User {user_email} requesting feature suggestions for theme '{request.theme_name}' in workspace {workspace_id}"
        )

        service = WorkspaceService(db)
        existing_features = request.existing_features or []
        already_suggested = request.already_suggested or []
        suggestions = service.generate_feature_suggestions(workspace_id, request.theme_name, existing_features, already_suggested)

        logger.info(f"Feature suggestions generated successfully for workspace {workspace_id}")
        return suggestions

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating feature suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate feature suggestions"
        )


@router.post("/{workspace_id}/chat", response_model=CustomerChatResponse)
def workspace_chat(
    workspace_id: UUID,
    chat_request: CustomerChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Natural language chat interface for workspace-level customer insights

    Ask questions across ALL customers in the workspace using AI-powered responses.

    Example queries:
    - "Which customers have the most urgent feature requests?"
    - "Show me customers in the Healthcare industry"
    - "What are the top pain points across all customers?"
    - "Which customers have ARR over $100k?"
    - "Show me feature requests by customer"

    Args:
        workspace_id: UUID of the workspace
        chat_request: Chat query request
        db: Database session
        current_user: Current authenticated user

    Returns:
        CustomerChatResponse with AI-generated answer

    Raises:
        HTTPException: If workspace not found or query fails
    """
    try:
        # Get workspace chat service
        chat_service = get_workspace_chat_service()

        # Process chat query across all customers in workspace
        result = chat_service.chat(
            db=db,
            workspace_id=str(workspace_id),
            user_query=chat_request.query
        )

        return CustomerChatResponse(**result)

    except Exception as e:
        logger.error(f"Error in workspace chat: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat query: {str(e)}"
        )


@router.get(
    "/{workspace_id}/company-domains",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_200_OK
)
async def get_company_domains(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> WorkspaceResponse:
    """
    Get workspace company domains to exclude from customer tracking.

    Args:
        workspace_id: UUID of the workspace
        current_user: Current authenticated user
        db: Database session

    Returns:
        Workspace with company_domains

    Raises:
        HTTPException: If workspace not found
    """
    try:
        from app.models.workspace import Workspace

        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        return WorkspaceResponse(
            id=str(workspace.id),
            name=workspace.name,
            slug=workspace.slug,
            company_domains=workspace.company_domains or []
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching company domains: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch company domains"
        )


@router.put(
    "/{workspace_id}/company-domains",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_200_OK
)
async def update_company_domains(
    workspace_id: UUID,
    domains_data: WorkspaceDomainsUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
) -> WorkspaceResponse:
    """
    Update workspace company domains to exclude from customer tracking.

    Args:
        workspace_id: UUID of the workspace
        domains_data: List of company domains (e.g., ["hiverhq.com", "hiver.com"])
        current_user: Current authenticated user
        db: Database session

    Returns:
        Updated workspace with company_domains

    Raises:
        HTTPException: If workspace not found
    """
    try:
        from app.models.workspace import Workspace

        user_email = current_user.email if isinstance(current_user, User) else current_user.get('email', 'unknown')
        logger.info(
            f"User {user_email} updating company domains for workspace {workspace_id}"
        )

        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        # Update company domains
        workspace.company_domains = domains_data.company_domains
        db.commit()
        db.refresh(workspace)

        logger.info(f"Company domains updated successfully for workspace {workspace_id}")

        return WorkspaceResponse(
            id=str(workspace.id),
            name=workspace.name,
            slug=workspace.slug,
            company_domains=workspace.company_domains or []
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating company domains: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update company domains"
        )

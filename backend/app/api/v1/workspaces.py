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
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


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

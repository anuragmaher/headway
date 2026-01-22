"""
Unified Connectors API - Manages all data source connections (Slack, Gmail, Gong, Fathom)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from uuid import UUID

from app.core.deps import get_current_user, get_db
from app.services.connector_service import ConnectorService
from app.schemas.connector import (
    ConnectorCreate, ConnectorUpdate, ConnectorResponse, ConnectorListResponse,
    ConnectorLabelResponse, APIConnectorCreate, SyncRequest, SyncStatusResponse,
    ConnectorType, SyncStatus
)

router = APIRouter()


# === List & Get Connectors ===

@router.get("", response_model=ConnectorListResponse)
async def list_connectors(
    connector_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all connectors for the user's workspace"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = ConnectorService(db)
    connectors = service.list_connectors(
        workspace_id=UUID(workspace_id),
        connector_type=connector_type,
        is_active=is_active
    )

    return ConnectorListResponse(
        connectors=[ConnectorResponse.model_validate(c) for c in connectors],
        total=len(connectors)
    )


@router.get("/{connector_id}", response_model=ConnectorResponse)
async def get_connector(
    connector_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a specific connector"""
    service = ConnectorService(db)
    connector = service.get_connector(connector_id)

    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connector not found"
        )

    # Verify workspace access
    if str(connector.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return ConnectorResponse.model_validate(connector)


# === Create Connectors ===

@router.post("/api-connector", response_model=ConnectorResponse, status_code=status.HTTP_201_CREATED)
async def create_api_connector(
    data: APIConnectorCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create an API-based connector (Gong, Fathom, etc.)"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = ConnectorService(db)

    # Check for existing connector of same type
    existing = service.list_connectors(
        workspace_id=UUID(workspace_id),
        connector_type=data.connector_type.value
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A {data.connector_type.value} connector already exists"
        )

    # Create connector with API credentials
    connector_data = ConnectorCreate(
        connector_type=data.connector_type,
        name=data.name,
        credentials={
            "api_key": data.api_key,
            "api_secret": data.api_secret,
            "base_url": data.base_url
        }
    )

    connector = service.create_connector(
        workspace_id=UUID(workspace_id),
        data=connector_data,
        user_id=UUID(current_user['id'])
    )

    return ConnectorResponse.model_validate(connector)


# === Update & Delete Connectors ===

@router.patch("/{connector_id}", response_model=ConnectorResponse)
async def update_connector(
    connector_id: UUID,
    data: ConnectorUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a connector"""
    service = ConnectorService(db)
    connector = service.get_connector(connector_id)

    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connector not found"
        )

    if str(connector.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    updated = service.update_connector(connector_id, data)
    return ConnectorResponse.model_validate(updated)


@router.delete("/{connector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connector(
    connector_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a connector"""
    service = ConnectorService(db)
    connector = service.get_connector(connector_id)

    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connector not found"
        )

    if str(connector.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service.delete_connector(connector_id)


@router.post("/{connector_id}/deactivate", response_model=ConnectorResponse)
async def deactivate_connector(
    connector_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Deactivate a connector (soft delete)"""
    service = ConnectorService(db)
    connector = service.get_connector(connector_id)

    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connector not found"
        )

    if str(connector.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    deactivated = service.deactivate_connector(connector_id)
    return ConnectorResponse.model_validate(deactivated)


# === Label Management ===

@router.get("/{connector_id}/labels", response_model=List[ConnectorLabelResponse])
async def get_connector_labels(
    connector_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get labels for a connector"""
    service = ConnectorService(db)
    connector = service.get_connector(connector_id)

    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connector not found"
        )

    if str(connector.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    labels = service.get_labels(connector_id)
    return [ConnectorLabelResponse.model_validate(l) for l in labels]


@router.put("/{connector_id}/labels", response_model=List[ConnectorLabelResponse])
async def update_enabled_labels(
    connector_id: UUID,
    label_ids: List[str],
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update which labels are enabled for syncing"""
    service = ConnectorService(db)
    connector = service.get_connector(connector_id)

    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connector not found"
        )

    if str(connector.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    labels = service.enable_labels(connector_id, label_ids)
    return [ConnectorLabelResponse.model_validate(l) for l in labels]


# === Sync Operations ===

@router.post("/{connector_id}/sync", response_model=SyncStatusResponse)
async def trigger_sync(
    connector_id: UUID,
    full_sync: bool = False,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Trigger a sync for a connector"""
    service = ConnectorService(db)
    connector = service.get_connector(connector_id)

    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connector not found"
        )

    if str(connector.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update status to syncing
    service.update_sync_status(connector_id, SyncStatus.SYNCING)

    # Trigger the appropriate sync task based on connector type
    from app.tasks.sync_tasks import trigger_connector_sync
    trigger_connector_sync.delay(str(connector_id), full_sync)

    return SyncStatusResponse(
        connector_id=connector_id,
        status=SyncStatus.SYNCING,
        last_synced_at=connector.last_synced_at,
        items_synced=0
    )


@router.get("/{connector_id}/sync-status", response_model=SyncStatusResponse)
async def get_sync_status(
    connector_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get sync status for a connector"""
    service = ConnectorService(db)
    connector = service.get_connector(connector_id)

    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connector not found"
        )

    if str(connector.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return SyncStatusResponse(
        connector_id=connector_id,
        status=SyncStatus(connector.sync_status),
        last_synced_at=connector.last_synced_at,
        items_synced=0,
        error_message=connector.sync_error
    )

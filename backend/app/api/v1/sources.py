"""
Sources API endpoints for data sync management

This module provides endpoints for:
- Viewing paginated messages from all sources
- Viewing sync history
- Triggering on-demand sync for all sources (via Celery)
- Triggering theme processing (via Celery)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from uuid import UUID
import logging
from typing import Optional

from app.core.deps import get_current_user, get_db
from app.services.sources_service import SourcesService, get_sources_service
from app.schemas.sources import (
    MessageListResponse,
    SyncHistoryListResponse,
    DataSourcesStatusResponse,
    SyncAllSourcesResponse,
    SyncThemesResponse,
    SyncOperationResponse,
    SyncSourceRequest,
    SyncThemeRequest,
)
from app.models.workspace import Workspace
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()


def get_workspace_for_user(db: Session, current_user: dict) -> Workspace:
    """Helper to get workspace for current user"""
    user_company_id = current_user.get('company_id')
    workspace = db.query(Workspace).filter(
        Workspace.company_id == user_company_id
    ).first()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    return workspace


# ============ Messages Endpoints ============

@router.get(
    "/{workspace_id}/messages",
    response_model=MessageListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get paginated messages from all sources",
    description="Returns paginated list of messages from all connected data sources (Gmail, Slack, Gong, Fathom)"
)
async def get_messages(
    workspace_id: UUID,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=5, ge=1, le=50, description="Items per page"),
    source: Optional[str] = Query(default=None, description="Filter by source (gmail, slack, gong, fathom)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageListResponse:
    """
    Get paginated messages from all data sources.
    
    - **page**: Page number (1-indexed)
    - **page_size**: Number of items per page (default: 5, max: 50)
    - **source**: Optional filter by source type
    """
    try:
        service = get_sources_service(db)
        return service.get_messages_paginated(
            workspace_id=workspace_id,
            page=page,
            page_size=page_size,
            source_filter=source,
        )
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch messages"
        )


# ============ Sync History Endpoints ============

@router.get(
    "/{workspace_id}/sync-history",
    response_model=SyncHistoryListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get sync history",
    description="Returns paginated sync history for data sources and themes"
)
async def get_sync_history(
    workspace_id: UUID,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=50, description="Items per page"),
    source: Optional[str] = Query(default=None, description="Filter by source (gmail, slack, gong, fathom)"),
    sync_type: Optional[str] = Query(default=None, description="Filter by sync type (source, theme)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncHistoryListResponse:
    """
    Get paginated sync history.
    
    - **page**: Page number (1-indexed)
    - **page_size**: Number of items per page (default: 10, max: 50)
    - **source**: Optional filter by source type
    - **sync_type**: Optional filter by sync type ('source' or 'theme')
    """
    try:
        service = get_sources_service(db)
        return service.get_sync_history_paginated(
            workspace_id=workspace_id,
            page=page,
            page_size=page_size,
            source_filter=source,
            type_filter=sync_type,
        )
    except Exception as e:
        logger.error(f"Error fetching sync history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sync history"
        )


# ============ Data Sources Status Endpoint ============

@router.get(
    "/{workspace_id}/status",
    response_model=DataSourcesStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get data sources status",
    description="Returns status of all connected data sources"
)
async def get_data_sources_status(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DataSourcesStatusResponse:
    """
    Get status of all connected data sources.
    
    Returns information about each connected source including:
    - Source type and name
    - Active status
    - Last sync time
    - Message count
    """
    try:
        service = get_sources_service(db)
        return service.get_data_sources_status(workspace_id)
    except Exception as e:
        logger.error(f"Error fetching data sources status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch data sources status"
        )


# ============ Sync Operations Endpoints ============

@router.post(
    "/{workspace_id}/sync-all",
    response_model=SyncAllSourcesResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Sync all data sources",
    description="Triggers sync for all connected data sources via Celery background tasks"
)
async def sync_all_sources(
    workspace_id: UUID,
    request: Optional[SyncSourceRequest] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncAllSourcesResponse:
    """
    Trigger sync for all connected data sources.
    
    This endpoint dispatches Celery tasks for:
    - Gmail (fetch new threads from selected labels)
    - Slack (fetch new messages from selected channels)
    - Gong (fetch new call transcripts)
    - Fathom (fetch new meeting recordings)
    
    The sync runs asynchronously via Celery workers.
    Returns immediately with task IDs for tracking.
    """
    try:
        service = get_sources_service(db)
        
        # Get all connected sources for this workspace
        connected_sources = service.get_connected_sources(workspace_id)
        
        if not connected_sources:
            return SyncAllSourcesResponse(
                message="No connected data sources found",
                sync_operations=[],
                total_sources=0,
            )
        
        # Import Celery tasks from modular structure
        from app.sync_engine.tasks.ondemand import (
            sync_workspace_gmail,
            sync_workspace_slack,
            sync_workspace_gong,
            sync_workspace_fathom,
        )
        
        sync_operations = []
        hours_back = request.hours_back if request else 24
        
        # Group sources by type and dispatch appropriate Celery tasks
        source_types_found = set(s['type'] for s in connected_sources)
        
        for source_type in source_types_found:
            try:
                # Create sync history record for tracking
                sync_record = service.create_sync_record(
                    workspace_id=workspace_id,
                    sync_type="source",
                    source_type=source_type,
                    source_name=source_type.capitalize(),
                )
                
                # Dispatch appropriate Celery task based on source type
                task_result = None
                if source_type == "gmail":
                    task_result = sync_workspace_gmail.delay(
                        str(workspace_id),
                        str(sync_record.id),
                    )
                elif source_type == "slack":
                    task_result = sync_workspace_slack.delay(
                        str(workspace_id),
                        str(sync_record.id),
                        hours_back,
                    )
                elif source_type == "gong":
                    task_result = sync_workspace_gong.delay(
                        str(workspace_id),
                        str(sync_record.id),
                    )
                elif source_type == "fathom":
                    task_result = sync_workspace_fathom.delay(
                        str(workspace_id),
                        str(sync_record.id),
                    )
                
                if task_result:
                    sync_operations.append(SyncOperationResponse(
                        sync_id=str(sync_record.id),
                        status="queued",
                        message=f"Syncing {source_type}...",
                        source_type=source_type,
                        task_id=task_result.id if task_result else None,
                    ))
                    logger.info(f"Dispatched {source_type} sync task: {task_result.id if task_result else 'N/A'}")
                    
            except Exception as e:
                logger.error(f"Error dispatching {source_type} sync task: {e}")
                sync_operations.append(SyncOperationResponse(
                    sync_id="",
                    status="failed",
                    message=f"Failed to queue {source_type} sync: {str(e)}",
                    source_type=source_type,
                ))
        
        return SyncAllSourcesResponse(
            message=f"Queued sync for {len(sync_operations)} data source types",
            sync_operations=sync_operations,
            total_sources=len(sync_operations),
        )
        
    except ImportError as e:
        logger.error(f"Celery tasks not available: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Background task service not available. Please ensure Celery is running."
        )
    except Exception as e:
        logger.error(f"Error initiating sync: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate sync: {str(e)}"
        )


@router.post(
    "/{workspace_id}/sync-themes",
    response_model=SyncThemesResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Sync/update all themes",
    description="Process messages and update theme classifications via Celery"
)
async def sync_themes(
    workspace_id: UUID,
    request: Optional[SyncThemeRequest] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncThemesResponse:
    """
    Trigger theme synchronization.
    
    This endpoint dispatches a Celery task that:
    - Processes unprocessed messages
    - Extracts features using AI
    - Updates theme assignments
    - Records sync history
    
    The sync runs asynchronously via Celery workers.
    """
    try:
        service = get_sources_service(db)
        
        # Get themes to process
        themes = service.get_workspace_themes(workspace_id)
        
        if not themes:
            return SyncThemesResponse(
                message="No themes found to sync",
                sync_id="",
                status="skipped",
                themes_to_process=0,
            )
        
        # Get unique source types that have messages for this workspace
        from app.models.message import Message
        from sqlalchemy import distinct
        
        source_types = db.query(distinct(Message.source)).filter(
            Message.workspace_id == workspace_id
        ).all()
        source_types = [s[0] for s in source_types if s[0]]
        
        # Create sync record
        sync_record = service.create_sync_record(
            workspace_id=workspace_id,
            sync_type="theme",
            theme_name="All Themes",
            theme_sources=source_types,
        )
        
        # Import and dispatch Celery task from modular structure
        from app.sync_engine.tasks.ondemand import sync_workspace_themes
        
        reprocess_all = request.reprocess_all if request else False
        theme_ids = request.theme_ids if request else None
        
        task_result = sync_workspace_themes.delay(
            str(workspace_id),
            str(sync_record.id),
            theme_ids,
            reprocess_all,
        )
        
        logger.info(f"Dispatched theme sync task: {task_result.id}")
        
        return SyncThemesResponse(
            message=f"Queued theme sync for {len(themes)} themes",
            sync_id=str(sync_record.id),
            status="queued",
            themes_to_process=len(themes),
            task_id=task_result.id,
        )
        
    except ImportError as e:
        logger.error(f"Celery tasks not available: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Background task service not available. Please ensure Celery is running."
        )
    except Exception as e:
        logger.error(f"Error initiating theme sync: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate theme sync: {str(e)}"
        )


# ============ Sync Status Endpoint ============

@router.get(
    "/{workspace_id}/sync-status/{sync_id}",
    status_code=status.HTTP_200_OK,
    summary="Get sync operation status",
    description="Returns the current status of a sync operation"
)
async def get_sync_status(
    workspace_id: UUID,
    sync_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get status of a specific sync operation.
    
    Returns:
    - Current status (queued, in_progress, success, failed)
    - Items processed
    - Error message if failed
    """
    try:
        from app.models.sync_history import SyncHistory
        
        sync_record = db.query(SyncHistory).filter(
            SyncHistory.id == sync_id,
            SyncHistory.workspace_id == workspace_id,
        ).first()
        
        if not sync_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sync record not found"
            )
        
        return {
            "sync_id": str(sync_record.id),
            "status": sync_record.status,
            "sync_type": sync_record.sync_type,
            "source_type": sync_record.source_type,
            "source_name": sync_record.source_name or sync_record.theme_name,
            "items_processed": sync_record.items_processed,
            "items_new": sync_record.items_new,
            "started_at": sync_record.started_at.isoformat() if sync_record.started_at else None,
            "completed_at": sync_record.completed_at.isoformat() if sync_record.completed_at else None,
            "error_message": sync_record.error_message,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sync status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sync status"
        )


@router.get(
    "/{workspace_id}/sync-items/{sync_id}",
    status_code=status.HTTP_200_OK,
    summary="Get items synced in a specific sync operation",
    description="Returns the actual items (threads, messages, features) that were synced"
)
async def get_synced_items(
    workspace_id: UUID,
    sync_id: UUID,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=50, description="Items per page"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get items that were synced in a specific sync operation.

    Returns:
    - Gmail threads (for Gmail syncs)
    - Slack messages (for Slack syncs)
    - Features (for theme syncs)
    """
    try:
        service = get_sources_service(db)
        result = service.get_synced_items(workspace_id, sync_id, page, page_size)
        return result

    except Exception as e:
        logger.error(f"Error fetching synced items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch synced items"
        )

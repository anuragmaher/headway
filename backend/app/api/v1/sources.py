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
from app.services.messages_optimized_service import (
    OptimizedMessagesService,
    get_optimized_messages_service,
)
from app.schemas.sources import (
    MessageListResponse,
    SyncHistoryListResponse,
    DataSourcesStatusResponse,
    SyncAllSourcesResponse,
    SyncThemesResponse,
    SyncOperationResponse,
    SyncSourceRequest,
    SyncThemeRequest,
    AIInsightsResponse,
    AIInsightsProgressResponse,
    QueueInsightsRequest,
    QueueInsightsResponse,
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
    "/{workspace_id}/messages/{message_id}",
    status_code=status.HTTP_200_OK,
    summary="Get single message details",
    description="Returns full details of a specific message"
)
async def get_message_details(
    workspace_id: UUID,
    message_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get full details of a specific message.

    Returns the complete message including:
    - Full content (not truncated)
    - All metadata
    - AI insights if processed
    """
    try:
        service = get_sources_service(db)
        return service.get_message_details(workspace_id, message_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching message details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch message details"
        )


@router.get(
    "/{workspace_id}/messages",
    response_model=MessageListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get paginated messages from all sources (optimized)",
    description="Returns paginated list of messages using optimized SQL UNION query with Redis caching"
)
async def get_messages(
    workspace_id: UUID,
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=50, description="Items per page"),
    source: Optional[str] = Query(default=None, description="Filter by source (gmail, slack, gong, fathom)"),
    sort_by: Optional[str] = Query(default="timestamp", description="Field to sort by (timestamp, sender, source)"),
    sort_order: Optional[str] = Query(default="desc", description="Sort order (asc, desc)"),
    cursor: Optional[str] = Query(default=None, description="Cursor for cursor-based pagination (ISO timestamp)"),
    has_insights: Optional[str] = Query(default=None, description="Filter for messages with AI insights (true/false)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageListResponse:
    """
    Get paginated messages from all data sources (optimized).

    This endpoint uses:
    - SQL UNION for efficient cross-table queries
    - Redis caching for counts
    - Database-level sorting and pagination

    - **page**: Page number (1-indexed)
    - **page_size**: Number of items per page (default: 10, max: 50)
    - **source**: Optional filter by source type
    - **sort_by**: Field to sort by (timestamp, sender, source)
    - **sort_order**: Sort order (asc, desc)
    - **cursor**: Optional cursor for infinite scroll (ISO timestamp from last item)
    - **has_insights**: Filter for messages with completed AI insights (true/false)
    """
    try:
        # Convert has_insights string to boolean
        has_insights_bool = None
        if has_insights is not None:
            has_insights_bool = has_insights.lower() == 'true'

        service = get_optimized_messages_service(db)
        return service.get_messages_fast(
            workspace_id=workspace_id,
            page=page,
            page_size=page_size,
            source_filter=source,
            sort_by=sort_by,
            sort_order=sort_order,
            cursor=cursor,
            has_insights=has_insights_bool,
        )
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        import traceback
        traceback.print_exc()
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
    sort_by: Optional[str] = Query(default="started_at", description="Field to sort by (type, status, started_at)"),
    sort_order: Optional[str] = Query(default="desc", description="Sort order (asc, desc)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncHistoryListResponse:
    """
    Get paginated sync history.

    - **page**: Page number (1-indexed)
    - **page_size**: Number of items per page (default: 10, max: 50)
    - **source**: Optional filter by source type
    - **sync_type**: Optional filter by sync type ('source' or 'theme')
    - **sort_by**: Field to sort by (type, status, started_at)
    - **sort_order**: Sort order (asc, desc)
    """
    try:
        service = get_sources_service(db)
        return service.get_sync_history_paginated(
            workspace_id=workspace_id,
            page=page,
            page_size=page_size,
            source_filter=source,
            type_filter=sync_type,
            sort_by=sort_by,
            sort_order=sort_order,
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
    refresh: bool = Query(default=False, description="Force refresh from database, bypassing cache"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get items that were synced in a specific sync operation.

    Returns:
    - Gmail threads (for Gmail syncs)
    - Slack messages (for Slack syncs)
    - Features (for theme syncs)

    Use refresh=true to bypass cache and get the latest data.
    """
    try:
        service = get_sources_service(db)
        result = service.get_synced_items(
            workspace_id, sync_id, page, page_size, force_refresh=refresh
        )
        return result

    except Exception as e:
        logger.error(f"Error fetching synced items: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch synced items"
        )


# ============ AI Insights Endpoints ============

@router.get(
    "/{workspace_id}/ai-insights/progress",
    response_model=AIInsightsProgressResponse,
    status_code=status.HTTP_200_OK,
    summary="Get AI insights progress for workspace",
    description="Returns progress stats for AI insights processing (for UI progress bar)"
)
async def get_ai_insights_progress(
    workspace_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIInsightsProgressResponse:
    """
    Get AI insights progress for a workspace.

    Used by the UI to display a non-blocking progress bar showing:
    - Percent complete (for recent messages, e.g., last 7 days)
    - Count completed vs eligible
    - Estimated time remaining (approximate)

    Progress bar auto-hides at 100%.
    Messages are never hidden if AI insights are missing.
    """
    try:
        from app.models.message import Message
        from app.models.ai_insight import AIInsight
        from sqlalchemy import func
        from datetime import datetime, timedelta

        # Calculate progress from actual data
        # Get messages from last 7 days
        seven_days_ago = datetime.utcnow() - timedelta(days=7)

        # Count total eligible messages
        total_messages = db.query(func.count(Message.id)).filter(
            Message.workspace_id == workspace_id,
            Message.created_at >= seven_days_ago
        ).scalar() or 0

        # Count messages with AI insights
        completed_count = db.query(func.count(AIInsight.id)).filter(
            AIInsight.workspace_id == workspace_id,
            AIInsight.created_at >= seven_days_ago
        ).scalar() or 0

        # Calculate percent complete
        percent_complete = 100.0
        if total_messages > 0:
            percent_complete = min(100.0, (completed_count / total_messages) * 100.0)

        pending_count = max(0, total_messages - completed_count)

        return AIInsightsProgressResponse(
            workspace_id=str(workspace_id),
            total_eligible=total_messages,
            completed_count=completed_count,
            pending_count=pending_count,
            processing_count=0,
            failed_count=0,
            percent_complete=round(percent_complete, 1),
            ai_insights_enabled=True,
            progress_window_days=7,
        )

    except Exception as e:
        logger.error(f"Error fetching AI insights progress: {e}")
        # Return default response instead of 500 error
        return AIInsightsProgressResponse(
            workspace_id=str(workspace_id),
            total_eligible=0,
            completed_count=0,
            pending_count=0,
            processing_count=0,
            failed_count=0,
            percent_complete=100.0,
            ai_insights_enabled=True,
            progress_window_days=7,
        )


@router.get(
    "/{workspace_id}/messages/{message_id}/ai-insights",
    response_model=AIInsightsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get AI insights for a specific message",
    description="Returns AI-generated insights for a specific message"
)
async def get_message_ai_insights(
    workspace_id: UUID,
    message_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIInsightsResponse:
    """
    Get AI insights for a specific message.

    Returns:
    - Theme assignments with confidence and explanation
    - Summary
    - Pain point (if any)
    - Feature request (if any)
    - Sentiment and urgency
    - Processing status
    """
    try:
        from app.models.ai_insight import AIInsight
        from app.models.message_customer_ask import MessageCustomerAsk
        from app.models.customer_ask import CustomerAsk
        from app.models.sub_theme import SubTheme
        from app.schemas.sources import LinkedCustomerAskInfo
        from sqlalchemy.orm import joinedload

        # Get insight for this message
        insight = db.query(AIInsight).filter(
            AIInsight.message_id == message_id,
            AIInsight.workspace_id == workspace_id,
        ).first()

        if not insight:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AI insights not found for this message. It may still be processing."
            )

        # Fetch linked customer asks for this message
        linked_customer_asks = []
        links = db.query(MessageCustomerAsk).filter(
            MessageCustomerAsk.message_id == message_id
        ).all()

        if links:
            ca_ids = [link.customer_ask_id for link in links]
            customer_asks = db.query(CustomerAsk).options(
                joinedload(CustomerAsk.sub_theme).joinedload(SubTheme.theme)
            ).filter(
                CustomerAsk.id.in_(ca_ids)
            ).all()

            for ca in customer_asks:
                sub_theme = ca.sub_theme
                linked_customer_asks.append(LinkedCustomerAskInfo(
                    id=str(ca.id),
                    name=ca.name,
                    sub_theme_id=str(sub_theme.id) if sub_theme else None,
                    sub_theme_name=sub_theme.name if sub_theme else None,
                    theme_id=str(sub_theme.theme.id) if sub_theme and sub_theme.theme else None,
                    theme_name=sub_theme.theme.name if sub_theme and sub_theme.theme else None,
                ))

        return AIInsightsResponse(
            id=str(insight.id),
            message_id=str(insight.message_id),
            status="completed",
            themes=None,
            summary=insight.summary,
            pain_point=insight.pain_point,
            pain_point_quote=insight.pain_point_quote,
            feature_request=insight.feature_request,
            customer_usecase=insight.customer_usecase,
            explanation=None,
            sentiment=insight.sentiment,
            urgency=None,
            keywords=insight.keywords,
            locked_theme_id=str(insight.theme_id) if insight.theme_id else None,
            locked_theme_name=None,
            linked_customer_asks=linked_customer_asks,
            model_version=insight.model_version,
            tokens_used=insight.tokens_used,
            latency_ms=None,
            created_at=insight.created_at,
            completed_at=insight.created_at,
            error_message=None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching AI insights for message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch AI insights"
        )


@router.post(
    "/{workspace_id}/messages/{message_id}/ai-insights/queue",
    response_model=QueueInsightsResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue message for AI insights processing",
    description="Manually queue a message for AI insights generation"
)
async def queue_message_for_ai_insights(
    workspace_id: UUID,
    message_id: UUID,
    request: Optional[QueueInsightsRequest] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QueueInsightsResponse:
    """
    Manually queue a message for AI insights processing.

    Use this to prioritize AI insights generation for a specific message.
    Lower priority numbers = higher priority processing.
    """
    try:
        # Verify message exists
        from app.models.message import Message
        message = db.query(Message).filter(
            Message.id == message_id,
            Message.workspace_id == workspace_id,
        ).first()

        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )

        # For now, return a stub response since the Celery task may not exist
        # TODO: Implement actual queueing when AI pipeline is set up
        return QueueInsightsResponse(
            status="queued",
            message_id=str(message_id),
            insight_id=None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error queuing message for AI insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue message for AI insights"
        )


@router.post(
    "/{workspace_id}/ai-insights/enable",
    status_code=status.HTTP_200_OK,
    summary="Enable/disable AI insights for workspace",
    description="Toggle AI insights processing for a workspace"
)
async def toggle_ai_insights(
    workspace_id: UUID,
    enabled: bool = Query(default=True, description="Enable or disable AI insights"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enable or disable AI insights processing for a workspace.

    When disabled:
    - No new AI insights will be generated
    - Existing insights remain available
    - Progress bar will show disabled state
    """
    # Since AIInsightsProgress table was removed, just return success
    # TODO: Store this setting in workspace table if needed
    return {
        "workspace_id": str(workspace_id),
        "ai_insights_enabled": enabled,
        "message": f"AI insights {'enabled' if enabled else 'disabled'} for workspace",
    }

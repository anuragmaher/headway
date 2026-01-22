"""
Messages API - Manages messages and AI insights
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID

from app.core.deps import get_current_user, get_db
from app.services.message_service import MessageService, AIInsightService
from app.schemas.message import (
    MessageResponse, MessageListResponse, MessageWithInsights,
    AIInsightResponse, AIInsightListResponse, SyncHistoryResponse,
    SyncHistoryListResponse
)
from app.models.sync_history import SyncHistory

router = APIRouter()


# === Message Endpoints ===

@router.get("", response_model=MessageListResponse)
async def list_messages(
    source: Optional[str] = None,
    connector_id: Optional[UUID] = None,
    customer_ask_id: Optional[UUID] = None,
    is_processed: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List messages with pagination and filters"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = MessageService(db)
    messages, total = service.list_messages(
        workspace_id=UUID(workspace_id),
        source=source,
        connector_id=connector_id,
        customer_ask_id=customer_ask_id,
        is_processed=is_processed,
        page=page,
        page_size=page_size
    )

    return MessageListResponse(
        messages=[MessageResponse.model_validate(m) for m in messages],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/stats")
async def get_message_stats(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get message statistics"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = MessageService(db)
    stats = service.get_message_stats(UUID(workspace_id))

    return stats


@router.get("/search", response_model=List[MessageResponse])
async def search_messages(
    q: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search messages by content"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = MessageService(db)
    messages = service.search_messages(UUID(workspace_id), q, limit)

    return [MessageResponse.model_validate(m) for m in messages]


@router.get("/{message_id}", response_model=MessageWithInsights)
async def get_message(
    message_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a message with its AI insights"""
    service = MessageService(db)
    message = service.get_message(message_id)

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    if str(message.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get AI insight for the message
    insight_service = AIInsightService(db)
    insight = insight_service.get_insight_by_message(message_id)

    response = MessageWithInsights.model_validate(message)
    if insight:
        response.ai_insights = AIInsightResponse.model_validate(insight)

    return response


@router.post("/{message_id}/assign-customer-ask", response_model=MessageResponse)
async def assign_message_to_customer_ask(
    message_id: UUID,
    customer_ask_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Assign a message to a customer ask"""
    service = MessageService(db)
    message = service.get_message(message_id)

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    if str(message.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    updated = service.assign_to_customer_ask(message_id, customer_ask_id)
    return MessageResponse.model_validate(updated)


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a message"""
    service = MessageService(db)
    message = service.get_message(message_id)

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    if str(message.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service.delete_message(message_id)


# === AI Insights Endpoints ===

@router.get("/insights", response_model=AIInsightListResponse)
async def list_insights(
    theme_id: Optional[UUID] = None,
    sub_theme_id: Optional[UUID] = None,
    customer_ask_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List AI insights with filters"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = AIInsightService(db)
    insights, total = service.list_insights(
        workspace_id=UUID(workspace_id),
        theme_id=theme_id,
        sub_theme_id=sub_theme_id,
        customer_ask_id=customer_ask_id,
        page=page,
        page_size=page_size
    )

    return AIInsightListResponse(
        insights=[AIInsightResponse.model_validate(i) for i in insights],
        total=total
    )


@router.get("/insights/{insight_id}", response_model=AIInsightResponse)
async def get_insight(
    insight_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get an AI insight"""
    service = AIInsightService(db)
    insight = service.get_insight(insight_id)

    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found"
        )

    if str(insight.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return AIInsightResponse.model_validate(insight)


# === Sync History Endpoints ===

@router.get("/sync-history", response_model=SyncHistoryListResponse)
async def list_sync_history(
    sync_type: Optional[str] = None,
    connector_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List sync history"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    query = db.query(SyncHistory).filter(
        SyncHistory.workspace_id == UUID(workspace_id)
    )

    if sync_type:
        query = query.filter(SyncHistory.sync_type == sync_type)
    if connector_id:
        query = query.filter(SyncHistory.connector_id == connector_id)

    total = query.count()
    history = query.order_by(SyncHistory.started_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return SyncHistoryListResponse(
        history=[SyncHistoryResponse.model_validate(h) for h in history],
        total=total
    )


@router.get("/sync-history/{sync_id}", response_model=SyncHistoryResponse)
async def get_sync_history(
    sync_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get sync history details"""
    history = db.query(SyncHistory).filter(SyncHistory.id == sync_id).first()

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sync history not found"
        )

    if str(history.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return SyncHistoryResponse.model_validate(history)

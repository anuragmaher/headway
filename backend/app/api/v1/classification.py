from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.message_classification_service import message_classification_service
from app.services.llm_message_classification_service import llm_message_classification_service

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request/response
class ClassifyMessagesRequest(BaseModel):
    max_messages: Optional[int] = None


class ClassificationResultResponse(BaseModel):
    status: str
    messages_processed: int
    clusters_used: int
    features_created: int
    message: Optional[str] = None


class ClassificationStatsResponse(BaseModel):
    total_messages: int
    classified_messages: int
    classification_rate: float
    total_features: int
    approved_clusters: int


@router.post("/classify-messages", response_model=ClassificationResultResponse)
async def classify_messages_to_features(
    request: ClassifyMessagesRequest,
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Classify all messages in a workspace using approved clusters and create features
    """
    try:
        # Verify user has access to workspace
        # (This would typically check workspace permissions)

        result = message_classification_service.classify_messages_to_features(
            workspace_id=workspace_id,
            limit=request.max_messages
        )

        return ClassificationResultResponse(
            status=result["status"],
            messages_processed=result.get("messages_processed", 0),
            clusters_used=result.get("clusters_used", 0),
            features_created=result.get("features_created", 0),
            message=result.get("message")
        )

    except Exception as e:
        logger.error(f"Error classifying messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to classify messages: {str(e)}"
        )


@router.get("/stats", response_model=ClassificationStatsResponse)
async def get_classification_stats(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get statistics about message classification for a workspace
    """
    try:
        stats = message_classification_service.get_classification_stats(workspace_id)

        return ClassificationStatsResponse(
            total_messages=stats["total_messages"],
            classified_messages=stats["classified_messages"],
            classification_rate=stats["classification_rate"],
            total_features=stats["total_features"],
            approved_clusters=stats["approved_clusters"]
        )

    except Exception as e:
        logger.error(f"Error getting classification stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get classification stats: {str(e)}"
        )


@router.post("/reclassify")
async def reclassify_all_messages(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reclassify all messages from scratch (useful after new clusters are approved)
    """
    try:
        # First, clear existing message-feature relationships
        # This would need to be implemented to avoid duplicates

        result = message_classification_service.classify_messages_to_features(
            workspace_id=workspace_id
        )

        return {
            "message": "Reclassification completed",
            "result": result
        }

    except Exception as e:
        logger.error(f"Error reclassifying messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reclassify messages: {str(e)}"
        )


@router.post("/llm-classify-messages")
async def llm_classify_messages_to_features(
    request: ClassifyMessagesRequest,
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Classify messages using LLM to determine feature assignment
    """
    try:
        result = llm_message_classification_service.classify_messages_to_features(
            workspace_id=workspace_id,
            limit=request.max_messages
        )

        return {
            "status": result["status"],
            "messages_processed": result.get("messages_processed", 0),
            "features_created": result.get("features_created", 0),
            "features_updated": result.get("features_updated", 0),
            "created_features": result.get("created_features", []),
            "updated_features": result.get("updated_features", []),
            "message": result.get("message")
        }

    except Exception as e:
        logger.error(f"Error in LLM classification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to classify messages with LLM: {str(e)}"
        )
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging
from datetime import datetime

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.feature import Feature
from app.models.theme import Theme
from app.models.message import Message

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request/response
class ThemeCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class ThemeUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class FeatureResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    urgency: str
    status: str
    mention_count: int
    theme_id: Optional[str]
    first_mentioned: str
    last_mentioned: str
    created_at: str
    updated_at: Optional[str]

    class Config:
        from_attributes = True


class ThemeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    feature_count: int

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: str
    content: str
    sent_at: str
    sender_name: Optional[str]
    channel_name: Optional[str]

    class Config:
        from_attributes = True


@router.get("/themes", response_model=List[ThemeResponse])
async def get_themes(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all themes for a workspace with feature counts
    """
    try:
        themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).all()

        # Convert to response format with feature counts
        theme_responses = []
        for theme in themes:
            feature_count = db.query(Feature).filter(
                Feature.theme_id == theme.id
            ).count()

            theme_responses.append(ThemeResponse(
                id=str(theme.id),
                name=theme.name,
                description=theme.description,
                feature_count=feature_count
            ))

        return theme_responses

    except Exception as e:
        logger.error(f"Error getting themes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get themes: {str(e)}"
        )


@router.post("/themes", response_model=ThemeResponse)
async def create_theme(
    request: ThemeCreateRequest,
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new theme for a workspace
    """
    try:
        # Check if theme with same name already exists in workspace
        existing_theme = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.name == request.name
        ).first()

        if existing_theme:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Theme '{request.name}' already exists"
            )

        # Create new theme
        new_theme = Theme(
            name=request.name,
            description=request.description,
            workspace_id=workspace_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(new_theme)
        db.commit()
        db.refresh(new_theme)

        # Calculate feature count (should be 0 for new themes)
        feature_count = db.query(Feature).filter(
            Feature.theme_id == new_theme.id
        ).count()

        return ThemeResponse(
            id=str(new_theme.id),
            name=new_theme.name,
            description=new_theme.description,
            feature_count=feature_count
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating theme: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create theme: {str(e)}"
        )


@router.put("/themes/{theme_id}", response_model=ThemeResponse)
async def update_theme(
    theme_id: str,
    request: ThemeUpdateRequest,
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing theme
    """
    try:
        # Find the theme
        theme = db.query(Theme).filter(
            Theme.id == theme_id,
            Theme.workspace_id == workspace_id
        ).first()

        if not theme:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Theme not found"
            )

        # Check if new name conflicts with existing themes (if name is being changed)
        if request.name and request.name != theme.name:
            existing_theme = db.query(Theme).filter(
                Theme.workspace_id == workspace_id,
                Theme.name == request.name,
                Theme.id != theme_id
            ).first()

            if existing_theme:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Theme '{request.name}' already exists"
                )

        # Update theme fields
        if request.name is not None:
            theme.name = request.name
        if request.description is not None:
            theme.description = request.description

        theme.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(theme)

        # Calculate feature count
        feature_count = db.query(Feature).filter(
            Feature.theme_id == theme.id
        ).count()

        return ThemeResponse(
            id=str(theme.id),
            name=theme.name,
            description=theme.description,
            feature_count=feature_count
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating theme {theme_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update theme: {str(e)}"
        )


@router.delete("/themes/{theme_id}")
async def delete_theme(
    theme_id: str,
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a theme and unassign it from associated features
    """
    try:
        # Find the theme
        theme = db.query(Theme).filter(
            Theme.id == theme_id,
            Theme.workspace_id == workspace_id
        ).first()

        if not theme:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Theme not found"
            )

        # Update features to remove theme association
        features_updated = db.query(Feature).filter(
            Feature.theme_id == theme_id
        ).update({"theme_id": None, "updated_at": datetime.utcnow()})

        # Delete the theme
        db.delete(theme)
        db.commit()

        return {
            "message": "Theme deleted successfully",
            "theme_id": theme_id,
            "features_unassigned": features_updated
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting theme {theme_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete theme: {str(e)}"
        )


@router.get("/features", response_model=List[FeatureResponse])
async def get_features(
    workspace_id: str,
    theme_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all features for a workspace, optionally filtered by theme
    """
    try:
        query = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        )

        if theme_id:
            query = query.filter(Feature.theme_id == theme_id)

        features = query.order_by(Feature.last_mentioned.desc()).all()

        # Convert to response format
        feature_responses = []
        for feature in features:
            feature_responses.append(FeatureResponse(
                id=str(feature.id),
                name=feature.name,
                description=feature.description,
                urgency=feature.urgency,
                status=feature.status,
                mention_count=feature.mention_count,
                theme_id=str(feature.theme_id) if feature.theme_id else None,
                first_mentioned=feature.first_mentioned.isoformat() if feature.first_mentioned else "",
                last_mentioned=feature.last_mentioned.isoformat() if feature.last_mentioned else "",
                created_at=feature.created_at.isoformat() if feature.created_at else "",
                updated_at=feature.updated_at.isoformat() if feature.updated_at else None
            ))

        return feature_responses

    except Exception as e:
        logger.error(f"Error getting features: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get features: {str(e)}"
        )


@router.get("/features/{feature_id}", response_model=FeatureResponse)
async def get_feature(
    feature_id: str,
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific feature by ID
    """
    try:
        feature = db.query(Feature).filter(
            Feature.id == feature_id,
            Feature.workspace_id == workspace_id
        ).first()

        if not feature:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feature not found"
            )

        return FeatureResponse(
            id=str(feature.id),
            name=feature.name,
            description=feature.description,
            urgency=feature.urgency,
            status=feature.status,
            mention_count=feature.mention_count,
            theme_id=str(feature.theme_id) if feature.theme_id else None,
            first_mentioned=feature.first_mentioned.isoformat() if feature.first_mentioned else "",
            last_mentioned=feature.last_mentioned.isoformat() if feature.last_mentioned else "",
            created_at=feature.created_at.isoformat() if feature.created_at else "",
            updated_at=feature.updated_at.isoformat() if feature.updated_at else None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting feature {feature_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get feature: {str(e)}"
        )


@router.get("/features/{feature_id}/messages", response_model=List[MessageResponse])
async def get_feature_messages(
    feature_id: str,
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all messages associated with a specific feature
    """
    try:
        # First verify the feature exists and belongs to the workspace
        feature = db.query(Feature).filter(
            Feature.id == feature_id,
            Feature.workspace_id == workspace_id
        ).first()

        if not feature:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feature not found"
            )

        # Get messages through the many-to-many relationship
        messages = db.query(Message).join(
            Message.features
        ).filter(
            Feature.id == feature_id
        ).order_by(Message.sent_at.desc()).all()

        # Convert to response format
        message_responses = []
        for message in messages:
            message_responses.append(MessageResponse(
                id=str(message.id),
                content=message.content,
                sent_at=message.sent_at.isoformat() if message.sent_at else "",
                sender_name=message.author_name,
                channel_name=message.channel_name
            ))

        return message_responses

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting messages for feature {feature_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get feature messages: {str(e)}"
        )
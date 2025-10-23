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
from app.models.workspace_data_point import WorkspaceDataPoint

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request/response
class ThemeCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    parent_theme_id: Optional[str] = None


class ThemeUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_theme_id: Optional[str] = None


class FeatureUpdateRequest(BaseModel):
    theme_id: Optional[str] = None
    status: Optional[str] = None
    urgency: Optional[str] = None


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
    data_points: Optional[List[dict]] = None
    ai_metadata: Optional[dict] = None

    class Config:
        from_attributes = True


class ThemeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    feature_count: int
    parent_theme_id: Optional[str]
    sub_theme_count: int = 0
    level: int = 0  # 0 for root themes, 1 for sub-themes, etc.

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: str
    content: str
    sent_at: str
    sender_name: Optional[str]
    channel_name: Optional[str]
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    ai_insights: Optional[dict] = None

    class Config:
        from_attributes = True


def get_formatted_data_points(db: Session, feature_id: str) -> List[dict]:
    """
    Fetch and format data points for a feature from workspace_data_points table

    Returns list of data point entries grouped by message, formatted for frontend display
    """
    # Fetch all data points for this feature
    data_points = db.query(WorkspaceDataPoint).filter(
        WorkspaceDataPoint.feature_id == feature_id
    ).order_by(WorkspaceDataPoint.extracted_at.desc()).all()

    if not data_points:
        return []

    # Group data points by message_id
    grouped_by_message = {}
    for dp in data_points:
        message_id = str(dp.message_id)
        if message_id not in grouped_by_message:
            grouped_by_message[message_id] = {
                'author': dp.author,
                'timestamp': dp.extracted_at.isoformat() if dp.extracted_at else '',
                'structured_metrics': {},
                'business_metrics': {},
                'entities': {},
                'other': {}
            }

        # Get the value
        value = dp.numeric_value or dp.integer_value or dp.text_value

        # Categorize the data point
        category = dp.data_point_category
        if category == 'structured_metrics':
            grouped_by_message[message_id]['structured_metrics'][dp.data_point_key] = value
        elif category == 'business_metrics':
            grouped_by_message[message_id]['business_metrics'][dp.data_point_key] = value
        elif category == 'entities':
            grouped_by_message[message_id]['entities'][dp.data_point_key] = value
        else:
            grouped_by_message[message_id]['other'][dp.data_point_key] = value

    # Convert to list format expected by frontend
    return list(grouped_by_message.values())


@router.get("/themes", response_model=List[ThemeResponse])
async def get_themes(
    workspace_id: str,
    include_sub_themes: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all themes for a workspace with feature counts
    Returns hierarchical theme structure by default
    """
    try:
        from sqlalchemy import func

        # Get all themes for the workspace
        themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).order_by(Theme.parent_theme_id.asc().nullsfirst(), Theme.sort_order.asc()).all()

        # Batch query for feature counts - ONE query instead of N
        feature_counts_query = db.query(
            Feature.theme_id,
            func.count(Feature.id).label('count')
        ).filter(
            Feature.theme_id.in_([t.id for t in themes])
        ).group_by(Feature.theme_id).all()

        feature_counts = {str(theme_id): count for theme_id, count in feature_counts_query}

        # Batch query for sub-theme counts - ONE query instead of N
        sub_theme_counts_query = db.query(
            Theme.parent_theme_id,
            func.count(Theme.id).label('count')
        ).filter(
            Theme.parent_theme_id.in_([t.id for t in themes])
        ).group_by(Theme.parent_theme_id).all()

        sub_theme_counts = {str(parent_id): count for parent_id, count in sub_theme_counts_query}

        def calculate_level(theme, all_themes, memo={}):
            if theme.id in memo:
                return memo[theme.id]

            if theme.parent_theme_id is None:
                memo[theme.id] = 0
                return 0

            parent = next((t for t in all_themes if t.id == theme.parent_theme_id), None)
            if parent is None:
                memo[theme.id] = 0
                return 0

            level = calculate_level(parent, all_themes, memo) + 1
            memo[theme.id] = level
            return level

        # Convert to response format with feature counts and hierarchy info
        theme_responses = []
        for theme in themes:
            theme_id_str = str(theme.id)
            feature_count = feature_counts.get(theme_id_str, 0)
            sub_theme_count = sub_theme_counts.get(theme_id_str, 0)
            level = calculate_level(theme, themes)

            theme_responses.append(ThemeResponse(
                id=theme_id_str,
                name=theme.name,
                description=theme.description,
                feature_count=feature_count,
                parent_theme_id=str(theme.parent_theme_id) if theme.parent_theme_id else None,
                sub_theme_count=sub_theme_count,
                level=level
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

        # Validate parent theme if provided
        parent_theme = None
        if request.parent_theme_id:
            parent_theme = db.query(Theme).filter(
                Theme.id == request.parent_theme_id,
                Theme.workspace_id == workspace_id
            ).first()

            if not parent_theme:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent theme not found"
                )

        # Create new theme
        new_theme = Theme(
            name=request.name,
            description=request.description,
            workspace_id=workspace_id,
            parent_theme_id=request.parent_theme_id,
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

        # Calculate sub-theme count
        sub_theme_count = db.query(Theme).filter(
            Theme.parent_theme_id == new_theme.id
        ).count()

        # Calculate level
        level = 0 if not parent_theme else 1  # Simple calculation for now

        return ThemeResponse(
            id=str(new_theme.id),
            name=new_theme.name,
            description=new_theme.description,
            feature_count=feature_count,
            parent_theme_id=str(new_theme.parent_theme_id) if new_theme.parent_theme_id else None,
            sub_theme_count=sub_theme_count,
            level=level
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

        # Validate parent theme if being changed
        if request.parent_theme_id is not None and request.parent_theme_id != theme.parent_theme_id:
            if request.parent_theme_id == str(theme.id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Theme cannot be its own parent"
                )

            if request.parent_theme_id:
                parent_theme = db.query(Theme).filter(
                    Theme.id == request.parent_theme_id,
                    Theme.workspace_id == workspace_id
                ).first()

                if not parent_theme:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Parent theme not found"
                    )

        # Update theme fields
        if request.name is not None:
            theme.name = request.name
        if request.description is not None:
            theme.description = request.description
        if request.parent_theme_id is not None:
            theme.parent_theme_id = request.parent_theme_id if request.parent_theme_id else None

        theme.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(theme)

        # Calculate feature count
        feature_count = db.query(Feature).filter(
            Feature.theme_id == theme.id
        ).count()

        # Calculate sub-theme count
        sub_theme_count = db.query(Theme).filter(
            Theme.parent_theme_id == theme.id
        ).count()

        # Calculate level
        level = 0
        if theme.parent_theme_id:
            parent = db.query(Theme).filter(Theme.id == theme.parent_theme_id).first()
            level = 1 if parent else 0

        return ThemeResponse(
            id=str(theme.id),
            name=theme.name,
            description=theme.description,
            feature_count=feature_count,
            parent_theme_id=str(theme.parent_theme_id) if theme.parent_theme_id else None,
            sub_theme_count=sub_theme_count,
            level=level
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

        if not features:
            return []

        # OPTIMIZATION: Fetch ALL data points in a single query
        feature_ids = [str(f.id) for f in features]
        all_data_points = db.query(WorkspaceDataPoint).filter(
            WorkspaceDataPoint.feature_id.in_(feature_ids)
        ).order_by(WorkspaceDataPoint.extracted_at.desc()).all()

        # Group data points by feature_id and message_id
        data_points_by_feature = {}
        for dp in all_data_points:
            feature_id = str(dp.feature_id)
            message_id = str(dp.message_id)

            if feature_id not in data_points_by_feature:
                data_points_by_feature[feature_id] = {}

            if message_id not in data_points_by_feature[feature_id]:
                data_points_by_feature[feature_id][message_id] = {
                    'author': dp.author,
                    'timestamp': dp.extracted_at.isoformat() if dp.extracted_at else '',
                    'structured_metrics': {},
                    'business_metrics': {},
                    'entities': {},
                    'other': {}
                }

            # Get the value
            value = dp.numeric_value or dp.integer_value or dp.text_value

            # Categorize the data point
            category = dp.data_point_category
            message_data = data_points_by_feature[feature_id][message_id]
            if category == 'structured_metrics':
                message_data['structured_metrics'][dp.data_point_key] = value
            elif category == 'business_metrics':
                message_data['business_metrics'][dp.data_point_key] = value
            elif category == 'entities':
                message_data['entities'][dp.data_point_key] = value
            else:
                message_data['other'][dp.data_point_key] = value

        # Convert to response format
        feature_responses = []
        for feature in features:
            feature_id = str(feature.id)
            # Get data points for this feature (already grouped)
            data_points = list(data_points_by_feature.get(feature_id, {}).values())

            feature_responses.append(FeatureResponse(
                id=feature_id,
                name=feature.name,
                description=feature.description,
                urgency=feature.urgency,
                status=feature.status,
                mention_count=feature.mention_count,
                theme_id=str(feature.theme_id) if feature.theme_id else None,
                first_mentioned=feature.first_mentioned.isoformat() if feature.first_mentioned else "",
                last_mentioned=feature.last_mentioned.isoformat() if feature.last_mentioned else "",
                created_at=feature.created_at.isoformat() if feature.created_at else "",
                updated_at=feature.updated_at.isoformat() if feature.updated_at else None,
                data_points=data_points,
                ai_metadata=feature.ai_metadata
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
            updated_at=feature.updated_at.isoformat() if feature.updated_at else None,
            data_points=feature.data_points if feature.data_points else [],
            ai_metadata=feature.ai_metadata
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting feature {feature_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get feature: {str(e)}"
        )


@router.put("/features/{feature_id}", response_model=FeatureResponse)
async def update_feature(
    feature_id: str,
    request: FeatureUpdateRequest,
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a feature (theme_id, status, urgency)
    """
    try:
        # Find the feature
        feature = db.query(Feature).filter(
            Feature.id == feature_id,
            Feature.workspace_id == workspace_id
        ).first()

        if not feature:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feature not found"
            )

        # Validate theme if being updated
        if request.theme_id is not None:
            if request.theme_id:  # If not empty string
                theme = db.query(Theme).filter(
                    Theme.id == request.theme_id,
                    Theme.workspace_id == workspace_id
                ).first()

                if not theme:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Theme not found"
                    )

        # Update fields
        if request.theme_id is not None:
            feature.theme_id = request.theme_id if request.theme_id else None
        if request.status is not None:
            feature.status = request.status
        if request.urgency is not None:
            feature.urgency = request.urgency

        feature.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(feature)

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
            updated_at=feature.updated_at.isoformat() if feature.updated_at else None,
            data_points=feature.data_points if feature.data_points else [],
            ai_metadata=feature.ai_metadata
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating feature {feature_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update feature: {str(e)}"
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
            customer_name = message.customer.name if message.customer else None
            message_responses.append(MessageResponse(
                id=str(message.id),
                content=message.content,
                sent_at=message.sent_at.isoformat() if message.sent_at else "",
                sender_name=message.author_name,
                channel_name=message.channel_name,
                customer_name=customer_name,
                customer_email=message.author_email,
                ai_insights=message.ai_insights
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


# Helper function to get feature MRR and metadata
def _get_feature_mrr_data(feature: Feature, data_points: list) -> dict:
    """Extract MRR and metadata for a feature"""
    feature_mrr = 0
    customer_name = "Unknown"
    product = "Unknown"

    feature_data_points = [dp for dp in data_points if str(dp.feature_id) == str(feature.id)]

    for dp in feature_data_points:
        if dp.data_point_category == 'business_metrics' and dp.data_point_key == 'mrr':
            if dp.numeric_value:
                feature_mrr += float(dp.numeric_value)

        if dp.data_point_category == 'entities':
            if dp.data_point_key in ['company_name', 'customer_name'] and dp.text_value:
                customer_name = dp.text_value
            elif dp.data_point_key == 'product' and dp.text_value:
                product = dp.text_value

    return {
        'mrr': feature_mrr,
        'customer': customer_name,
        'product': product
    }


@router.get("/dashboard-metrics/all")
async def get_all_dashboard_metrics(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get ALL dashboard metrics in a single response - OPTIMIZED for Railway

    This endpoint combines all 6 dashboard metric queries into one response,
    reducing network latency from 6 HTTPS round-trips to 1.
    """
    try:
        from sqlalchemy import func, case

        # 1. Summary metrics (4 separate scalar queries)
        total_requests = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id
        ).scalar()

        total_mrr_impact = db.query(
            func.coalesce(func.sum(WorkspaceDataPoint.numeric_value), 0)
        ).filter(
            WorkspaceDataPoint.workspace_id == workspace_id,
            WorkspaceDataPoint.data_point_category == 'business_metrics',
            WorkspaceDataPoint.data_point_key == 'mrr'
        ).scalar() or 0

        urgent_items = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id,
            func.lower(Feature.urgency).in_(['urgent', 'high'])
        ).scalar()

        deal_blockers = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id,
            (Feature.status == 'deal_lost') | (func.lower(Feature.urgency) == 'impending_churn')
        ).scalar()

        # 2. By urgency
        urgency_counts = db.query(
            func.lower(Feature.urgency).label('urgency'),
            func.count(Feature.id).label('count')
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(func.lower(Feature.urgency)).all()

        mrr_by_feature = db.query(
            Feature.id.label('feature_id'),
            Feature.urgency,
            func.coalesce(func.sum(WorkspaceDataPoint.numeric_value), 0).label('mrr')
        ).outerjoin(
            WorkspaceDataPoint,
            (WorkspaceDataPoint.feature_id == Feature.id) &
            (WorkspaceDataPoint.data_point_category == 'business_metrics') &
            (WorkspaceDataPoint.data_point_key == 'mrr')
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(Feature.id, Feature.urgency).subquery()

        mrr_by_urgency = db.query(
            func.lower(mrr_by_feature.c.urgency).label('urgency'),
            func.sum(mrr_by_feature.c.mrr).label('total_mrr')
        ).group_by(func.lower(mrr_by_feature.c.urgency)).all()

        urgency_mapping = {
            'high': 'urgent', 'medium': 'important', 'low': 'nice_to_have',
            'impending_churn': 'impending_churn', None: 'nice_to_have'
        }

        by_urgency = {
            'urgent': {'count': 0, 'mrr': 0}, 'important': {'count': 0, 'mrr': 0},
            'nice_to_have': {'count': 0, 'mrr': 0}, 'impending_churn': {'count': 0, 'mrr': 0}
        }

        for urgency, count in urgency_counts:
            mapped_key = urgency_mapping.get(urgency, 'nice_to_have')
            by_urgency[mapped_key]['count'] += count

        for urgency, mrr in mrr_by_urgency:
            mapped_key = urgency_mapping.get(urgency, 'nice_to_have')
            by_urgency[mapped_key]['mrr'] += float(mrr or 0)

        # 3. By product (top 10)
        by_product = db.query(
            func.coalesce(WorkspaceDataPoint.text_value, 'Unknown').label('product'),
            func.count(func.distinct(Feature.id)).label('count'),
            func.coalesce(
                func.sum(case((WorkspaceDataPoint.data_point_key == 'mrr', WorkspaceDataPoint.numeric_value), else_=0)),
                0
            ).label('mrr')
        ).select_from(Feature).outerjoin(
            WorkspaceDataPoint, WorkspaceDataPoint.feature_id == Feature.id
        ).filter(
            Feature.workspace_id == workspace_id,
            (WorkspaceDataPoint.data_point_category == 'entities') &
            (WorkspaceDataPoint.data_point_key == 'product') |
            (WorkspaceDataPoint.id == None)
        ).group_by(WorkspaceDataPoint.text_value).order_by(
            func.count(func.distinct(Feature.id)).desc()
        ).limit(10).all()

        # 4. Top categories (top 10)
        top_categories = db.query(
            Theme.name.label('category'),
            func.count(Feature.id).label('count'),
            func.coalesce(
                func.sum(case((WorkspaceDataPoint.data_point_key == 'mrr', WorkspaceDataPoint.numeric_value), else_=0)),
                0
            ).label('mrr')
        ).select_from(Feature).join(Theme, Feature.theme_id == Theme.id).outerjoin(
            WorkspaceDataPoint,
            (WorkspaceDataPoint.feature_id == Feature.id) &
            (WorkspaceDataPoint.data_point_category == 'business_metrics')
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(Theme.name).order_by(func.count(Feature.id).desc()).limit(10).all()

        # 5. Critical attention (top 5)
        critical_attention = db.query(
            Feature.name.label('feature'),
            Feature.urgency,
            func.max(
                case(
                    ((WorkspaceDataPoint.data_point_category == 'entities') &
                     (WorkspaceDataPoint.data_point_key.in_(['company_name', 'customer_name'])),
                     WorkspaceDataPoint.text_value),
                    else_='Unknown'
                )
            ).label('customer'),
            func.max(
                case(
                    ((WorkspaceDataPoint.data_point_category == 'entities') &
                     (WorkspaceDataPoint.data_point_key == 'product'),
                     WorkspaceDataPoint.text_value),
                    else_='Unknown'
                )
            ).label('product'),
            func.coalesce(
                func.sum(
                    case(
                        ((WorkspaceDataPoint.data_point_category == 'business_metrics') &
                         (WorkspaceDataPoint.data_point_key == 'mrr'),
                         WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ).label('mrr')
        ).select_from(Feature).outerjoin(
            WorkspaceDataPoint, WorkspaceDataPoint.feature_id == Feature.id
        ).filter(
            Feature.workspace_id == workspace_id,
            func.lower(Feature.urgency).in_(['urgent', 'high'])
        ).group_by(Feature.id, Feature.name, Feature.urgency).having(
            func.coalesce(
                func.sum(
                    case(
                        ((WorkspaceDataPoint.data_point_category == 'business_metrics') &
                         (WorkspaceDataPoint.data_point_key == 'mrr'),
                         WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ) > 0
        ).order_by(func.sum(WorkspaceDataPoint.numeric_value).desc()).limit(5).all()

        # 6. Top MRR (top 10)
        top_mrr = db.query(
            Feature.id.label('feature_id'),
            Feature.name.label('feature'),
            Feature.urgency,
            func.max(
                case(
                    ((WorkspaceDataPoint.data_point_category == 'entities') &
                     (WorkspaceDataPoint.data_point_key.in_(['company_name', 'customer_name'])),
                     WorkspaceDataPoint.text_value),
                    else_='Unknown'
                )
            ).label('customer'),
            func.max(
                case(
                    ((WorkspaceDataPoint.data_point_category == 'entities') &
                     (WorkspaceDataPoint.data_point_key == 'product'),
                     WorkspaceDataPoint.text_value),
                    else_='Unknown'
                )
            ).label('product'),
            func.coalesce(
                func.sum(
                    case(
                        ((WorkspaceDataPoint.data_point_category == 'business_metrics') &
                         (WorkspaceDataPoint.data_point_key == 'mrr'),
                         WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ).label('mrr')
        ).select_from(Feature).outerjoin(
            WorkspaceDataPoint, WorkspaceDataPoint.feature_id == Feature.id
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(Feature.id, Feature.name, Feature.urgency).order_by(
            func.coalesce(
                func.sum(
                    case(
                        ((WorkspaceDataPoint.data_point_category == 'business_metrics') &
                         (WorkspaceDataPoint.data_point_key == 'mrr'),
                         WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ).desc()
        ).limit(10).all()

        # Return everything in one response
        return {
            'summary': {
                'total_requests': total_requests,
                'total_mrr_impact': float(total_mrr_impact),
                'deal_blockers': deal_blockers,
                'urgent_items': urgent_items
            },
            'by_urgency': by_urgency,
            'by_product': [
                {'product': product, 'count': count, 'mrr': float(mrr or 0)}
                for product, count, mrr in by_product
            ],
            'top_categories': [
                {'category': category, 'count': count, 'mrr': float(mrr or 0)}
                for category, count, mrr in top_categories
            ],
            'critical_attention': [
                {
                    'urgency': 'URGENT' if urgency.lower() in ['urgent', 'high'] else 'IMPORTANT',
                    'customer': customer, 'mrr': float(mrr or 0),
                    'feature': feature, 'product': product
                }
                for feature, urgency, customer, product, mrr in critical_attention
            ],
            'top_mrr': [
                {
                    'feature_id': str(feature_id), 'customer': customer, 'mrr': float(mrr or 0),
                    'urgency': urgency, 'feature': feature, 'product': product
                }
                for feature_id, feature, urgency, customer, product, mrr in top_mrr
            ]
        }
    except Exception as e:
        logger.error(f"Error getting all dashboard metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard-metrics/summary")
async def get_dashboard_summary(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get summary metrics (top 4 cards) - OPTIMIZED with SQL aggregations"""
    try:
        from sqlalchemy import func, case

        # OPTIMIZED: Count features using SQL instead of fetching all
        total_requests = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id
        ).scalar()

        # OPTIMIZED: Sum MRR using SQL aggregation instead of Python loop
        total_mrr_impact = db.query(
            func.coalesce(func.sum(WorkspaceDataPoint.numeric_value), 0)
        ).filter(
            WorkspaceDataPoint.workspace_id == workspace_id,
            WorkspaceDataPoint.data_point_category == 'business_metrics',
            WorkspaceDataPoint.data_point_key == 'mrr'
        ).scalar() or 0

        # OPTIMIZED: Count urgent items using SQL
        urgent_items = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id,
            func.lower(Feature.urgency).in_(['urgent', 'high'])
        ).scalar()

        # OPTIMIZED: Count deal blockers using SQL
        deal_blockers = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id,
            (Feature.status == 'deal_lost') | (func.lower(Feature.urgency) == 'impending_churn')
        ).scalar()

        return {
            'total_requests': total_requests,
            'total_mrr_impact': float(total_mrr_impact),
            'deal_blockers': deal_blockers,
            'urgent_items': urgent_items
        }
    except Exception as e:
        logger.error(f"Error getting dashboard summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard-metrics/by-urgency")
async def get_dashboard_by_urgency(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get metrics grouped by urgency - OPTIMIZED with SQL aggregations"""
    try:
        from sqlalchemy import func, case

        # OPTIMIZED: Use SQL to count features by urgency and sum MRR in one query
        urgency_counts = db.query(
            func.lower(Feature.urgency).label('urgency'),
            func.count(Feature.id).label('count')
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(func.lower(Feature.urgency)).all()

        # Get MRR sum per feature, then group by urgency
        mrr_by_feature = db.query(
            Feature.id.label('feature_id'),
            Feature.urgency,
            func.coalesce(func.sum(WorkspaceDataPoint.numeric_value), 0).label('mrr')
        ).outerjoin(
            WorkspaceDataPoint,
            (WorkspaceDataPoint.feature_id == Feature.id) &
            (WorkspaceDataPoint.data_point_category == 'business_metrics') &
            (WorkspaceDataPoint.data_point_key == 'mrr')
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(Feature.id, Feature.urgency).subquery()

        mrr_by_urgency = db.query(
            func.lower(mrr_by_feature.c.urgency).label('urgency'),
            func.sum(mrr_by_feature.c.mrr).label('total_mrr')
        ).group_by(func.lower(mrr_by_feature.c.urgency)).all()

        # Map database values to display labels
        urgency_mapping = {
            'high': 'urgent',
            'medium': 'important',
            'low': 'nice_to_have',
            'impending_churn': 'impending_churn',
            None: 'nice_to_have'
        }

        # Initialize result
        by_urgency = {
            'urgent': {'count': 0, 'mrr': 0},
            'important': {'count': 0, 'mrr': 0},
            'nice_to_have': {'count': 0, 'mrr': 0},
            'impending_churn': {'count': 0, 'mrr': 0}
        }

        # Populate counts
        for urgency, count in urgency_counts:
            mapped_key = urgency_mapping.get(urgency, 'nice_to_have')
            by_urgency[mapped_key]['count'] += count

        # Populate MRR
        for urgency, mrr in mrr_by_urgency:
            mapped_key = urgency_mapping.get(urgency, 'nice_to_have')
            by_urgency[mapped_key]['mrr'] += float(mrr or 0)

        return by_urgency
    except Exception as e:
        logger.error(f"Error getting urgency metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard-metrics/by-product")
async def get_dashboard_by_product(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get metrics grouped by product - OPTIMIZED with SQL aggregations"""
    try:
        from sqlalchemy import func, case

        # OPTIMIZED: Group by product in SQL
        # Get feature count and MRR per product
        by_product_query = db.query(
            func.coalesce(WorkspaceDataPoint.text_value, 'Unknown').label('product'),
            func.count(func.distinct(Feature.id)).label('count'),
            func.coalesce(
                func.sum(
                    case(
                        (WorkspaceDataPoint.data_point_key == 'mrr', WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ).label('mrr')
        ).select_from(Feature).outerjoin(
            WorkspaceDataPoint,
            WorkspaceDataPoint.feature_id == Feature.id
        ).filter(
            Feature.workspace_id == workspace_id,
            (WorkspaceDataPoint.data_point_category == 'entities') &
            (WorkspaceDataPoint.data_point_key == 'product') |
            (WorkspaceDataPoint.id == None)  # Include features with no product
        ).group_by(WorkspaceDataPoint.text_value).order_by(
            func.count(func.distinct(Feature.id)).desc()
        ).limit(10).all()

        return [
            {
                'product': product,
                'count': count,
                'mrr': float(mrr or 0)
            }
            for product, count, mrr in by_product_query
        ]
    except Exception as e:
        logger.error(f"Error getting product metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard-metrics/top-categories")
async def get_dashboard_top_categories(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get top feature categories - OPTIMIZED with SQL aggregations"""
    try:
        from sqlalchemy import func, case

        # OPTIMIZED: Use SQL GROUP BY instead of Python aggregation
        top_categories_query = db.query(
            Theme.name.label('category'),
            func.count(Feature.id).label('count'),
            func.coalesce(
                func.sum(
                    case(
                        (WorkspaceDataPoint.data_point_key == 'mrr', WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ).label('mrr')
        ).select_from(Feature).join(
            Theme,
            Feature.theme_id == Theme.id
        ).outerjoin(
            WorkspaceDataPoint,
            (WorkspaceDataPoint.feature_id == Feature.id) &
            (WorkspaceDataPoint.data_point_category == 'business_metrics')
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(Theme.name).order_by(
            func.count(Feature.id).desc()
        ).limit(10).all()

        return [
            {
                'category': category,
                'count': count,
                'mrr': float(mrr or 0)
            }
            for category, count, mrr in top_categories_query
        ]
    except Exception as e:
        logger.error(f"Error getting category metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard-metrics/critical-attention")
async def get_dashboard_critical_attention(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get items requiring critical attention - OPTIMIZED with SQL"""
    try:
        from sqlalchemy import func, case

        # OPTIMIZED: Filter and aggregate in SQL, only fetch top 5
        critical_query = db.query(
            Feature.name.label('feature'),
            Feature.urgency,
            func.max(
                case(
                    ((WorkspaceDataPoint.data_point_category == 'entities') &
                     (WorkspaceDataPoint.data_point_key.in_(['company_name', 'customer_name'])),
                     WorkspaceDataPoint.text_value),
                    else_='Unknown'
                )
            ).label('customer'),
            func.max(
                case(
                    ((WorkspaceDataPoint.data_point_category == 'entities') &
                     (WorkspaceDataPoint.data_point_key == 'product'),
                     WorkspaceDataPoint.text_value),
                    else_='Unknown'
                )
            ).label('product'),
            func.coalesce(
                func.sum(
                    case(
                        ((WorkspaceDataPoint.data_point_category == 'business_metrics') &
                         (WorkspaceDataPoint.data_point_key == 'mrr'),
                         WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ).label('mrr')
        ).select_from(Feature).outerjoin(
            WorkspaceDataPoint,
            WorkspaceDataPoint.feature_id == Feature.id
        ).filter(
            Feature.workspace_id == workspace_id,
            func.lower(Feature.urgency).in_(['urgent', 'high'])
        ).group_by(Feature.id, Feature.name, Feature.urgency).having(
            func.coalesce(
                func.sum(
                    case(
                        ((WorkspaceDataPoint.data_point_category == 'business_metrics') &
                         (WorkspaceDataPoint.data_point_key == 'mrr'),
                         WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ) > 0
        ).order_by(func.sum(WorkspaceDataPoint.numeric_value).desc()).limit(5).all()

        return [
            {
                'urgency': 'URGENT' if urgency.lower() in ['urgent', 'high'] else 'IMPORTANT',
                'customer': customer,
                'mrr': float(mrr or 0),
                'feature': feature,
                'product': product
            }
            for feature, urgency, customer, product, mrr in critical_query
        ]
    except Exception as e:
        logger.error(f"Error getting critical attention: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard-metrics/top-mrr")
async def get_dashboard_top_mrr(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get top 10 requests by MRR impact - OPTIMIZED with SQL"""
    try:
        from sqlalchemy import func, case

        # OPTIMIZED: Aggregate in SQL and only fetch top 10
        top_mrr_query = db.query(
            Feature.id.label('feature_id'),
            Feature.name.label('feature'),
            Feature.urgency,
            func.max(
                case(
                    ((WorkspaceDataPoint.data_point_category == 'entities') &
                     (WorkspaceDataPoint.data_point_key.in_(['company_name', 'customer_name'])),
                     WorkspaceDataPoint.text_value),
                    else_='Unknown'
                )
            ).label('customer'),
            func.max(
                case(
                    ((WorkspaceDataPoint.data_point_category == 'entities') &
                     (WorkspaceDataPoint.data_point_key == 'product'),
                     WorkspaceDataPoint.text_value),
                    else_='Unknown'
                )
            ).label('product'),
            func.coalesce(
                func.sum(
                    case(
                        ((WorkspaceDataPoint.data_point_category == 'business_metrics') &
                         (WorkspaceDataPoint.data_point_key == 'mrr'),
                         WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ).label('mrr')
        ).select_from(Feature).outerjoin(
            WorkspaceDataPoint,
            WorkspaceDataPoint.feature_id == Feature.id
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(Feature.id, Feature.name, Feature.urgency).order_by(
            func.coalesce(
                func.sum(
                    case(
                        ((WorkspaceDataPoint.data_point_category == 'business_metrics') &
                         (WorkspaceDataPoint.data_point_key == 'mrr'),
                         WorkspaceDataPoint.numeric_value),
                        else_=0
                    )
                ),
                0
            ).desc()
        ).limit(10).all()

        return [
            {
                'feature_id': str(feature_id),
                'customer': customer,
                'mrr': float(mrr or 0),
                'urgency': urgency,
                'feature': feature,
                'product': product
            }
            for feature_id, feature, urgency, customer, product, mrr in top_mrr_query
        ]
    except Exception as e:
        logger.error(f"Error getting top MRR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/executive-insights")
async def get_executive_insights(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get executive insights dashboard data - OPTIMIZED with SQL aggregations

    Returns all metrics needed for the Executive Insights page in a single response:
    - Summary metrics (counts, totals)
    - Features by status
    - Features by urgency
    - Top themes by feature count
    - Top 10 features by mentions
    - Recent activity (this week vs last week)
    """
    try:
        from sqlalchemy import func, case
        from datetime import datetime, timedelta

        # 1. Summary metrics - all in SQL
        total_features = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id
        ).scalar() or 0

        total_themes = db.query(func.count(Theme.id)).filter(
            Theme.workspace_id == workspace_id
        ).scalar() or 0

        total_mentions = db.query(func.coalesce(func.sum(Feature.mention_count), 0)).filter(
            Feature.workspace_id == workspace_id
        ).scalar() or 0

        # 2. Features by status - aggregated in SQL
        features_by_status = db.query(
            Feature.status,
            func.count(Feature.id).label('count')
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(Feature.status).all()

        status_counts = {
            'new': 0,
            'in_progress': 0,
            'completed': 0,
            'on_hold': 0
        }
        for status, count in features_by_status:
            if status in status_counts:
                status_counts[status] = count

        # 3. Features by urgency - aggregated in SQL
        features_by_urgency = db.query(
            Feature.urgency,
            func.count(Feature.id).label('count')
        ).filter(
            Feature.workspace_id == workspace_id
        ).group_by(Feature.urgency).all()

        urgency_counts = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0
        }
        for urgency, count in features_by_urgency:
            if urgency in urgency_counts:
                urgency_counts[urgency] = count

        # 4. Top themes - aggregated in SQL with subquery for accurate feature count
        top_themes = db.query(
            Theme.id,
            Theme.name,
            func.count(Feature.id).label('feature_count')
        ).outerjoin(
            Feature, Feature.theme_id == Theme.id
        ).filter(
            Theme.workspace_id == workspace_id
        ).group_by(
            Theme.id, Theme.name
        ).order_by(
            func.count(Feature.id).desc()
        ).limit(5).all()

        # 5. Top 10 features by mentions - with theme info
        top_features = db.query(
            Feature.id,
            Feature.name,
            Feature.description,
            Feature.urgency,
            Feature.status,
            Feature.mention_count,
            Feature.theme_id,
            Feature.first_mentioned,
            Feature.last_mentioned,
            Feature.created_at,
            Feature.updated_at,
            Theme.id.label('theme_id_obj'),
            Theme.name.label('theme_name'),
            Theme.description.label('theme_description')
        ).outerjoin(
            Theme, Feature.theme_id == Theme.id
        ).filter(
            Feature.workspace_id == workspace_id
        ).order_by(
            Feature.mention_count.desc()
        ).limit(10).all()

        # 6. Recent activity - this week vs last week
        now = datetime.utcnow()
        one_week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        features_this_week = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id,
            Feature.created_at >= one_week_ago
        ).scalar() or 0

        features_last_week = db.query(func.count(Feature.id)).filter(
            Feature.workspace_id == workspace_id,
            Feature.created_at >= two_weeks_ago,
            Feature.created_at < one_week_ago
        ).scalar() or 0

        # Format response
        return {
            'metrics': {
                'total_features': total_features,
                'total_themes': total_themes,
                'total_mentions': total_mentions,
                'features_by_status': status_counts,
                'features_by_urgency': urgency_counts,
                'top_themes': [
                    {'name': name, 'feature_count': count}
                    for _, name, count in top_themes
                ],
                'recent_activity': {
                    'features_this_week': features_this_week,
                    'features_last_week': features_last_week
                }
            },
            'top_features': [
                {
                    'id': str(feature.id),
                    'name': feature.name,
                    'description': feature.description,
                    'urgency': feature.urgency,
                    'status': feature.status,
                    'mention_count': feature.mention_count,
                    'theme_id': str(feature.theme_id) if feature.theme_id else None,
                    'theme': {
                        'id': str(feature.theme_id_obj),
                        'name': feature.theme_name,
                        'description': feature.theme_description
                    } if feature.theme_id_obj else None,
                    'first_mentioned': feature.first_mentioned.isoformat() if feature.first_mentioned else None,
                    'last_mentioned': feature.last_mentioned.isoformat() if feature.last_mentioned else None,
                    'created_at': feature.created_at.isoformat(),
                    'updated_at': feature.updated_at.isoformat() if feature.updated_at else None
                }
                for feature in top_features
            ]
        }

    except Exception as e:
        logger.error(f"Error getting executive insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))
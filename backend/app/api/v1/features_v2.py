"""
Features API v2 - Using new schema with CustomerAsk, Theme, SubTheme
Replaces old features.py which used deprecated Feature model
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.customer_ask import CustomerAsk
from app.models.sub_theme import SubTheme
from app.models.theme import Theme
from app.models.message import Message
from app.models.customer import Customer

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================
# Pydantic Models for Request/Response
# ============================================

class ThemeCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    parent_theme_id: Optional[str] = None  # For backward compatibility (ignored in new schema)


class ThemeUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_theme_id: Optional[str] = None  # For backward compatibility (ignored in new schema)


class ThemeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    feature_count: int
    mention_count: int = 0
    parent_theme_id: Optional[str] = None  # Always None in new schema (no nested themes)
    sub_theme_count: int = 0
    level: int = 0  # Always 0 in new schema (no hierarchy within themes)
    slack_integration_id: Optional[str] = None
    slack_channel_id: Optional[str] = None
    slack_channel_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================
# Theme Endpoints
# ============================================

@router.get("/themes", response_model=List[ThemeResponse])
async def get_themes(
    workspace_id: str,
    include_sub_themes: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all themes for a workspace with customer ask counts
    """
    try:
        # Get all themes for the workspace
        themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).order_by(Theme.sort_order.asc()).all()

        if not themes:
            return []

        # Batch query for customer ask counts (through sub_themes)
        # Count customer asks per theme
        feature_counts_query = db.query(
            SubTheme.theme_id,
            func.count(CustomerAsk.id).label('count')
        ).outerjoin(
            CustomerAsk, CustomerAsk.sub_theme_id == SubTheme.id
        ).filter(
            SubTheme.theme_id.in_([t.id for t in themes])
        ).group_by(SubTheme.theme_id).all()

        feature_counts = {str(theme_id): count for theme_id, count in feature_counts_query}

        # Batch query for mention counts
        mention_counts_query = db.query(
            SubTheme.theme_id,
            func.coalesce(func.sum(CustomerAsk.mention_count), 0).label('total_mentions')
        ).outerjoin(
            CustomerAsk, CustomerAsk.sub_theme_id == SubTheme.id
        ).filter(
            SubTheme.theme_id.in_([t.id for t in themes])
        ).group_by(SubTheme.theme_id).all()

        mention_counts = {str(theme_id): int(total_mentions or 0) for theme_id, total_mentions in mention_counts_query}

        # Batch query for sub-theme counts
        sub_theme_counts_query = db.query(
            SubTheme.theme_id,
            func.count(SubTheme.id).label('count')
        ).filter(
            SubTheme.theme_id.in_([t.id for t in themes])
        ).group_by(SubTheme.theme_id).all()

        sub_theme_counts = {str(theme_id): count for theme_id, count in sub_theme_counts_query}

        # Convert to response format
        theme_responses = []
        for theme in themes:
            theme_id_str = str(theme.id)
            feature_count = feature_counts.get(theme_id_str, 0)
            mention_count = mention_counts.get(theme_id_str, 0)
            sub_theme_count = sub_theme_counts.get(theme_id_str, 0)

            theme_responses.append(ThemeResponse(
                id=theme_id_str,
                name=theme.name,
                description=theme.description,
                feature_count=feature_count,
                mention_count=mention_count,
                parent_theme_id=None,  # No nested themes in new schema
                sub_theme_count=sub_theme_count,
                level=0,  # All themes are root level in new schema
                slack_integration_id=str(theme.slack_integration_id) if theme.slack_integration_id else None,
                slack_channel_id=theme.slack_channel_id,
                slack_channel_name=theme.slack_channel_name
            ))

        return theme_responses

    except Exception as e:
        logger.error(f"Error getting themes: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get themes: {str(e)}"
        )


@router.post("/themes", response_model=ThemeResponse)
async def create_theme(
    request: ThemeCreateRequest,
    workspace_id: str,
    current_user: User = Depends(get_current_user),
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

        # Get max sort_order for this workspace
        max_sort = db.query(func.max(Theme.sort_order)).filter(
            Theme.workspace_id == workspace_id
        ).scalar() or 0

        # Create new theme
        new_theme = Theme(
            name=request.name,
            description=request.description,
            workspace_id=workspace_id,
            sort_order=max_sort + 1
        )

        db.add(new_theme)
        db.commit()
        db.refresh(new_theme)

        return ThemeResponse(
            id=str(new_theme.id),
            name=new_theme.name,
            description=new_theme.description,
            feature_count=0,
            mention_count=0,
            parent_theme_id=None,
            sub_theme_count=0,
            level=0,
            slack_integration_id=str(new_theme.slack_integration_id) if new_theme.slack_integration_id else None,
            slack_channel_id=new_theme.slack_channel_id,
            slack_channel_name=new_theme.slack_channel_name
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating theme: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create theme: {str(e)}"
        )


@router.put("/themes/{theme_id}", response_model=ThemeResponse)
async def update_theme(
    theme_id: str,
    request: ThemeUpdateRequest,
    workspace_id: str,
    current_user: User = Depends(get_current_user),
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

        # Update fields if provided
        if request.name is not None:
            # Check for duplicate name
            existing = db.query(Theme).filter(
                Theme.workspace_id == workspace_id,
                Theme.name == request.name,
                Theme.id != theme_id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Theme '{request.name}' already exists"
                )
            theme.name = request.name

        if request.description is not None:
            theme.description = request.description

        db.commit()
        db.refresh(theme)

        # Get counts for response
        feature_count = db.query(func.count(CustomerAsk.id)).join(
            SubTheme, CustomerAsk.sub_theme_id == SubTheme.id
        ).filter(SubTheme.theme_id == theme.id).scalar() or 0

        mention_count = db.query(func.coalesce(func.sum(CustomerAsk.mention_count), 0)).join(
            SubTheme, CustomerAsk.sub_theme_id == SubTheme.id
        ).filter(SubTheme.theme_id == theme.id).scalar() or 0

        sub_theme_count = db.query(func.count(SubTheme.id)).filter(
            SubTheme.theme_id == theme.id
        ).scalar() or 0

        return ThemeResponse(
            id=str(theme.id),
            name=theme.name,
            description=theme.description,
            feature_count=feature_count,
            mention_count=int(mention_count),
            parent_theme_id=None,
            sub_theme_count=sub_theme_count,
            level=0,
            slack_integration_id=str(theme.slack_integration_id) if theme.slack_integration_id else None,
            slack_channel_id=theme.slack_channel_id,
            slack_channel_name=theme.slack_channel_name
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating theme: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update theme: {str(e)}"
        )


@router.delete("/themes/{theme_id}")
async def delete_theme(
    theme_id: str,
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a theme and all its sub-themes and customer asks
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

        # Delete the theme (cascade will handle sub_themes and customer_asks)
        db.delete(theme)
        db.commit()

        return {"message": "Theme deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting theme: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete theme: {str(e)}"
        )


# ============================================
# Executive Insights Endpoint
# ============================================

@router.get("/executive-insights")
async def get_executive_insights(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get executive insights dashboard data - using new schema with CustomerAsk

    Returns all metrics needed for the Executive Insights page in a single response:
    - Summary metrics (counts, totals)
    - Customer asks by status
    - Customer asks by urgency
    - Top themes by customer ask count
    - Top 10 customer asks by mentions
    - Recent activity (this week vs last week)
    - Customer industry breakdown
    - Customer health metrics
    """
    try:
        # 1. Summary metrics - all in SQL
        total_features = db.query(func.count(CustomerAsk.id)).filter(
            CustomerAsk.workspace_id == workspace_id
        ).scalar() or 0

        total_themes = db.query(func.count(Theme.id)).filter(
            Theme.workspace_id == workspace_id
        ).scalar() or 0

        total_mentions = db.query(func.coalesce(func.sum(CustomerAsk.mention_count), 0)).filter(
            CustomerAsk.workspace_id == workspace_id
        ).scalar() or 0

        # 2. Customer asks by status - aggregated in SQL
        asks_by_status = db.query(
            CustomerAsk.status,
            func.count(CustomerAsk.id).label('count')
        ).filter(
            CustomerAsk.workspace_id == workspace_id
        ).group_by(CustomerAsk.status).all()

        status_counts = {
            'new': 0,
            'in_progress': 0,
            'completed': 0,
            'on_hold': 0
        }

        # Normalize status values to match expected keys
        status_mapping = {
            'new': 'new',
            'under-review': 'in_progress',
            'under_review': 'in_progress',
            'in_progress': 'in_progress',
            'in-progress': 'in_progress',
            'planned': 'in_progress',
            'completed': 'completed',
            'shipped': 'completed',
            'on_hold': 'on_hold',
            'on-hold': 'on_hold',
            'on hold': 'on_hold',
        }

        for status, count in asks_by_status:
            if status:
                # Normalize status (lowercase and handle variations)
                normalized_status = status_mapping.get(status.lower(), 'new')
                if normalized_status in status_counts:
                    status_counts[normalized_status] += count
                else:
                    # If status doesn't match, default to 'new'
                    status_counts['new'] += count

        # 3. Customer asks by urgency - aggregated in SQL
        asks_by_urgency = db.query(
            CustomerAsk.urgency,
            func.count(CustomerAsk.id).label('count')
        ).filter(
            CustomerAsk.workspace_id == workspace_id
        ).group_by(CustomerAsk.urgency).all()

        urgency_counts = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0
        }
        for urgency, count in asks_by_urgency:
            if urgency in urgency_counts:
                urgency_counts[urgency] = count

        # 4. Top themes - aggregated in SQL
        # Count customer asks per theme (through sub_themes)
        top_themes = db.query(
            Theme.id,
            Theme.name,
            func.count(CustomerAsk.id).label('feature_count')
        ).outerjoin(
            SubTheme, SubTheme.theme_id == Theme.id
        ).outerjoin(
            CustomerAsk, CustomerAsk.sub_theme_id == SubTheme.id
        ).filter(
            Theme.workspace_id == workspace_id
        ).group_by(
            Theme.id, Theme.name
        ).order_by(
            func.count(CustomerAsk.id).desc()
        ).limit(5).all()

        # 5. Top 10 customer asks by mentions - with theme info
        top_features_query = db.query(
            CustomerAsk.id,
            CustomerAsk.name,
            CustomerAsk.description,
            CustomerAsk.urgency,
            CustomerAsk.status,
            CustomerAsk.mention_count,
            CustomerAsk.sub_theme_id,
            CustomerAsk.first_mentioned_at,
            CustomerAsk.last_mentioned_at,
            CustomerAsk.created_at,
            CustomerAsk.updated_at,
            SubTheme.theme_id,
            Theme.id.label('theme_id_obj'),
            Theme.name.label('theme_name'),
            Theme.description.label('theme_description')
        ).join(
            SubTheme, CustomerAsk.sub_theme_id == SubTheme.id
        ).join(
            Theme, SubTheme.theme_id == Theme.id
        ).filter(
            CustomerAsk.workspace_id == workspace_id
        ).order_by(
            CustomerAsk.mention_count.desc()
        ).limit(10).all()

        # 6. Recent activity - this week vs last week
        now = datetime.now(dt_timezone.utc)
        one_week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        features_this_week = db.query(func.count(CustomerAsk.id)).filter(
            CustomerAsk.workspace_id == workspace_id,
            CustomerAsk.created_at >= one_week_ago
        ).scalar() or 0

        features_last_week = db.query(func.count(CustomerAsk.id)).filter(
            CustomerAsk.workspace_id == workspace_id,
            CustomerAsk.created_at >= two_weeks_ago,
            CustomerAsk.created_at < one_week_ago
        ).scalar() or 0

        # 7. Customers by industry - aggregated in SQL (top 10)
        customers_by_industry = db.query(
            Customer.industry,
            func.count(Customer.id).label('count')
        ).filter(
            Customer.workspace_id == workspace_id,
            Customer.is_active == True
        ).group_by(Customer.industry).order_by(
            func.count(Customer.id).desc()
        ).limit(10).all()

        # Format industry data
        industry_data = [
            {
                'industry': industry if industry else 'Unknown',
                'count': count
            }
            for industry, count in customers_by_industry
        ]

        # 8. Calls/Messages per day for the last 90 days - aggregated in SQL
        ninety_days_ago = now - timedelta(days=90)

        calls_per_day = db.query(
            func.date(Message.sent_at).label('date'),
            func.count(Message.id).label('count')
        ).filter(
            Message.workspace_id == workspace_id,
            Message.sent_at >= ninety_days_ago
        ).group_by(
            func.date(Message.sent_at)
        ).order_by(
            func.date(Message.sent_at)
        ).all()

        # Format calls per day data
        calls_per_day_data = [
            {
                'date': date.isoformat() if date else None,
                'count': count
            }
            for date, count in calls_per_day
        ]

        # 9. Top 10 Most Engaged Customers - by message count
        top_engaged_customers = db.query(
            Customer.id,
            Customer.name,
            Customer.industry,
            func.count(Message.id).label('message_count')
        ).join(
            Message, Customer.id == Message.customer_id
        ).filter(
            Customer.workspace_id == workspace_id,
            Customer.is_active == True
        ).group_by(
            Customer.id, Customer.name, Customer.industry
        ).order_by(
            func.count(Message.id).desc()
        ).limit(10).all()

        # Format top engaged customers
        top_engaged_data = [
            {
                'customer_id': str(customer_id),
                'name': name,
                'industry': industry if industry else 'Unknown',
                'message_count': message_count
            }
            for customer_id, name, industry, message_count in top_engaged_customers
        ]

        # 10. Customer Health Score - categorize by last activity
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago_health = now - timedelta(days=30)

        # Get all customers with their last message date
        customer_health = db.query(
            Customer.id,
            Customer.name,
            Customer.industry,
            func.max(Message.sent_at).label('last_activity'),
            func.count(Message.id).label('message_count')
        ).outerjoin(
            Message, Customer.id == Message.customer_id
        ).filter(
            Customer.workspace_id == workspace_id,
            Customer.is_active == True
        ).group_by(
            Customer.id, Customer.name, Customer.industry
        ).all()

        # Categorize customers by health
        healthy_count = 0  # Active in last 7 days
        at_risk_count = 0  # Active 7-30 days ago
        dormant_count = 0  # No activity in 30+ days or never active

        customer_health_details = []

        for customer_id, name, industry, last_activity, message_count in customer_health:
            if last_activity is None:
                health_status = 'dormant'
                dormant_count += 1
            elif last_activity >= seven_days_ago:
                health_status = 'healthy'
                healthy_count += 1
            elif last_activity >= thirty_days_ago_health:
                health_status = 'at_risk'
                at_risk_count += 1
            else:
                health_status = 'dormant'
                dormant_count += 1

            customer_health_details.append({
                'customer_id': str(customer_id),
                'name': name,
                'industry': industry if industry else 'Unknown',
                'last_activity': last_activity.isoformat() if last_activity else None,
                'message_count': message_count,
                'health_status': health_status
            })

        # Sort by health status priority (healthy first, then at_risk, then dormant)
        # and within each category by message count descending
        status_priority = {'healthy': 0, 'at_risk': 1, 'dormant': 2}
        customer_health_details.sort(
            key=lambda x: (status_priority[x['health_status']], -x['message_count'])
        )

        customer_health_summary = {
            'healthy': healthy_count,
            'at_risk': at_risk_count,
            'dormant': dormant_count
        }

        # Format response - keep 'features' naming for frontend compatibility
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
                },
                'customers_by_industry': industry_data,
                'calls_per_day': calls_per_day_data,
                'top_engaged_customers': top_engaged_data,
                'customer_health_summary': customer_health_summary
            },
            'customer_health_details': customer_health_details[:20],  # Top 20 for detailed view
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
                    'first_mentioned': feature.first_mentioned_at.isoformat() if feature.first_mentioned_at else None,
                    'last_mentioned': feature.last_mentioned_at.isoformat() if feature.last_mentioned_at else None,
                    'created_at': feature.created_at.isoformat() if feature.created_at else None,
                    'updated_at': feature.updated_at.isoformat() if feature.updated_at else None
                }
                for feature in top_features_query
            ]
        }

    except Exception as e:
        logger.error(f"Error getting executive insights: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

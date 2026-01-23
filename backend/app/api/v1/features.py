"""
Features API - Stub version

NOTE: This module is currently a stub as part of the database schema redesign.
The Feature model has been replaced by CustomerAsk, and WorkspaceDataPoint has been removed.
Full implementation will be added after schema migration is complete.
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/themes")
async def get_themes():
    """Get themes - stub endpoint"""
    logger.info("Features API stub: get_themes called")
    return []


@router.get("/features")
async def get_features():
    """Get features - stub endpoint"""
    logger.info("Features API stub: get_features called")
    return []


@router.get("/dashboard-metrics/all")
async def get_all_dashboard_metrics():
    """Get dashboard metrics - stub endpoint"""
    logger.info("Features API stub: get_all_dashboard_metrics called")
    return {
        'summary': {
            'total_requests': 0,
            'total_mrr_impact': 0,
            'deal_blockers': 0,
            'urgent_items': 0
        },
        'by_urgency': {},
        'by_product': [],
        'top_categories': [],
        'critical_attention': [],
        'top_mrr': []
    }


@router.get("/executive-insights")
async def get_executive_insights():
    """Get executive insights - stub endpoint"""
    logger.info("Features API stub: get_executive_insights called")
    return {
        'metrics': {
            'total_features': 0,
            'total_themes': 0,
            'total_mentions': 0,
            'features_by_status': {},
            'features_by_urgency': {},
            'top_themes': [],
            'recent_activity': {
                'features_this_week': 0,
                'features_last_week': 0
            }
        },
        'top_features': []
    }

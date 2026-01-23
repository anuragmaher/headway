"""
Theme-specific Slack notification service

NOTE: This service is currently disabled as part of the schema redesign.
Theme-specific Slack notifications will be re-implemented in a future update
using the new WorkspaceConnector model.
"""

import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from uuid import UUID

logger = logging.getLogger(__name__)


class ThemeSlackNotificationService:
    """Service for sending theme-specific Slack notifications (currently disabled)"""

    @staticmethod
    async def send_feature_created_notification(
        db: Session,
        theme_id: UUID,
        feature_name: str,
        feature_description: str,
        confidence: float,
        urgency: str,
        source: str,
        source_id: str,
        sentiment: Optional[dict] = None,
        key_topics: Optional[list] = None,
        quote: Optional[str] = None,
        customer_name: Optional[str] = None,
        pain_points: Optional[list] = None
    ) -> bool:
        """
        Send Slack notification to theme's connected channel when a new feature is created.

        Currently disabled - theme-specific Slack channels were removed in schema redesign.
        """
        logger.debug("Theme Slack notifications disabled - skipping feature created notification")
        return False

    @staticmethod
    async def send_feature_matched_notification(
        db: Session,
        theme_id: UUID,
        new_feature_title: str,
        existing_feature_name: str,
        existing_mention_count: int,
        confidence: float,
        source: str,
        source_id: str,
        sentiment: Optional[dict] = None,
        key_topics: Optional[list] = None,
        quote: Optional[str] = None,
        customer_name: Optional[str] = None,
        urgency: Optional[str] = None
    ) -> bool:
        """
        Send Slack notification to theme's connected channel when a feature is matched.

        Currently disabled - theme-specific Slack channels were removed in schema redesign.
        """
        logger.debug("Theme Slack notifications disabled - skipping feature matched notification")
        return False


# Global service instance
theme_slack_notification_service = ThemeSlackNotificationService()

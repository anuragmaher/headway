"""
Theme-specific Slack notification service

This service sends Slack notifications to theme-specific channels when features
are created or updated. Each theme can be connected to a specific Slack channel.
"""

import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from uuid import UUID

from app.services.slack_service import slack_service
from app.models.theme import Theme
from app.models.integration import Integration

logger = logging.getLogger(__name__)


class ThemeSlackNotificationService:
    """Service for sending theme-specific Slack notifications"""

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
        Send Slack notification to theme's connected channel when a new feature is created

        Args:
            db: Database session
            theme_id: Theme ID that the feature belongs to
            feature_name: Name of the created feature
            feature_description: Description of the feature
            confidence: Theme validation confidence score
            urgency: Feature urgency level
            source: Source system (e.g., 'gong', 'fathom', 'slack', 'gmail')
            source_id: ID of the source transcript/call/message
            sentiment: Optional sentiment dict with 'overall', 'score', 'reasoning'
            key_topics: Optional list of key topics mentioned
            quote: Optional direct quote from the transcript
            customer_name: Optional customer name
            pain_points: Optional list of pain points

        Returns:
            True if notification was sent successfully, False otherwise
        """
        try:
            # Get theme with Slack integration
            theme = db.query(Theme).filter(Theme.id == theme_id).first()
            if not theme:
                logger.warning(f"Theme {theme_id} not found")
                return False

            # Check if theme has Slack channel connected
            if not theme.slack_integration_id:
                logger.debug(f"Theme {theme.name} (ID: {theme_id}) does not have slack_integration_id")
                return False
                
            if not theme.slack_channel_id:
                logger.debug(f"Theme {theme.name} (ID: {theme_id}) does not have slack_channel_id")
                return False
                
            logger.info(f"Attempting to send Slack notification for theme {theme.name} (ID: {theme_id}) to channel {theme.slack_channel_id}")

            # Get Slack integration
            integration = db.query(Integration).filter(
                Integration.id == theme.slack_integration_id,
                Integration.is_active == True
            ).first()

            if not integration:
                logger.warning(f"Slack integration {theme.slack_integration_id} not found")
                return False
                
            if not integration.access_token:
                logger.warning(f"Slack integration {theme.slack_integration_id} has no access token")
                return False
                
            if not integration.is_active:
                logger.warning(f"Slack integration {theme.slack_integration_id} is not active")
                return False

            # Build notification blocks
            blocks = ThemeSlackNotificationService._build_feature_created_blocks(
                feature_name=feature_name,
                feature_description=feature_description,
                theme_name=theme.name,
                confidence=confidence,
                urgency=urgency,
                source=source,
                source_id=source_id,
                sentiment=sentiment,
                key_topics=key_topics,
                quote=quote,
                customer_name=customer_name,
                pain_points=pain_points
            )

            # Send message to theme's Slack channel
            response = await slack_service.post_message(
                token=integration.access_token,
                channel_id=theme.slack_channel_id,
                text=f"New feature: {feature_name}",
                blocks=blocks
            )

            if response.get("ok"):
                logger.info(f"✅ Slack notification sent to {theme.slack_channel_name} for feature: {feature_name}")
                return True
            else:
                error_msg = response.get('error', 'Unknown error')
                logger.warning(f"Failed to send Slack notification: {error_msg}")
                logger.warning(f"Full response: {response}")
                return False

        except Exception as e:
            logger.error(f"Error sending theme Slack notification: {e}", exc_info=True)
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
        Send Slack notification to theme's connected channel when a feature is matched

        Args:
            db: Database session
            theme_id: Theme ID that the feature belongs to
            new_feature_title: Title of the matched feature request
            existing_feature_name: Name of the existing feature
            existing_mention_count: Updated mention count
            confidence: Matching confidence score
            source: Source system (e.g., 'gong', 'fathom', 'slack', 'gmail')
            source_id: ID of the source transcript/call/message
            sentiment: Optional sentiment dict
            key_topics: Optional list of key topics
            quote: Optional direct quote
            customer_name: Optional customer name
            urgency: Optional urgency level

        Returns:
            True if notification was sent successfully, False otherwise
        """
        try:
            # Get theme with Slack integration
            theme = db.query(Theme).filter(Theme.id == theme_id).first()
            if not theme:
                logger.warning(f"Theme {theme_id} not found")
                return False

            # Check if theme has Slack channel connected
            if not theme.slack_integration_id:
                logger.debug(f"Theme {theme.name} (ID: {theme_id}) does not have slack_integration_id")
                return False
                
            if not theme.slack_channel_id:
                logger.debug(f"Theme {theme.name} (ID: {theme_id}) does not have slack_channel_id")
                return False
                
            logger.info(f"Attempting to send Slack notification for theme {theme.name} (ID: {theme_id}) to channel {theme.slack_channel_id}")

            # Get Slack integration
            integration = db.query(Integration).filter(
                Integration.id == theme.slack_integration_id,
                Integration.is_active == True
            ).first()

            if not integration:
                logger.warning(f"Slack integration {theme.slack_integration_id} not found")
                return False
                
            if not integration.access_token:
                logger.warning(f"Slack integration {theme.slack_integration_id} has no access token")
                return False
                
            if not integration.is_active:
                logger.warning(f"Slack integration {theme.slack_integration_id} is not active")
                return False

            # Build notification blocks
            blocks = ThemeSlackNotificationService._build_feature_matched_blocks(
                new_feature_title=new_feature_title,
                existing_feature_name=existing_feature_name,
                existing_mention_count=existing_mention_count,
                confidence=confidence,
                source=source,
                source_id=source_id,
                sentiment=sentiment,
                key_topics=key_topics,
                quote=quote,
                customer_name=customer_name,
                urgency=urgency
            )

            # Send message to theme's Slack channel
            response = await slack_service.post_message(
                token=integration.access_token,
                channel_id=theme.slack_channel_id,
                text=f"Feature mention added: {existing_feature_name}",
                blocks=blocks
            )

            if response.get("ok"):
                logger.info(f"✅ Slack notification sent to {theme.slack_channel_name} for matched feature: {existing_feature_name}")
                return True
            else:
                error_msg = response.get('error', 'Unknown error')
                logger.warning(f"Failed to send Slack notification: {error_msg}")
                logger.warning(f"Full response: {response}")
                return False

        except Exception as e:
            logger.error(f"Error sending theme Slack notification: {e}", exc_info=True)
            return False

    @staticmethod
    def _build_feature_created_blocks(
        feature_name: str,
        feature_description: str,
        theme_name: str,
        confidence: float,
        urgency: str,
        source: str,
        source_id: str,
        sentiment: Optional[dict] = None,
        key_topics: Optional[list] = None,
        quote: Optional[str] = None,
        customer_name: Optional[str] = None,
        pain_points: Optional[list] = None
    ) -> List[Dict[str, Any]]:
        """Build Slack Block Kit blocks for feature created notification"""
        color = ThemeSlackNotificationService._get_confidence_color(confidence)
        confidence_emoji = ThemeSlackNotificationService._get_confidence_emoji(confidence)
        sentiment_emoji = ThemeSlackNotificationService._get_sentiment_emoji(sentiment) if sentiment else ""
        urgency_emoji = ThemeSlackNotificationService._get_urgency_emoji(urgency)

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "✨ New Feature Created",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Feature Name*\n{feature_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Theme*\n{theme_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Urgency*\n{urgency_emoji} {urgency.upper()}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Confidence*\n{confidence_emoji} {confidence:.0%}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Source*\n{source.upper()} ({source_id[-12:] if len(source_id) > 12 else source_id})"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Sentiment*\n{sentiment_emoji} {sentiment.get('overall', 'unknown').title() if sentiment else 'N/A'}"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Description*\n{feature_description}"
                }
            }
        ]

        # Add customer context if available
        if customer_name:
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"👤 From: {customer_name}"
                    }
                ]
            })

        # Add direct quote if available
        if quote:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"_📌 Direct Quote:_\n\"{quote}\""
                }
            })

        # Add key topics if available
        if key_topics and len(key_topics) > 0:
            topics_str = " • ".join(key_topics[:5])  # Limit to 5 topics
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"🏷️ Topics: {topics_str}"
                    }
                ]
            })

        # Add pain points if available
        if pain_points and len(pain_points) > 0:
            pain_points_text = "\n".join([f"• {pp}" for pp in pain_points[:3]])  # Limit to 3
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Pain Points Identified:*\n{pain_points_text}"
                }
            })

        blocks.append({"type": "divider"})

        return blocks

    @staticmethod
    def _build_feature_matched_blocks(
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
    ) -> List[Dict[str, Any]]:
        """Build Slack Block Kit blocks for feature matched notification"""
        confidence_emoji = ThemeSlackNotificationService._get_confidence_emoji(confidence)
        sentiment_emoji = ThemeSlackNotificationService._get_sentiment_emoji(sentiment) if sentiment else ""
        urgency_emoji = ThemeSlackNotificationService._get_urgency_emoji(urgency) if urgency else ""

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🔗 Feature Mention Added",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Matched Feature*\n{new_feature_title}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Linked To*\n{existing_feature_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Total Mentions*\n{existing_mention_count}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Match Confidence*\n{confidence_emoji} {confidence:.0%}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Source*\n{source.upper()} ({source_id[-12:] if len(source_id) > 12 else source_id})"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Sentiment*\n{sentiment_emoji} {sentiment.get('overall', 'unknown').title() if sentiment else 'N/A'}"
                    }
                ]
            }
        ]

        # Add urgency if available
        if urgency:
            blocks[1]["fields"].append({
                "type": "mrkdwn",
                "text": f"*Urgency*\n{urgency_emoji} {urgency.upper()}"
            })

        # Add customer context if available
        if customer_name:
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"👤 From: {customer_name}"
                    }
                ]
            })

        # Add quote if available
        if quote:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"_\"{quote}\"_"
                }
            })

        # Add key topics if available
        if key_topics and len(key_topics) > 0:
            topics_text = ", ".join([f"`{topic}`" for topic in key_topics[:5]])  # Limit to 5
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"🏷️ Topics: {topics_text}"
                    }
                ]
            })

        blocks.append({"type": "divider"})

        return blocks

    @staticmethod
    def _get_confidence_color(confidence: float) -> str:
        """Get Slack color code based on confidence level"""
        if confidence >= 0.85:
            return "#36a64f"  # Green
        elif confidence >= 0.70:
            return "#ff9900"  # Orange
        else:
            return "#ff0000"  # Red

    @staticmethod
    def _get_confidence_emoji(confidence: float) -> str:
        """Get emoji based on confidence level"""
        if confidence >= 0.85:
            return "🟢"
        elif confidence >= 0.70:
            return "🟡"
        else:
            return "🔴"

    @staticmethod
    def _get_sentiment_emoji(sentiment: Optional[dict]) -> str:
        """Get emoji based on sentiment"""
        if not sentiment:
            return ""

        overall = sentiment.get("overall", "").lower()
        if overall == "positive":
            return "😊"
        elif overall == "negative":
            return "😞"
        else:
            return "😐"

    @staticmethod
    def _get_urgency_emoji(urgency: str) -> str:
        """Get emoji based on urgency level"""
        if not urgency:
            return "📝"
            
        urgency_lower = urgency.lower()
        if urgency_lower == "critical":
            return "🚨"
        elif urgency_lower == "high":
            return "⚠️"
        elif urgency_lower == "medium":
            return "💡"
        else:
            return "📝"


# Global service instance
theme_slack_notification_service = ThemeSlackNotificationService()

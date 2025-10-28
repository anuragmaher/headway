"""
Slack notification service for feature extraction events
"""

import logging
import json
from typing import Optional
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)


class SlackNotificationService:
    """Service for sending Slack webhook notifications"""

    @staticmethod
    def send_feature_created_notification(
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
    ) -> bool:
        """
        Send Slack notification when a new feature is created

        Args:
            feature_name: Name of the created feature
            feature_description: Description of the feature
            theme_name: Theme the feature belongs to
            confidence: Theme validation confidence score
            urgency: Feature urgency level
            source: Source system (e.g., 'gong', 'fathom')
            source_id: ID of the source transcript/call
            sentiment: Optional sentiment dict with 'overall', 'score', 'reasoning'
            key_topics: Optional list of key topics mentioned
            quote: Optional direct quote from the transcript
            customer_name: Optional customer name
            pain_points: Optional list of pain points

        Returns:
            True if notification was sent successfully, False otherwise
        """
        if not settings.SLACK_WEBHOOK_URL:
            logger.debug("SLACK_WEBHOOK_URL not configured, skipping notification")
            return False

        try:
            color = SlackNotificationService._get_confidence_color(confidence)
            confidence_emoji = SlackNotificationService._get_confidence_emoji(confidence)
            sentiment_emoji = SlackNotificationService._get_sentiment_emoji(sentiment) if sentiment else ""
            urgency_emoji = SlackNotificationService._get_urgency_emoji(urgency)

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
                            "text": f"*Source*\n{source.upper()} ({source_id[-12:]})"
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

            # Add sentiment reasoning if available
            if sentiment and sentiment.get("reasoning"):
                blocks.append({
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": f"💬 Sentiment: {sentiment['reasoning']}"
                        }
                    ]
                })

            blocks.append({"type": "divider"})

            payload = {"blocks": blocks}

            response = requests.post(
                settings.SLACK_WEBHOOK_URL,
                json=payload,
                timeout=5
            )

            if response.status_code == 200:
                logger.info(f"✅ Slack notification sent for feature: {feature_name}")
                return True
            else:
                logger.warning(f"Failed to send Slack notification: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error sending Slack notification: {e}")
            return False

    @staticmethod
    def send_feature_matched_notification(
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
        Send Slack notification when a new feature is matched to an existing one

        Args:
            new_feature_title: Title of the matched feature request
            existing_feature_name: Name of the existing feature
            existing_mention_count: Updated mention count
            confidence: Matching confidence score
            source: Source system (e.g., 'gong', 'fathom')
            source_id: ID of the source transcript/call
            sentiment: Optional sentiment dict with 'overall', 'score', 'reasoning'
            key_topics: Optional list of key topics mentioned
            quote: Optional direct quote from the transcript
            customer_name: Optional customer name
            urgency: Optional urgency level of the feature

        Returns:
            True if notification was sent successfully, False otherwise
        """
        if not settings.SLACK_WEBHOOK_URL:
            logger.debug("SLACK_WEBHOOK_URL not configured, skipping notification")
            return False

        try:
            confidence_emoji = SlackNotificationService._get_confidence_emoji(confidence)
            sentiment_emoji = SlackNotificationService._get_sentiment_emoji(sentiment) if sentiment else ""
            urgency_emoji = SlackNotificationService._get_urgency_emoji(urgency) if urgency else ""

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
                            "text": f"*Source*\n{source.upper()} ({source_id[-12:]})"
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

            blocks.append({
                "type": "divider"
            })

            payload = {"blocks": blocks}

            response = requests.post(
                settings.SLACK_WEBHOOK_URL,
                json=payload,
                timeout=5
            )

            if response.status_code == 200:
                logger.info(f"✅ Slack notification sent for matched feature: {existing_feature_name}")
                return True
            else:
                logger.warning(f"Failed to send Slack notification: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error sending Slack notification: {e}")
            return False

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
            return "🟢"  # Green
        elif confidence >= 0.70:
            return "🟡"  # Orange
        else:
            return "🔴"  # Red

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
        urgency_lower = urgency.lower()
        if urgency_lower == "critical":
            return "🚨"
        elif urgency_lower == "high":
            return "⚠️"
        elif urgency_lower == "medium":
            return "💡"
        else:
            return "📝"


def get_slack_notification_service() -> SlackNotificationService:
    """Factory function to get SlackNotificationService instance"""
    return SlackNotificationService()

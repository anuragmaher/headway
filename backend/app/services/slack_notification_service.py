"""
Slack notification service for sending feature updates to Slack channels.
"""

import logging
import requests
from typing import Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class SlackNotificationService:
    """Service for sending notifications to Slack via webhooks"""

    def __init__(self, webhook_url: Optional[str] = None):
        """
        Initialize Slack notification service

        Args:
            webhook_url: Slack webhook URL (defaults to settings.SLACK_WEBHOOK_URL)
        """
        self.webhook_url = webhook_url or settings.SLACK_WEBHOOK_URL

    def send_new_feature_notification(
        self,
        feature_name: str,
        feature_description: str,
        theme_name: str,
        urgency: str,
        customer_name: Optional[str] = None,
        quote: Optional[str] = None,
        feature_id: Optional[str] = None,
        gong_url: Optional[str] = None,
        call_title: Optional[str] = None,
        message_date: Optional[str] = None
    ) -> bool:
        """
        Send notification for a newly created feature

        Args:
            feature_name: Name of the feature
            feature_description: Description of the feature
            theme_name: Theme the feature belongs to
            urgency: Urgency level (low, medium, high, critical)
            customer_name: Name of the customer who requested it
            quote: Direct quote from the customer
            feature_id: ID of the feature
            gong_url: URL to the Gong call
            call_title: Title of the Gong call
            message_date: Date of the message

        Returns:
            bool: True if notification was sent successfully
        """
        if not self.webhook_url:
            logger.warning("Slack webhook URL not configured, skipping notification")
            return False

        try:
            # Determine color based on urgency
            color_map = {
                'critical': '#FF0000',  # Red
                'high': '#FF6B6B',      # Light red
                'medium': '#FFA500',    # Orange
                'low': '#36A64F',       # Green
            }
            color = color_map.get(urgency.lower(), '#808080')  # Default gray

            # Build the Slack message
            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🆕 New Feature Request: {feature_name}",
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Theme:*\n{theme_name}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Urgency:*\n{urgency.capitalize()}"
                        }
                    ]
                }
            ]

            # Add customer and call info
            info_fields = []
            if customer_name:
                info_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Customer:*\n{customer_name}"
                })
            if call_title:
                info_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Call:*\n{call_title}"
                })
            if message_date:
                info_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Date:*\n{message_date}"
                })

            if info_fields:
                blocks.append({
                    "type": "section",
                    "fields": info_fields
                })

            # Add description
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Description:*\n{feature_description}"
                }
            })

            # Add quote if available
            if quote:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Quote:*\n> _{quote}_"
                    }
                })

            # Add Gong URL button if available
            if gong_url:
                blocks.append({
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "🎧 Listen to Call",
                                "emoji": True
                            },
                            "url": gong_url,
                            "style": "primary"
                        }
                    ]
                })

            # Add divider
            blocks.append({"type": "divider"})

            payload = {
                "attachments": [
                    {
                        "color": color,
                        "blocks": blocks
                    }
                ]
            }

            response = requests.post(
                self.webhook_url,
                json=payload,
                timeout=10
            )

            if response.status_code == 200:
                logger.info(f"Successfully sent new feature notification for: {feature_name}")
                return True
            else:
                logger.error(f"Failed to send Slack notification: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            logger.error(f"Error sending Slack notification: {e}")
            return False

    def send_feature_merge_notification(
        self,
        feature_name: str,
        feature_description: str,
        theme_name: str,
        mention_count: int,
        customer_name: Optional[str] = None,
        quote: Optional[str] = None,
        feature_id: Optional[str] = None,
        gong_url: Optional[str] = None,
        call_title: Optional[str] = None,
        message_date: Optional[str] = None
    ) -> bool:
        """
        Send notification when a duplicate feature is merged (mention count increased)

        Args:
            feature_name: Name of the feature
            feature_description: Description of the feature
            theme_name: Theme the feature belongs to
            mention_count: New total mention count
            customer_name: Name of the customer who mentioned it
            quote: Direct quote from the customer
            feature_id: ID of the feature
            gong_url: URL to the Gong call
            call_title: Title of the Gong call
            message_date: Date of the message

        Returns:
            bool: True if notification was sent successfully
        """
        if not self.webhook_url:
            logger.warning("Slack webhook URL not configured, skipping notification")
            return False

        try:
            # Build the Slack message
            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🔄 Feature Request Updated: {feature_name}",
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Theme:*\n{theme_name}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Total Mentions:*\n{mention_count}"
                        }
                    ]
                }
            ]

            # Add customer and call info
            info_fields = []
            if customer_name:
                info_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Latest Request From:*\n{customer_name}"
                })
            if call_title:
                info_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Call:*\n{call_title}"
                })
            if message_date:
                info_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Date:*\n{message_date}"
                })

            if info_fields:
                blocks.append({
                    "type": "section",
                    "fields": info_fields
                })

            # Add description
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Description:*\n{feature_description}"
                }
            })

            # Add quote if available
            if quote:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Latest Quote:*\n> _{quote}_"
                    }
                })

            # Add Gong URL button if available
            if gong_url:
                blocks.append({
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "🎧 Listen to Call",
                                "emoji": True
                            },
                            "url": gong_url,
                            "style": "primary"
                        }
                    ]
                })

            # Add divider
            blocks.append({"type": "divider"})

            payload = {
                "attachments": [
                    {
                        "color": "#4A90E2",  # Blue for updates
                        "blocks": blocks
                    }
                ]
            }

            response = requests.post(
                self.webhook_url,
                json=payload,
                timeout=10
            )

            if response.status_code == 200:
                logger.info(f"Successfully sent feature merge notification for: {feature_name}")
                return True
            else:
                logger.error(f"Failed to send Slack notification: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            logger.error(f"Error sending Slack notification: {e}")
            return False

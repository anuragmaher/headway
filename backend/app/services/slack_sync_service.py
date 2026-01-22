"""
Slack Sync Service - Handles syncing messages from Slack
"""
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.workspace_connector import WorkspaceConnector
from app.models.message import Message
from app.services.message_service import MessageService
from app.schemas.message import MessageCreate, SourceType

logger = logging.getLogger(__name__)


class SlackSyncService:
    """Service for syncing Slack messages"""

    def __init__(self, db: Session):
        self.db = db
        self.message_service = MessageService(db)

    def sync_messages(
        self,
        connector: WorkspaceConnector,
        full_sync: bool = False,
        channel_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Sync messages from Slack.

        Args:
            connector: The Slack connector
            full_sync: Whether to do a full sync or incremental
            channel_ids: Specific channels to sync (if None, syncs enabled channels)

        Returns:
            Dict with sync results
        """
        if not connector.access_token:
            raise ValueError("Connector has no access token")

        from slack_sdk import WebClient
        from slack_sdk.errors import SlackApiError

        client = WebClient(token=connector.access_token)

        # Get channels to sync
        if channel_ids:
            channels = channel_ids
        else:
            # Get enabled labels (channels) from connector
            from app.services.connector_service import ConnectorService
            connector_service = ConnectorService(self.db)
            enabled_labels = connector_service.get_enabled_labels(connector.id)
            channels = [l.label_id for l in enabled_labels]

        if not channels:
            logger.warning(f"No channels configured for connector {connector.id}")
            return {"processed": 0, "new": 0, "updated": 0, "synced_ids": []}

        processed = 0
        new = 0
        updated = 0
        synced_ids = []

        # Determine oldest timestamp for incremental sync
        oldest = None
        if not full_sync and connector.last_synced_at:
            oldest = str(connector.last_synced_at.timestamp())

        for channel_id in channels:
            try:
                result = self._sync_channel(
                    client=client,
                    connector=connector,
                    channel_id=channel_id,
                    oldest=oldest
                )
                processed += result["processed"]
                new += result["new"]
                updated += result["updated"]
                synced_ids.extend(result["synced_ids"])

            except SlackApiError as e:
                logger.error(f"Slack API error for channel {channel_id}: {e}")
            except Exception as e:
                logger.exception(f"Error syncing channel {channel_id}: {e}")

        return {
            "processed": processed,
            "new": new,
            "updated": updated,
            "synced_ids": synced_ids
        }

    def _sync_channel(
        self,
        client,
        connector: WorkspaceConnector,
        channel_id: str,
        oldest: Optional[str] = None
    ) -> Dict[str, Any]:
        """Sync messages from a single channel"""
        processed = 0
        new = 0
        updated = 0
        synced_ids = []

        # Get channel info
        try:
            channel_info = client.conversations_info(channel=channel_id)
            channel_name = channel_info["channel"]["name"]
        except Exception:
            channel_name = channel_id

        # Paginate through messages
        cursor = None
        while True:
            kwargs = {
                "channel": channel_id,
                "limit": 200
            }
            if oldest:
                kwargs["oldest"] = oldest
            if cursor:
                kwargs["cursor"] = cursor

            response = client.conversations_history(**kwargs)
            messages = response.get("messages", [])

            for msg in messages:
                if msg.get("type") != "message":
                    continue

                # Skip bot messages and system messages
                if msg.get("subtype") in ["bot_message", "channel_join", "channel_leave"]:
                    continue

                # Process message
                result = self._process_message(
                    connector=connector,
                    channel_id=channel_id,
                    channel_name=channel_name,
                    msg=msg
                )

                processed += 1
                if result["created"]:
                    new += 1
                    synced_ids.append(str(result["message_id"]))
                elif result["updated"]:
                    updated += 1
                    synced_ids.append(str(result["message_id"]))

            # Check for more pages
            if not response.get("has_more"):
                break
            cursor = response.get("response_metadata", {}).get("next_cursor")

        return {
            "processed": processed,
            "new": new,
            "updated": updated,
            "synced_ids": synced_ids
        }

    def _process_message(
        self,
        connector: WorkspaceConnector,
        channel_id: str,
        channel_name: str,
        msg: dict
    ) -> Dict[str, Any]:
        """Process a single Slack message"""
        external_id = msg.get("ts", msg.get("client_msg_id", ""))
        thread_id = msg.get("thread_ts")
        content = msg.get("text", "")
        user_id = msg.get("user", "")

        # Parse timestamp
        sent_at = None
        if msg.get("ts"):
            try:
                sent_at = datetime.fromtimestamp(float(msg["ts"]), tz=timezone.utc)
            except (ValueError, TypeError):
                pass

        # Create message data
        message_data = MessageCreate(
            connector_id=connector.id,
            source=SourceType.SLACK,
            external_id=external_id,
            thread_id=thread_id,
            content=content,
            channel_id=channel_id,
            channel_name=channel_name,
            author_id=user_id,
            sent_at=sent_at,
            message_metadata={
                "team": connector.external_id,
                "reactions": msg.get("reactions", []),
                "reply_count": msg.get("reply_count", 0),
                "attachments": len(msg.get("attachments", []))
            }
        )

        # Get or create message
        message, created = self.message_service.get_or_create_message(
            workspace_id=connector.workspace_id,
            connector_id=connector.id,
            external_id=external_id,
            data=message_data
        )

        return {
            "message_id": message.id,
            "created": created,
            "updated": not created
        }

    def fetch_channels(self, connector: WorkspaceConnector) -> List[Dict[str, Any]]:
        """Fetch available channels from Slack"""
        from slack_sdk import WebClient

        if not connector.access_token:
            raise ValueError("Connector has no access token")

        client = WebClient(token=connector.access_token)
        channels = []

        cursor = None
        while True:
            kwargs = {"types": "public_channel,private_channel", "limit": 200}
            if cursor:
                kwargs["cursor"] = cursor

            response = client.conversations_list(**kwargs)

            for channel in response.get("channels", []):
                channels.append({
                    "id": channel["id"],
                    "name": channel["name"],
                    "is_private": channel.get("is_private", False),
                    "is_member": channel.get("is_member", False),
                    "num_members": channel.get("num_members", 0)
                })

            if not response.get("response_metadata", {}).get("next_cursor"):
                break
            cursor = response["response_metadata"]["next_cursor"]

        return channels

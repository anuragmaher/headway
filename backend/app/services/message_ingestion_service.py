import asyncio
import logging
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.models.workspace_connector import WorkspaceConnector
from app.models.message import Message
from app.services.slack_service import slack_service

logger = logging.getLogger(__name__)

# Maximum number of users to cache per connector to prevent memory leaks
MAX_USER_CACHE_SIZE = 500

# Batch commit size for memory efficiency
BATCH_COMMIT_SIZE = 50


class MessageIngestionService:
    """Service for ingesting messages from various connectors"""

    def __init__(self):
        # LRU-style user cache with max size to prevent memory leaks
        self._user_cache: Dict[str, Dict[str, Any]] = {}
        self._user_cache_order: List[str] = []  # Track insertion order for LRU eviction

    def _get_cached_user(self, user_key: str) -> Optional[Dict[str, Any]]:
        """Get user from cache"""
        return self._user_cache.get(user_key)

    def _set_cached_user(self, user_key: str, user_data: Dict[str, Any]) -> None:
        """Set user in cache with LRU eviction"""
        if user_key in self._user_cache:
            # Move to end (most recently used)
            self._user_cache_order.remove(user_key)
            self._user_cache_order.append(user_key)
            self._user_cache[user_key] = user_data
        else:
            # Evict oldest if at capacity
            while len(self._user_cache) >= MAX_USER_CACHE_SIZE:
                oldest_key = self._user_cache_order.pop(0)
                del self._user_cache[oldest_key]
            # Add new entry
            self._user_cache[user_key] = user_data
            self._user_cache_order.append(user_key)

    def clear_user_cache(self) -> None:
        """Clear the user cache (call periodically to free memory)"""
        self._user_cache.clear()
        self._user_cache_order.clear()

    async def ingest_slack_messages(self, connector_id: str, db: Session, hours_back: int = 24) -> Dict[str, int]:
        """
        Ingest messages from a Slack connector

        Args:
            connector_id: WorkspaceConnector ID to ingest messages for
            db: Database session
            hours_back: How many hours back to fetch messages (default: 24)

        Returns:
            Dictionary with 'total_checked' and 'new_added' counts
        """
        try:
            # Get the connector
            connector = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.id == connector_id,
                    WorkspaceConnector.connector_type == "slack",
                    WorkspaceConnector.is_active == True
                )
            ).first()

            if not connector:
                logger.error(f"Connector {connector_id} not found or not active")
                return {"total_checked": 0, "new_added": 0}

            if not connector.access_token:
                logger.error(f"No access token for connector {connector_id}")
                return {"total_checked": 0, "new_added": 0}

            # Get selected channels from config
            selected_channels = (connector.config or {}).get("selected_channels", [])
            if not selected_channels:
                logger.warning(f"No channels selected for connector {connector_id}")
                return {"total_checked": 0, "new_added": 0}

            # Calculate oldest timestamp (24 hours ago by default)
            oldest_time = datetime.now(timezone.utc) - timedelta(hours=hours_back)
            oldest_timestamp = str(oldest_time.timestamp())

            total_checked = 0
            total_new = 0

            # Process each selected channel
            for channel_info in selected_channels:
                channel_id = channel_info["id"]
                channel_name = channel_info["name"]

                logger.info(f"Ingesting messages from channel #{channel_name} ({channel_id})")

                try:
                    # Fetch messages from Slack (without timestamp filter for now)
                    messages = await slack_service.get_channel_messages(
                        token=connector.access_token,
                        channel_id=channel_id,
                        limit=100  # Start with recent 100 messages
                        # oldest=oldest_timestamp  # Commented out due to system clock issue
                    )

                    # Track total messages checked
                    total_checked += len(messages)

                    # Process and store messages
                    channel_new = await self._process_slack_messages(
                        messages=messages,
                        connector=connector,
                        channel_id=channel_id,
                        channel_name=channel_name,
                        db=db
                    )

                    total_new += channel_new
                    logger.info(f"Checked {len(messages)} messages, added {channel_new} new from #{channel_name}")

                except Exception as e:
                    logger.error(f"Error ingesting messages from channel #{channel_name}: {e}")
                    continue

            # Update connector sync status
            connector.last_synced_at = datetime.now(timezone.utc)
            connector.sync_status = "success"
            connector.sync_error = None
            db.commit()

            logger.info(f"Total for connector {connector_id}: checked {total_checked}, added {total_new}")
            return {"total_checked": total_checked, "new_added": total_new}

        except Exception as e:
            logger.error(f"Error in ingest_slack_messages for connector {connector_id}: {e}")
            # Update connector with error status
            if 'connector' in locals():
                connector.sync_status = "error"
                connector.sync_error = str(e)
                db.commit()
            return {"total_checked": 0, "new_added": 0}

    async def _process_slack_messages(
        self,
        messages: List[Dict[str, Any]],
        connector: WorkspaceConnector,
        channel_id: str,
        channel_name: str,
        db: Session
    ) -> int:
        """
        Process and store Slack messages in database

        Args:
            messages: List of Slack message objects
            connector: WorkspaceConnector instance
            channel_id: Slack channel ID
            channel_name: Slack channel name
            db: Database session

        Returns:
            Number of messages processed
        """
        processed_count = 0
        batch_count = 0  # Track messages in current batch

        for message_data in messages:
            try:
                # Get external ID first
                external_id = message_data.get("ts")  # Slack timestamp as unique ID

                # Skip certain message types
                if self._should_skip_message(message_data):
                    logger.debug(f"Skipping message {external_id}: {self._get_skip_reason(message_data)}")
                    continue

                # Check if message already exists
                existing_message = db.query(Message).filter(
                    and_(
                        Message.external_id == external_id,
                        Message.connector_id == connector.id,
                        Message.channel_id == channel_id
                    )
                ).first()

                if existing_message:
                    continue  # Skip if already exists

                # Get author information
                author_info = await self._get_author_info(
                    user_id=message_data.get("user"),
                    token=connector.access_token
                )

                # Extract title from Slack message
                title = self._extract_slack_title(
                    message_data=message_data,
                    channel_name=channel_name
                )

                # Parse timestamp
                try:
                    sent_at = datetime.fromtimestamp(float(external_id), tz=timezone.utc)
                except (ValueError, TypeError):
                    sent_at = datetime.now(timezone.utc)

                # Create message object
                message = Message(
                    external_id=external_id,
                    content=message_data.get("text", ""),
                    source="slack",
                    channel_name=channel_name,
                    channel_id=channel_id,
                    author_name=author_info.get("name"),
                    author_id=message_data.get("user"),
                    author_email=author_info.get("email"),
                    title=title,
                    message_metadata={
                        "reactions": message_data.get("reactions", []),
                        "thread_ts": message_data.get("thread_ts"),
                        "reply_count": message_data.get("reply_count", 0),
                    },
                    thread_id=message_data.get("thread_ts"),
                    workspace_id=connector.workspace_id,
                    connector_id=connector.id,
                    sent_at=sent_at
                )

                db.add(message)
                processed_count += 1
                batch_count += 1

                # Batch commit to reduce memory pressure
                if batch_count >= BATCH_COMMIT_SIZE:
                    try:
                        db.commit()
                        logger.debug(f"Batch committed {batch_count} messages from #{channel_name}")
                        batch_count = 0
                    except Exception as e:
                        logger.error(f"Error in batch commit for #{channel_name}: {e}")
                        db.rollback()
                        batch_count = 0

            except Exception as e:
                logger.error(f"Error processing message {message_data.get('ts', 'unknown')}: {e}")
                continue

        # Commit remaining messages in the last batch
        if batch_count > 0:
            try:
                db.commit()
                logger.info(f"Committed final batch of {batch_count} messages from #{channel_name}")
            except Exception as e:
                logger.error(f"Error committing final batch for #{channel_name}: {e}")
                db.rollback()
                processed_count -= batch_count  # Subtract uncommitted messages from count

        logger.info(f"Total {processed_count} new messages processed from #{channel_name}")
        return processed_count

    def _should_skip_message(self, message_data: Dict[str, Any]) -> bool:
        """
        Determine if a message should be skipped during ingestion

        Args:
            message_data: Slack message object

        Returns:
            True if message should be skipped
        """
        # Only skip very specific system messages that add no value
        subtype = message_data.get("subtype")
        if subtype in [
            "channel_join", "channel_leave", "channel_archive", "channel_unarchive",
            "channel_name", "channel_topic", "channel_purpose", "group_join", "group_leave"
        ]:
            return True

        # Skip empty messages (no text content)
        if not message_data.get("text", "").strip():
            return True

        # Skip obvious spam/noise apps (be very selective here)
        app_id = message_data.get("app_id")
        if app_id:
            # Only skip apps that are definitely noise (like GIFs)
            noise_apps = ["A0F7XDUAZ"]  # Giphy
            if app_id in noise_apps:
                return True

        # NOTE: We now include bot messages! They could contain feature requests
        # NOTE: We include app messages! They could be feature request forms/tools

        return False

    def _get_skip_reason(self, message_data: Dict[str, Any]) -> str:
        """Get reason why message was skipped (for debugging)"""
        subtype = message_data.get("subtype")
        if subtype in [
            "channel_join", "channel_leave", "channel_archive", "channel_unarchive",
            "channel_name", "channel_topic", "channel_purpose", "group_join", "group_leave"
        ]:
            return f"system message: {subtype}"

        if not message_data.get("text", "").strip():
            return "empty text"

        app_id = message_data.get("app_id")
        if app_id:
            noise_apps = ["A0F7XDUAZ"]  # Giphy
            if app_id in noise_apps:
                return f"noise app: {app_id}"

        return "unknown reason"

    def _extract_slack_title(self, message_data: Dict[str, Any], channel_name: str) -> Optional[str]:
        """
        Extract a title from a Slack message.

        Strategy:
        1. Check for explicit thread subject in message metadata
        2. Use first 80 characters of message text
        3. Fallback to channel name with thread indicator

        Args:
            message_data: Slack message object
            channel_name: Slack channel name

        Returns:
            Title string or None
        """
        try:
            # Check for explicit subject/topic
            subject = message_data.get("subject")
            if subject and subject.strip():
                return subject[:255]

            # Get message text as title
            text = message_data.get("text", "").strip()
            if text:
                # Take first 80 chars, clean up
                title = text[:80]
                # Remove markdown/formatting for cleaner title
                title = title.replace("*", "").replace("_", "").replace("`", "")
                return title

            # Fallback to channel name
            if message_data.get("thread_ts") and message_data.get("thread_ts") != message_data.get("ts"):
                return f"#{channel_name} (thread)"
            else:
                return f"#{channel_name}"

        except Exception as e:
            logger.warning(f"Error extracting Slack message title: {e}")
            return None

    async def _get_author_info(self, user_id: Optional[str], token: str) -> Dict[str, Any]:
        """
        Get author information from Slack API with caching

        Args:
            user_id: Slack user ID
            token: Slack access token

        Returns:
            User information dict
        """
        if not user_id:
            return {"name": "Unknown User", "email": None}

        # Check LRU cache first
        cached = self._get_cached_user(user_id)
        if cached:
            return cached

        try:
            user_info = await slack_service.get_user_info(token, user_id)

            # Extract relevant information
            profile = user_info.get("profile", {})
            author_info = {
                "name": profile.get("display_name") or profile.get("real_name") or user_info.get("name", "Unknown User"),
                "email": profile.get("email")
            }

            # Cache the result with LRU eviction
            self._set_cached_user(user_id, author_info)
            return author_info

        except Exception as e:
            logger.warning(f"Failed to fetch user info for {user_id}: {e}")
            return {"name": "Unknown User", "email": None}


# Global service instance
message_ingestion_service = MessageIngestionService()

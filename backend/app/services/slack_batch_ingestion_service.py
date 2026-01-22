"""
Optimized Slack Batch Ingestion Service - Fast batch data storage without AI extraction.

This service focuses on:
1. Fast fetching of Slack messages from selected channels
2. Batch duplicate detection
3. Batch insertion into the Message table
4. Deferred AI processing (marked as is_processed=False)

AI extraction happens in a separate batch processing task.

Usage:
    from app.services.slack_batch_ingestion_service import slack_batch_ingestion_service

    result = await slack_batch_ingestion_service.ingest_messages(
        connector_id="...",
        db=db,
        hours_back=24
    )
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Set
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.workspace_connector import WorkspaceConnector
from app.models.message import Message
from app.services.slack_service import slack_service
from app.services.batch_db_service import batch_db_service

logger = logging.getLogger(__name__)

# Maximum number of users to cache per connector
MAX_USER_CACHE_SIZE = 500


class SlackBatchIngestionService:
    """
    Optimized Slack ingestion service with batch operations.

    Key optimizations:
    - Batch check for existing messages before fetching user info
    - Bulk insert new messages
    - No inline AI extraction (deferred to batch processing)
    - LRU user cache with max size
    """

    def __init__(self):
        # LRU-style user cache
        self._user_cache: Dict[str, Dict[str, Any]] = {}
        self._user_cache_order: List[str] = []

    def _get_cached_user(self, user_key: str) -> Optional[Dict[str, Any]]:
        """Get user from cache."""
        return self._user_cache.get(user_key)

    def _set_cached_user(self, user_key: str, user_data: Dict[str, Any]) -> None:
        """Set user in cache with LRU eviction."""
        if user_key in self._user_cache:
            self._user_cache_order.remove(user_key)
            self._user_cache_order.append(user_key)
            self._user_cache[user_key] = user_data
        else:
            while len(self._user_cache) >= MAX_USER_CACHE_SIZE:
                oldest_key = self._user_cache_order.pop(0)
                del self._user_cache[oldest_key]
            self._user_cache[user_key] = user_data
            self._user_cache_order.append(user_key)

    def clear_user_cache(self) -> None:
        """Clear the user cache."""
        self._user_cache.clear()
        self._user_cache_order.clear()

    async def ingest_messages(
        self,
        connector_id: str,
        db: Session,
        hours_back: int = 24
    ) -> Dict[str, int]:
        """
        Ingest Slack messages with optimized batch processing.

        This method:
        1. Fetches messages from selected Slack channels
        2. Batch checks for duplicates
        3. Batch inserts into Message table with is_processed=False
        4. Returns counts for sync tracking

        AI extraction is NOT performed here - it happens in a separate task.

        Args:
            connector_id: WorkspaceConnector UUID string
            db: Database session
            hours_back: How many hours back to fetch messages

        Returns:
            Dict with 'total_checked', 'new_added', 'duplicates_skipped'
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
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            if not connector.access_token:
                logger.error(f"No access token for connector {connector_id}")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            # Get selected channels from config
            selected_channels = (connector.config or {}).get("selected_channels", [])
            if not selected_channels:
                logger.warning(f"No channels selected for connector {connector_id}")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            total_checked = 0
            total_new = 0
            total_skipped = 0
            all_inserted_ids: List[str] = []

            # Process each selected channel
            for channel_info in selected_channels:
                channel_id = channel_info["id"]
                channel_name = channel_info["name"]

                logger.info(f"Ingesting messages from channel #{channel_name}")

                try:
                    result = await self._batch_process_channel(
                        connector=connector,
                        channel_id=channel_id,
                        channel_name=channel_name,
                        db=db
                    )

                    total_checked += result.get("total_checked", 0)
                    total_new += result.get("new_added", 0)
                    total_skipped += result.get("duplicates_skipped", 0)
                    all_inserted_ids.extend(result.get("inserted_ids", []))

                    logger.info(
                        f"Channel #{channel_name}: checked {result.get('total_checked', 0)}, "
                        f"added {result.get('new_added', 0)}, skipped {result.get('duplicates_skipped', 0)}"
                    )

                except Exception as e:
                    logger.error(f"Error ingesting messages from #{channel_name}: {e}")
                    continue

            # Update connector sync status
            connector.last_synced_at = datetime.now(timezone.utc)
            connector.sync_status = "success"
            connector.sync_error = None
            db.commit()

            logger.info(
                f"Slack ingestion complete: {total_new} new, {total_skipped} skipped "
                f"out of {total_checked} checked"
            )

            return {
                "total_checked": total_checked,
                "new_added": total_new,
                "duplicates_skipped": total_skipped,
                "inserted_ids": all_inserted_ids
            }

        except Exception as e:
            logger.error(f"Error in Slack ingestion for connector {connector_id}: {e}")
            if 'connector' in locals() and connector:
                connector.sync_status = "error"
                connector.sync_error = str(e)
                db.commit()
            return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

    async def _batch_process_channel(
        self,
        connector: WorkspaceConnector,
        channel_id: str,
        channel_name: str,
        db: Session
    ) -> Dict[str, int]:
        """
        Batch process messages from a single channel.

        Args:
            connector: WorkspaceConnector instance
            channel_id: Slack channel ID
            channel_name: Slack channel name
            db: Database session

        Returns:
            Dict with counts
        """
        try:
            # Step 1: Fetch messages from Slack
            messages = await slack_service.get_channel_messages(
                token=connector.access_token,
                channel_id=channel_id,
                limit=100
            )

            if not messages:
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            total_checked = len(messages)

            # Step 2: Filter out system messages
            valid_messages = [m for m in messages if not self._should_skip_message(m)]

            # Step 3: Get external IDs and check for existing
            external_ids = [m.get("ts") for m in valid_messages if m.get("ts")]
            existing_ids = self._get_existing_message_ids(
                db=db,
                external_ids=external_ids,
                connector_id=str(connector.id),
                channel_id=channel_id
            )

            # Step 4: Filter to only new messages
            new_messages = [m for m in valid_messages if m.get("ts") not in existing_ids]
            duplicates_skipped = len(valid_messages) - len(new_messages)

            if not new_messages:
                return {
                    "total_checked": total_checked,
                    "new_added": 0,
                    "duplicates_skipped": duplicates_skipped
                }

            # Step 5: Prepare messages for batch insert
            # Collect unique user IDs to fetch in batch
            user_ids = set()
            for msg in new_messages:
                user_id = msg.get("user")
                if user_id and not self._get_cached_user(user_id):
                    user_ids.add(user_id)

            # Fetch all unknown users
            for user_id in user_ids:
                try:
                    user_info = await slack_service.get_user_info(connector.access_token, user_id)
                    profile = user_info.get("profile", {})
                    author_info = {
                        "name": profile.get("display_name") or profile.get("real_name") or user_info.get("name", "Unknown User"),
                        "email": profile.get("email")
                    }
                    self._set_cached_user(user_id, author_info)
                except Exception as e:
                    logger.warning(f"Failed to fetch user info for {user_id}: {e}")
                    self._set_cached_user(user_id, {"name": "Unknown User", "email": None})

            # Step 6: Build message dicts for batch insert
            message_dicts = []
            for msg in new_messages:
                message_dict = self._prepare_message(
                    message_data=msg,
                    connector=connector,
                    channel_id=channel_id,
                    channel_name=channel_name
                )
                if message_dict:
                    message_dicts.append(message_dict)

            # Step 7: Batch insert
            if message_dicts:
                result = batch_db_service.batch_insert_messages(
                    db=db,
                    messages=message_dicts,
                    workspace_id=str(connector.workspace_id),
                    connector_id=str(connector.id),
                    source="slack"
                )
                return {
                    "total_checked": total_checked,
                    "new_added": result.get("new_added", 0),
                    "duplicates_skipped": duplicates_skipped + result.get("duplicates_skipped", 0),
                    "inserted_ids": result.get("inserted_ids", [])
                }

            return {
                "total_checked": total_checked,
                "new_added": 0,
                "duplicates_skipped": duplicates_skipped,
                "inserted_ids": []
            }

        except Exception as e:
            logger.error(f"Error in batch process for channel #{channel_name}: {e}")
            raise

    def _get_existing_message_ids(
        self,
        db: Session,
        external_ids: List[str],
        connector_id: str,
        channel_id: str
    ) -> Set[str]:
        """Get set of external IDs that already exist."""
        if not external_ids:
            return set()

        try:
            existing = db.query(Message.external_id).filter(
                and_(
                    Message.connector_id == UUID(connector_id),
                    Message.channel_id == channel_id,
                    Message.external_id.in_(external_ids)
                )
            ).all()

            return {row[0] for row in existing}

        except Exception as e:
            logger.error(f"Error checking existing messages: {e}")
            return set()

    def _should_skip_message(self, message_data: Dict[str, Any]) -> bool:
        """Determine if a message should be skipped."""
        subtype = message_data.get("subtype")
        if subtype in [
            "channel_join", "channel_leave", "channel_archive", "channel_unarchive",
            "channel_name", "channel_topic", "channel_purpose", "group_join", "group_leave"
        ]:
            return True

        if not message_data.get("text", "").strip():
            return True

        app_id = message_data.get("app_id")
        if app_id:
            noise_apps = ["A0F7XDUAZ"]  # Giphy
            if app_id in noise_apps:
                return True

        return False

    def _prepare_message(
        self,
        message_data: Dict[str, Any],
        connector: WorkspaceConnector,
        channel_id: str,
        channel_name: str
    ) -> Optional[Dict[str, Any]]:
        """Prepare a message dict for batch insert."""
        external_id = message_data.get("ts")
        if not external_id:
            return None

        # Get author info from cache
        user_id = message_data.get("user")
        author_info = self._get_cached_user(user_id) or {"name": "Unknown User", "email": None}

        # Extract title
        title = self._extract_title(message_data, channel_name)

        # Parse timestamp
        try:
            sent_at = datetime.fromtimestamp(float(external_id), tz=timezone.utc)
        except (ValueError, TypeError):
            sent_at = datetime.now(timezone.utc)

        return {
            "external_id": external_id,
            "content": message_data.get("text", ""),
            "title": title,
            "channel_name": channel_name,
            "channel_id": channel_id,
            "author_name": author_info.get("name"),
            "author_id": user_id,
            "author_email": author_info.get("email"),
            "thread_id": message_data.get("thread_ts"),
            "metadata": {
                "reactions": message_data.get("reactions", []),
                "thread_ts": message_data.get("thread_ts"),
                "reply_count": message_data.get("reply_count", 0),
            },
            "sent_at": sent_at,
        }

    def _extract_title(self, message_data: Dict[str, Any], channel_name: str) -> Optional[str]:
        """Extract a title from a Slack message."""
        try:
            subject = message_data.get("subject")
            if subject and subject.strip():
                return subject[:255]

            text = message_data.get("text", "").strip()
            if text:
                title = text[:80]
                title = title.replace("*", "").replace("_", "").replace("`", "")
                return title

            if message_data.get("thread_ts") and message_data.get("thread_ts") != message_data.get("ts"):
                return f"#{channel_name} (thread)"
            else:
                return f"#{channel_name}"

        except Exception:
            return None


# Global service instance
slack_batch_ingestion_service = SlackBatchIngestionService()

"""
Batch Database Service - Efficient bulk operations for data ingestion.

Provides high-performance batch insert/update operations to replace
row-by-row database operations. Uses SQLAlchemy bulk operations
for optimal performance.

Usage:
    from app.services.batch_db_service import batch_db_service

    # Batch insert messages
    messages = [{"external_id": "...", "content": "...", ...}, ...]
    inserted_count = batch_db_service.batch_insert_messages(db, messages, workspace_id)
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import and_

from app.models.message import Message
from app.models.feature import Feature
from app.models.customer import Customer

logger = logging.getLogger(__name__)

# Batch size for bulk operations - balance between memory and performance
DEFAULT_BATCH_SIZE = 100


class BatchDatabaseService:
    """
    Service for high-performance batch database operations.

    Key features:
    - Bulk inserts using SQLAlchemy's bulk_insert_mappings
    - Duplicate detection before insert
    - Automatic batching for large datasets
    - Transaction management
    """

    def batch_insert_messages(
        self,
        db: Session,
        messages: List[Dict[str, Any]],
        workspace_id: str,
        integration_id: Optional[str] = None,
        source: str = "unknown",
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> Dict[str, int]:
        """
        Batch insert messages with duplicate detection.

        Args:
            db: Database session
            messages: List of message dictionaries with required fields:
                - external_id: Unique ID from source system
                - content: Message text content
                - Optional: channel_id, channel_name, author_name, author_email, etc.
            workspace_id: Workspace UUID string
            integration_id: Optional integration UUID string
            source: Source type (slack, gong, fathom, gmail)
            batch_size: Number of records per batch

        Returns:
            Dict with 'total_checked', 'new_added', 'duplicates_skipped'
        """
        if not messages:
            return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0}

        total_checked = len(messages)
        new_added = 0
        duplicates_skipped = 0

        try:
            # Get existing external_ids in one query for duplicate detection
            external_ids = [m.get("external_id") for m in messages if m.get("external_id")]

            existing_ids = self._get_existing_external_ids(
                db=db,
                external_ids=external_ids,
                workspace_id=workspace_id,
                integration_id=integration_id,
                source=source
            )

            # Filter out duplicates
            new_messages = [
                m for m in messages
                if m.get("external_id") and m["external_id"] not in existing_ids
            ]
            duplicates_skipped = total_checked - len(new_messages)

            if not new_messages:
                logger.info(f"All {total_checked} messages already exist, skipping batch insert")
                return {
                    "total_checked": total_checked,
                    "new_added": 0,
                    "duplicates_skipped": duplicates_skipped
                }

            # Process in batches
            for i in range(0, len(new_messages), batch_size):
                batch = new_messages[i:i + batch_size]

                # Prepare message objects for bulk insert
                message_mappings = []
                for msg in batch:
                    mapping = self._prepare_message_mapping(
                        msg=msg,
                        workspace_id=workspace_id,
                        integration_id=integration_id,
                        source=source
                    )
                    if mapping:
                        message_mappings.append(mapping)

                if message_mappings:
                    # Bulk insert
                    db.bulk_insert_mappings(Message, message_mappings)
                    new_added += len(message_mappings)

            # Commit all batches
            db.commit()
            logger.info(
                f"Batch insert complete: {new_added} new, "
                f"{duplicates_skipped} duplicates skipped out of {total_checked} total"
            )

        except Exception as e:
            logger.error(f"Error in batch insert: {e}")
            db.rollback()
            raise

        return {
            "total_checked": total_checked,
            "new_added": new_added,
            "duplicates_skipped": duplicates_skipped
        }

    def _get_existing_external_ids(
        self,
        db: Session,
        external_ids: List[str],
        workspace_id: str,
        integration_id: Optional[str],
        source: str
    ) -> Set[str]:
        """
        Get set of external_ids that already exist in database.

        Uses single query for efficient duplicate detection.
        """
        if not external_ids:
            return set()

        try:
            query = db.query(Message.external_id).filter(
                and_(
                    Message.workspace_id == UUID(workspace_id),
                    Message.external_id.in_(external_ids),
                    Message.source == source
                )
            )

            if integration_id:
                query = query.filter(Message.integration_id == UUID(integration_id))

            existing = query.all()
            return {row[0] for row in existing}

        except Exception as e:
            logger.error(f"Error checking existing messages: {e}")
            return set()

    def _prepare_message_mapping(
        self,
        msg: Dict[str, Any],
        workspace_id: str,
        integration_id: Optional[str],
        source: str
    ) -> Optional[Dict[str, Any]]:
        """
        Prepare a message dictionary for bulk_insert_mappings.

        Returns None if required fields are missing.
        """
        external_id = msg.get("external_id")
        if not external_id:
            return None

        now = datetime.now(timezone.utc)

        # Parse sent_at if provided
        sent_at = msg.get("sent_at")
        if isinstance(sent_at, str):
            try:
                sent_at = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                sent_at = now
        elif not isinstance(sent_at, datetime):
            sent_at = now

        mapping = {
            "external_id": external_id,
            "content": msg.get("content", ""),
            "source": source,
            "workspace_id": UUID(workspace_id),
            "channel_id": msg.get("channel_id"),
            "channel_name": msg.get("channel_name"),
            "author_name": msg.get("author_name"),
            "author_id": msg.get("author_id"),
            "author_email": msg.get("author_email"),
            "title": msg.get("title"),
            "thread_id": msg.get("thread_id"),
            "is_thread_reply": msg.get("is_thread_reply", False),
            "message_metadata": msg.get("metadata", {}),
            "sent_at": sent_at,
            "created_at": now,
            "updated_at": now,
            "is_processed": False,  # Mark for later AI processing
        }

        if integration_id:
            mapping["integration_id"] = UUID(integration_id)

        # Optional customer_id
        if msg.get("customer_id"):
            mapping["customer_id"] = UUID(msg["customer_id"])

        return mapping

    def batch_insert_features(
        self,
        db: Session,
        features: List[Dict[str, Any]],
        workspace_id: str,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> Dict[str, int]:
        """
        Batch insert features with duplicate detection by name + theme.

        Args:
            db: Database session
            features: List of feature dictionaries
            workspace_id: Workspace UUID string
            batch_size: Number of records per batch

        Returns:
            Dict with counts
        """
        if not features:
            return {"total": 0, "new_added": 0, "duplicates": 0}

        total = len(features)
        new_added = 0

        try:
            # Get existing features by name for duplicate detection
            existing_names = self._get_existing_feature_names(db, workspace_id)

            # Filter and prepare new features
            feature_mappings = []
            for feat in features:
                name = feat.get("name", "").strip().lower()
                theme_id = feat.get("theme_id")

                # Simple duplicate check by name (case-insensitive)
                if name and name not in existing_names:
                    mapping = self._prepare_feature_mapping(feat, workspace_id)
                    if mapping:
                        feature_mappings.append(mapping)
                        existing_names.add(name)  # Track for same-batch dedup

            if feature_mappings:
                # Process in batches
                for i in range(0, len(feature_mappings), batch_size):
                    batch = feature_mappings[i:i + batch_size]
                    db.bulk_insert_mappings(Feature, batch)
                    new_added += len(batch)

                db.commit()

            duplicates = total - new_added
            logger.info(f"Batch feature insert: {new_added} new, {duplicates} duplicates")

        except Exception as e:
            logger.error(f"Error in batch feature insert: {e}")
            db.rollback()
            raise

        return {"total": total, "new_added": new_added, "duplicates": total - new_added}

    def _get_existing_feature_names(self, db: Session, workspace_id: str) -> Set[str]:
        """Get set of existing feature names (lowercase) for workspace."""
        try:
            features = db.query(Feature.name).filter(
                Feature.workspace_id == UUID(workspace_id)
            ).all()
            return {f[0].strip().lower() for f in features if f[0]}
        except Exception as e:
            logger.error(f"Error getting existing features: {e}")
            return set()

    def _prepare_feature_mapping(
        self,
        feat: Dict[str, Any],
        workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        """Prepare feature dict for bulk insert."""
        name = feat.get("name")
        if not name:
            return None

        now = datetime.now(timezone.utc)

        mapping = {
            "name": name,
            "description": feat.get("description", ""),
            "workspace_id": UUID(workspace_id),
            "status": feat.get("status", "new"),
            "urgency": feat.get("urgency", "medium"),
            "mention_count": feat.get("mention_count", 1),
            "first_mentioned": feat.get("first_mentioned", now),
            "last_mentioned": feat.get("last_mentioned", now),
            "created_at": now,
            "updated_at": now,
            "ai_metadata": feat.get("ai_metadata", {}),
        }

        if feat.get("theme_id"):
            mapping["theme_id"] = UUID(feat["theme_id"])

        return mapping

    def batch_update_processed_status(
        self,
        db: Session,
        message_ids: List[str],
        is_processed: bool = True
    ) -> int:
        """
        Batch update is_processed status for messages.

        Args:
            db: Database session
            message_ids: List of message UUID strings
            is_processed: New processed status

        Returns:
            Number of rows updated
        """
        if not message_ids:
            return 0

        try:
            uuids = [UUID(mid) for mid in message_ids]
            updated = db.query(Message).filter(
                Message.id.in_(uuids)
            ).update(
                {
                    "is_processed": is_processed,
                    "updated_at": datetime.now(timezone.utc)
                },
                synchronize_session=False
            )
            db.commit()
            logger.info(f"Updated {updated} messages to is_processed={is_processed}")
            return updated

        except Exception as e:
            logger.error(f"Error updating processed status: {e}")
            db.rollback()
            return 0

    def get_unprocessed_messages(
        self,
        db: Session,
        workspace_id: str,
        source: Optional[str] = None,
        limit: int = 100
    ) -> List[Message]:
        """
        Get unprocessed messages for AI extraction.

        Args:
            db: Database session
            workspace_id: Workspace UUID string
            source: Optional source filter (gong, fathom, gmail, slack)
            limit: Maximum messages to return

        Returns:
            List of Message objects
        """
        try:
            query = db.query(Message).filter(
                and_(
                    Message.workspace_id == UUID(workspace_id),
                    Message.is_processed == False
                )
            )

            if source:
                query = query.filter(Message.source == source)

            # Order by sent_at to process oldest first
            return query.order_by(Message.sent_at.asc()).limit(limit).all()

        except Exception as e:
            logger.error(f"Error getting unprocessed messages: {e}")
            return []


# Global service instance
batch_db_service = BatchDatabaseService()

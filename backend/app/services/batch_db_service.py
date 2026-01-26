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
import uuid as uuid_module
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import and_

from app.models.message import Message
from app.models.raw_transcript import RawTranscript
from app.models.customer_ask import CustomerAsk
from app.models.customer import Customer
from app.services.customer_extraction_service import customer_extraction_service

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
        connector_id: Optional[str] = None,
        source: str = "unknown",
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> Dict[str, Any]:
        """
        Batch insert messages with duplicate detection.

        Args:
            db: Database session
            messages: List of message dictionaries with required fields:
                - external_id: Unique ID from source system
                - content: Message text content
                - Optional: channel_id, channel_name, author_name, author_email, etc.
            workspace_id: Workspace UUID string
            connector_id: Optional WorkspaceConnector UUID string
            source: Source type (slack, gong, fathom, gmail)
            batch_size: Number of records per batch

        Returns:
            Dict with:
                - 'total_checked': Total messages checked
                - 'new_added': Number of new messages inserted
                - 'duplicates_skipped': Number of duplicates skipped
                - 'inserted_ids': List of UUID strings for newly inserted messages
        """
        if not messages:
            return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

        total_checked = len(messages)
        new_added = 0
        duplicates_skipped = 0
        inserted_ids: List[str] = []

        try:
            # Get existing external_ids in one query for duplicate detection
            external_ids = [m.get("external_id") for m in messages if m.get("external_id")]

            existing_ids = self._get_existing_external_ids(
                db=db,
                external_ids=external_ids,
                workspace_id=workspace_id,
                connector_id=connector_id,
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
                    "duplicates_skipped": duplicates_skipped,
                    "inserted_ids": []
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
                        connector_id=connector_id,
                        source=source,
                        db=db  # Pass db for customer extraction
                    )
                    if mapping:
                        message_mappings.append(mapping)
                        # Track the generated ID
                        inserted_ids.append(str(mapping["id"]))

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

            # TRIGGER AI PIPELINE: Immediately start normalization for new messages
            if new_added > 0:
                self._trigger_ai_pipeline(workspace_id)

        except Exception as e:
            logger.error(f"Error in batch insert: {e}")
            db.rollback()
            raise

        return {
            "total_checked": total_checked,
            "new_added": new_added,
            "duplicates_skipped": duplicates_skipped,
            "inserted_ids": inserted_ids
        }

    def batch_insert_raw_transcripts(
        self,
        db: Session,
        transcripts: List[Dict[str, Any]],
        workspace_id: str,
        source_type: str,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> Dict[str, Any]:
        """
        Batch insert raw transcripts with duplicate detection.

        Args:
            db: Database session
            transcripts: List of transcript dictionaries with required fields:
                - source_id: Unique ID from source system (e.g., Gong call ID)
                - raw_data: Complete raw transcript/call data as dict
                - Optional: title, duration_seconds, transcript_date, participant_count
            workspace_id: Workspace UUID string
            source_type: Source type ('gong', 'fathom')
            batch_size: Number of records per batch

        Returns:
            Dict with:
                - 'total_checked': Total transcripts checked
                - 'new_added': Number of new transcripts inserted
                - 'duplicates_skipped': Number of duplicates skipped
                - 'inserted_ids': List of UUID strings for newly inserted transcripts
        """
        if not transcripts:
            return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

        total_checked = len(transcripts)
        new_added = 0
        duplicates_skipped = 0
        inserted_ids: List[str] = []

        try:
            # Get existing source_ids in one query for duplicate detection
            source_ids = [t.get("source_id") for t in transcripts if t.get("source_id")]

            existing_ids = self._get_existing_transcript_source_ids(
                db=db,
                source_ids=source_ids,
                workspace_id=workspace_id,
                source_type=source_type
            )

            # Also get existing title+date combinations to prevent same-name duplicates
            existing_title_dates = self._get_existing_transcript_title_dates(
                db=db,
                workspace_id=workspace_id
            )

            # Filter out duplicates by source_id OR by title+date
            new_transcripts = []
            for t in transcripts:
                if not t.get("source_id"):
                    continue
                if t["source_id"] in existing_ids:
                    continue
                # Check title+date duplicate
                title = t.get("title") or ""
                transcript_date = t.get("transcript_date")
                if transcript_date:
                    if isinstance(transcript_date, str):
                        try:
                            from datetime import datetime
                            transcript_date = datetime.fromisoformat(transcript_date.replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            transcript_date = None
                    if transcript_date:
                        date_key = (title.lower().strip(), transcript_date.date())
                        if date_key in existing_title_dates:
                            logger.debug(f"Skipping duplicate by title+date: {title}")
                            continue
                        # Add to set to prevent duplicates within same batch
                        existing_title_dates.add(date_key)
                new_transcripts.append(t)

            duplicates_skipped = total_checked - len(new_transcripts)

            if not new_transcripts:
                logger.info(f"All {total_checked} transcripts already exist, skipping batch insert")
                return {
                    "total_checked": total_checked,
                    "new_added": 0,
                    "duplicates_skipped": duplicates_skipped,
                    "inserted_ids": []
                }

            # Process in batches
            for i in range(0, len(new_transcripts), batch_size):
                batch = new_transcripts[i:i + batch_size]

                # Prepare transcript objects for bulk insert
                transcript_mappings = []
                for t in batch:
                    mapping = self._prepare_raw_transcript_mapping(
                        transcript=t,
                        workspace_id=workspace_id,
                        source_type=source_type
                    )
                    if mapping:
                        transcript_mappings.append(mapping)
                        inserted_ids.append(str(mapping["id"]))

                if transcript_mappings:
                    db.bulk_insert_mappings(RawTranscript, transcript_mappings)
                    new_added += len(transcript_mappings)

            db.commit()
            logger.info(
                f"Raw transcript batch insert complete: {new_added} new, "
                f"{duplicates_skipped} duplicates skipped out of {total_checked} total"
            )

        except Exception as e:
            logger.error(f"Error in raw transcript batch insert: {e}")
            db.rollback()
            raise

        return {
            "total_checked": total_checked,
            "new_added": new_added,
            "duplicates_skipped": duplicates_skipped,
            "inserted_ids": inserted_ids
        }

    def _get_existing_transcript_source_ids(
        self,
        db: Session,
        source_ids: List[str],
        workspace_id: str,
        source_type: str
    ) -> Set[str]:
        """Get set of source_ids that already exist in raw_transcripts."""
        if not source_ids:
            return set()

        try:
            query = db.query(RawTranscript.source_id).filter(
                and_(
                    RawTranscript.workspace_id == UUID(workspace_id),
                    RawTranscript.source_type == source_type,
                    RawTranscript.source_id.in_(source_ids)
                )
            )
            existing = query.all()
            return {row[0] for row in existing}

        except Exception as e:
            logger.error(f"Error checking existing transcripts: {e}")
            return set()

    def _get_existing_transcript_title_dates(
        self,
        db: Session,
        workspace_id: str
    ) -> Set[tuple]:
        """
        Get set of (title, date) tuples that already exist in raw_transcripts.
        Used to prevent duplicate transcripts with same name on same day.
        """
        try:
            from sqlalchemy import func, cast, Date

            query = db.query(
                func.lower(func.coalesce(RawTranscript.title, '')),
                cast(func.coalesce(RawTranscript.transcript_date, RawTranscript.created_at), Date)
            ).filter(
                RawTranscript.workspace_id == UUID(workspace_id)
            )
            existing = query.all()
            return {(row[0].strip(), row[1]) for row in existing if row[1]}

        except Exception as e:
            logger.error(f"Error checking existing transcript titles: {e}")
            return set()

    def _prepare_raw_transcript_mapping(
        self,
        transcript: Dict[str, Any],
        workspace_id: str,
        source_type: str
    ) -> Optional[Dict[str, Any]]:
        """Prepare a raw transcript dictionary for bulk_insert_mappings."""
        source_id = transcript.get("source_id")
        if not source_id:
            return None

        now = datetime.now(timezone.utc)

        # Parse transcript_date if provided
        transcript_date = transcript.get("transcript_date")
        if isinstance(transcript_date, str):
            try:
                transcript_date = datetime.fromisoformat(transcript_date.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                transcript_date = now
        elif not isinstance(transcript_date, datetime):
            transcript_date = now

        transcript_id = uuid_module.uuid4()

        mapping = {
            "id": transcript_id,
            "workspace_id": UUID(workspace_id),
            "source_type": source_type,
            "source_id": source_id,
            "raw_data": transcript.get("raw_data", {}),
            "ai_processed": False,
            "retry_count": 0,
            "title": transcript.get("title"),
            "duration_seconds": transcript.get("duration_seconds"),
            "transcript_date": transcript_date,
            "participant_count": transcript.get("participant_count"),
            "created_at": now,
        }

        return mapping

    def _trigger_ai_pipeline(self, workspace_id: str) -> None:
        """
        Legacy method - AI pipeline is now triggered separately via Celery Beat.
        Kept for backward compatibility with messages-based ingestion.
        """
        # No-op: Raw transcript processing is now handled by Celery Beat schedule
        # The process_raw_transcripts task runs every 5 minutes
        pass

    def _get_existing_external_ids(
        self,
        db: Session,
        external_ids: List[str],
        workspace_id: str,
        connector_id: Optional[str],
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

            if connector_id:
                query = query.filter(Message.connector_id == UUID(connector_id))

            existing = query.all()
            return {row[0] for row in existing}

        except Exception as e:
            logger.error(f"Error checking existing messages: {e}")
            return set()

    def _prepare_message_mapping(
        self,
        msg: Dict[str, Any],
        workspace_id: str,
        connector_id: Optional[str],
        source: str,
        db: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Prepare a message dictionary for bulk_insert_mappings.

        Returns None if required fields are missing.
        Generates UUID upfront so it can be tracked for sync history.
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

        # Generate UUID upfront so we can track it for sync history
        message_id = uuid_module.uuid4()

        mapping = {
            "id": message_id,  # Pre-generate ID for tracking
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
            "message_metadata": msg.get("metadata", {}),
            "sent_at": sent_at,
            "created_at": now,
            "updated_at": now,
            "tier1_processed": False,  # Mark for Tier 1 AI processing
            "tier2_processed": False,  # Mark for Tier 2 AI processing
        }

        if connector_id:
            mapping["connector_id"] = UUID(connector_id)

        # Customer extraction: either use provided customer_id or extract from author info
        if msg.get("customer_id"):
            mapping["customer_id"] = UUID(msg["customer_id"])
        elif db and (msg.get("author_email") or msg.get("author_name")):
            # Try to extract customer from author info
            try:
                email, name, domain = customer_extraction_service.extract_customer_info(
                    from_email=msg.get("author_email"),
                    from_name=msg.get("author_name"),
                )
                if email or name:
                    customer_id = customer_extraction_service.find_or_create_customer(
                        db=db,
                        workspace_id=UUID(workspace_id),
                        email=email,
                        name=name,
                        domain=domain,
                    )
                    if customer_id:
                        mapping["customer_id"] = customer_id
            except Exception as e:
                logger.warning(f"Failed to extract customer for message: {e}")

        # Optional customer_ask_id
        if msg.get("customer_ask_id"):
            mapping["customer_ask_id"] = UUID(msg["customer_ask_id"])

        return mapping

    def batch_insert_customer_asks(
        self,
        db: Session,
        customer_asks: List[Dict[str, Any]],
        workspace_id: str,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> Dict[str, int]:
        """
        Batch insert customer_asks with duplicate detection by name + sub_theme.

        Args:
            db: Database session
            customer_asks: List of customer_ask dictionaries
            workspace_id: Workspace UUID string
            batch_size: Number of records per batch

        Returns:
            Dict with counts
        """
        if not customer_asks:
            return {"total": 0, "new_added": 0, "duplicates": 0}

        total = len(customer_asks)
        new_added = 0

        try:
            # Get existing customer_asks by name for duplicate detection
            existing_names = self._get_existing_customer_ask_names(db, workspace_id)

            # Filter and prepare new customer_asks
            customer_ask_mappings = []
            for ask in customer_asks:
                name = ask.get("name", "").strip().lower()
                sub_theme_id = ask.get("sub_theme_id")

                # Simple duplicate check by name (case-insensitive)
                if name and name not in existing_names:
                    mapping = self._prepare_customer_ask_mapping(ask, workspace_id)
                    if mapping:
                        customer_ask_mappings.append(mapping)
                        existing_names.add(name)  # Track for same-batch dedup

            if customer_ask_mappings:
                # Process in batches
                for i in range(0, len(customer_ask_mappings), batch_size):
                    batch = customer_ask_mappings[i:i + batch_size]
                    db.bulk_insert_mappings(CustomerAsk, batch)
                    new_added += len(batch)

                db.commit()

            duplicates = total - new_added
            logger.info(f"Batch customer_ask insert: {new_added} new, {duplicates} duplicates")

        except Exception as e:
            logger.error(f"Error in batch customer_ask insert: {e}")
            db.rollback()
            raise

        return {"total": total, "new_added": new_added, "duplicates": total - new_added}

    def _get_existing_customer_ask_names(self, db: Session, workspace_id: str) -> Set[str]:
        """Get set of existing customer_ask names (lowercase) for workspace."""
        try:
            customer_asks = db.query(CustomerAsk.name).filter(
                CustomerAsk.workspace_id == UUID(workspace_id)
            ).all()
            return {ca[0].strip().lower() for ca in customer_asks if ca[0]}
        except Exception as e:
            logger.error(f"Error getting existing customer_asks: {e}")
            return set()

    def _prepare_customer_ask_mapping(
        self,
        ask: Dict[str, Any],
        workspace_id: str
    ) -> Optional[Dict[str, Any]]:
        """Prepare customer_ask dict for bulk insert."""
        name = ask.get("name")
        sub_theme_id = ask.get("sub_theme_id")

        if not name or not sub_theme_id:
            return None

        now = datetime.now(timezone.utc)

        mapping = {
            "name": name,
            "description": ask.get("description", ""),
            "workspace_id": UUID(workspace_id),
            "sub_theme_id": UUID(sub_theme_id),
            "status": ask.get("status", "new"),
            "urgency": ask.get("urgency", "medium"),
            "mention_count": ask.get("mention_count", 1),
            "first_mentioned_at": ask.get("first_mentioned_at", now),
            "last_mentioned_at": ask.get("last_mentioned_at", now),
            "created_at": now,
            "updated_at": now,
            "ai_metadata": ask.get("ai_metadata", {}),
        }

        return mapping

    def batch_update_tier1_status(
        self,
        db: Session,
        message_ids: List[str],
        tier1_processed: bool = True
    ) -> int:
        """
        Batch update tier1_processed status for messages.

        Args:
            db: Database session
            message_ids: List of message UUID strings
            tier1_processed: New tier1 processed status

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
                    "tier1_processed": tier1_processed,
                    "updated_at": datetime.now(timezone.utc)
                },
                synchronize_session=False
            )
            db.commit()
            logger.info(f"Updated {updated} messages to tier1_processed={tier1_processed}")
            return updated

        except Exception as e:
            logger.error(f"Error updating tier1 processed status: {e}")
            db.rollback()
            return 0

    def batch_update_tier2_status(
        self,
        db: Session,
        message_ids: List[str],
        tier2_processed: bool = True
    ) -> int:
        """
        Batch update tier2_processed status for messages.

        Args:
            db: Database session
            message_ids: List of message UUID strings
            tier2_processed: New tier2 processed status

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
                    "tier2_processed": tier2_processed,
                    "updated_at": datetime.now(timezone.utc)
                },
                synchronize_session=False
            )
            db.commit()
            logger.info(f"Updated {updated} messages to tier2_processed={tier2_processed}")
            return updated

        except Exception as e:
            logger.error(f"Error updating tier2 processed status: {e}")
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
        Get messages pending Tier 1 processing.

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
                    Message.tier1_processed == False
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

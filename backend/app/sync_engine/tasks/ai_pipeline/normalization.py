"""
Normalization Task - State-Driven Execution

Converts source data (Messages) into NormalizedEvents.
This is the first stage of the AI processing pipeline (Tier 1).

State-Driven Model:
- Queries source records where: tier1_processed=False AND no NormalizedEvent exists
- Uses LEFT OUTER JOIN for idempotent duplicate prevention (no row locking needed)
- Creates new NormalizedEvents with processing_stage='normalized'
- Processes ONE message at a time with immediate commit for reliability
- Loops until ALL messages have tier1_processed=True

Idempotency:
- The OUTER JOIN ensures we never create duplicate NormalizedEvents for the same source record
- Safe to run multiple times - will only process records not yet normalized

Note: All sources (Slack, Gmail, Gong, Fathom) are stored in the unified Message table.
Gmail messages are no longer in a separate GmailThread table.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.message import Message
from app.models.normalized_event import NormalizedEvent
from app.services.text_normalization_service import get_text_normalization_service
from app.sync_engine.tasks.base import (
    engine,
    cleanup_after_task,
    test_db_connection,
)

logger = logging.getLogger(__name__)

# Batch size for normalization
NORMALIZATION_BATCH_SIZE = 50


def normalize_message(message: Message, text_normalizer) -> Dict[str, Any]:
    """
    Convert a Message to NormalizedEvent data.

    Works for all source types: slack, gmail, gong, fathom, etc.
    Extra fields (actor info, title, channel) stored in event_metadata JSONB.

    Args:
        message: Message model instance
        text_normalizer: TextNormalizationService instance

    Returns:
        Dict with NormalizedEvent fields
    """
    # Normalize the text content
    normalized = text_normalizer.normalize(
        text=message.content or "",
        source_type=message.source
    )

    # Determine actor role
    actor_role = "external"  # Default to external, safer for feature extraction

    # Build metadata - stores all extra fields
    metadata = {
        # Actor info
        "actor_name": message.author_name,
        "actor_email": message.author_email or message.from_email,
        "actor_role": actor_role,
        # Content context
        "title": message.title,
        "channel_or_label": message.channel_name or message.label_name,
        "channel_id": message.channel_id,
        "thread_id": message.thread_id,
        "label_name": message.label_name,
        # Original metadata
        "original_metadata": message.message_metadata,
        "text_length": normalized.clean_length,
    }

    # Add email-specific fields if present (for Gmail messages)
    if message.source == "gmail":
        metadata.update({
            "from_email": message.from_email,
            "to_emails": message.to_emails,
            "message_count": message.message_count,
        })

    return {
        "workspace_id": message.workspace_id,
        "source_type": message.source,
        "source_id": message.external_id,
        "source_table": "messages",
        "source_record_id": message.id,
        "clean_text": normalized.clean_text,
        "event_timestamp": message.sent_at,
        "event_metadata": metadata,
        "processing_stage": "normalized",  # Ready for chunking
    }


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.normalize_source_data",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=300,  # 5 minute limit
    soft_time_limit=270,
)
def normalize_source_data(
    self,
    workspace_id: Optional[str] = None,
    source_type: Optional[str] = None,
    batch_size: int = NORMALIZATION_BATCH_SIZE  # Kept for API compatibility
) -> Dict[str, Any]:
    """
    Normalize unprocessed source data into NormalizedEvents.

    State-Driven Execution:
    - Finds source records where: tier1_processed=False AND no NormalizedEvent exists
    - Uses LEFT OUTER JOIN for idempotent duplicate prevention
    - Creates NormalizedEvents with processing_stage='normalized'
    - Processes ONE message at a time with immediate commit
    - Safe to run concurrently (duplicate prevention via JOIN, not locking)
    - Loops until ALL messages are processed (tier1_processed=True)

    Args:
        workspace_id: Optional workspace to limit processing
        source_type: Optional source type filter (slack, gmail, gong, fathom)
        batch_size: Deprecated - kept for API compatibility

    Returns:
        Dict with processing stats
    """
    try:
        logger.info(f"📝 Starting normalization task (workspace={workspace_id}, source={source_type})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            text_normalizer = get_text_normalization_service()

            # Process Messages (unified table for all sources)
            message_stats = _normalize_messages(
                db=db,
                workspace_id=workspace_id,
                source_type=source_type,
                batch_size=batch_size,
                text_normalizer=text_normalizer
            )

            total_normalized = message_stats["normalized"]
            total_skipped = message_stats["skipped"]
            total_errors = message_stats["errors"]
            total_duplicates = message_stats.get("duplicates", 0)

            logger.info(
                f"✅ Normalization complete: {total_normalized} normalized, "
                f"{total_skipped} skipped, {total_duplicates} duplicates, {total_errors} errors"
            )

            # Trigger next stage if we normalized any events
            # Signal scoring is deprecated - go directly to chunking
            if total_normalized > 0:
                from app.sync_engine.tasks.ai_pipeline.chunking import chunk_normalized_events
                chunk_normalized_events.delay(workspace_id=workspace_id)
                logger.info("🔗 Triggered chunking stage")

            return {
                "status": "success",
                "total_normalized": total_normalized,
                "total_skipped": total_skipped,
                "total_duplicates": total_duplicates,
                "total_errors": total_errors,
            }

    except Exception as e:
        logger.error(f"❌ Normalization task failed: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=120)
    finally:
        cleanup_after_task()


def _normalize_messages(
    db: Session,
    workspace_id: Optional[str],
    source_type: Optional[str],
    batch_size: int,  # Kept for API compatibility but not used
    text_normalizer
) -> Dict[str, int]:
    """
    Normalize Message records one at a time until all are processed.

    Uses LEFT OUTER JOIN to find messages without NormalizedEvents (idempotent).
    Handles all source types: slack, gmail, gong, fathom.
    Processes ONE message at a time with immediate commit for reliability.

    Each message is processed independently - only exact duplicates (same external_id)
    are skipped to ensure all messages pass through Tier 1 classification.
    """
    total_normalized = 0
    total_skipped = 0
    total_errors = 0
    total_duplicates = 0
    message_count = 0

    # Process messages one at a time
    while True:
        # Build query for ONE unprocessed message that doesn't have normalized event yet
        query = db.query(Message).filter(
            Message.tier1_processed == False
        ).outerjoin(
            NormalizedEvent,
            and_(
                NormalizedEvent.source_table == "messages",
                NormalizedEvent.source_record_id == Message.id
            )
        ).filter(
            NormalizedEvent.id == None  # Not yet normalized (idempotent check)
        )

        if workspace_id:
            query = query.filter(Message.workspace_id == UUID(workspace_id))

        if source_type:
            query = query.filter(Message.source == source_type)

        # Get ONE message at a time
        message = query.order_by(Message.sent_at.asc()).first()

        if not message:
            if message_count == 0:
                logger.info("No messages to normalize")
            else:
                logger.info(f"✅ Normalization complete: processed {message_count} messages")
            break

        message_count += 1

        try:
            # Only skip truly empty messages - ALL other messages pass to Tier 1
            if not message.content or len(message.content.strip()) == 0:
                total_skipped += 1
                message.tier1_processed = True
                message.feature_score = 0.0
                db.commit()
                logger.debug(f"Skipped empty message {message.id}")
                continue

            # DUPLICATE CHECK: Check if message with same external_id already processed
            if _is_duplicate_message(db, message):
                logger.debug(
                    f"Skipping duplicate message {message.id} "
                    f"(external_id={message.external_id})"
                )
                message.tier1_processed = True
                message.feature_score = 0.0
                db.commit()
                total_duplicates += 1
                continue

            # Normalize the message
            event_data = normalize_message(message, text_normalizer)

            # Create NormalizedEvent
            normalized_event = NormalizedEvent(**event_data)
            db.add(normalized_event)
            db.commit()

            total_normalized += 1
            logger.info(f"📝 Normalized message {message_count}: {message.id} ({message.source})")

        except Exception as e:
            logger.error(f"Error normalizing message {message.id}: {e}")
            db.rollback()
            # Mark as processed to avoid infinite loop on error
            message.tier1_processed = True
            message.feature_score = 0.0
            db.commit()
            total_errors += 1

    if total_duplicates > 0:
        logger.info(f"Total: Skipped {total_duplicates} duplicate messages based on external_id")

    return {
        "normalized": total_normalized,
        "skipped": total_skipped,
        "errors": total_errors,
        "duplicates": total_duplicates
    }


def _is_duplicate_message(db: Session, message: Message) -> bool:
    """
    Check if a message is a duplicate based on external_id only.

    This prevents re-processing of the exact same message record that was
    already processed (same external_id = same message from source).

    Note: Thread-based duplicate detection removed to ensure each message
    in a Gmail/Slack thread is processed separately for Tier 1 classification.

    Args:
        db: Database session
        message: Message to check

    Returns:
        True if this message is a duplicate of an already-processed message
    """
    # Only check external_id - the exact same message from the source
    if message.external_id:
        existing_by_external_id = db.query(NormalizedEvent).filter(
            and_(
                NormalizedEvent.source_id == message.external_id,
                NormalizedEvent.workspace_id == message.workspace_id,
                NormalizedEvent.source_table == "messages",
                NormalizedEvent.source_record_id != message.id  # Different message record
            )
        ).first()

        if existing_by_external_id:
            logger.debug(f"Found existing NormalizedEvent with external_id={message.external_id}")
            return True

    # REMOVED: Thread-based duplicate check
    # Each message in a Gmail/Slack thread is now processed independently
    # to ensure ALL messages pass through Tier 1 classification

    return False

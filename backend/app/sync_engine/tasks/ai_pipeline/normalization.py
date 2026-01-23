"""
Normalization Task - State-Driven Execution

Converts source data (Messages) into NormalizedEvents.
This is the first stage of the AI processing pipeline.

State-Driven Model:
- Queries source records where: is_processed=False AND no NormalizedEvent exists
- Uses LEFT OUTER JOIN for idempotent duplicate prevention (no row locking needed)
- Creates new NormalizedEvents with processing_stage='pending'
- Does NOT use row locking since it creates new records rather than updating existing ones

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
    batch_size: int = NORMALIZATION_BATCH_SIZE
) -> Dict[str, Any]:
    """
    Normalize unprocessed source data into NormalizedEvents.

    State-Driven Execution:
    - Finds source records where: is_processed=False AND no NormalizedEvent exists
    - Uses LEFT OUTER JOIN for idempotent duplicate prevention
    - Creates NormalizedEvents with processing_stage='pending'
    - Safe to run concurrently (duplicate prevention via JOIN, not locking)

    Args:
        workspace_id: Optional workspace to limit processing
        source_type: Optional source type filter (slack, gmail, gong, fathom)
        batch_size: Number of records to process per batch

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
    batch_size: int,
    text_normalizer
) -> Dict[str, int]:
    """
    Normalize Message records.

    Uses LEFT OUTER JOIN to find messages without NormalizedEvents (idempotent).
    Handles all source types: slack, gmail, gong, fathom.

    IMPORTANT: Also checks for duplicate messages based on thread_id and external_id
    to prevent re-processing of existing content (especially for Gmail threads).
    """
    normalized_count = 0
    skipped_count = 0
    error_count = 0
    duplicate_count = 0

    # Build query for unprocessed messages that don't have normalized events yet
    # This LEFT OUTER JOIN pattern provides idempotent duplicate prevention
    query = db.query(Message).filter(
        Message.is_processed == False
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

    messages = query.order_by(Message.sent_at.asc()).limit(batch_size).all()

    if not messages:
        logger.info("No messages to normalize")
        return {"normalized": 0, "skipped": 0, "errors": 0, "duplicates": 0}

    logger.info(f"Found {len(messages)} messages to normalize")

    for message in messages:
        try:
            # Skip if content is too short
            if not message.content or len(message.content.strip()) < 20:
                skipped_count += 1
                continue

            # DUPLICATE CHECK: Check if a message with the same thread_id or external_id
            # has already been processed in the AI pipeline (has NormalizedEvent)
            if _is_duplicate_message(db, message):
                logger.info(
                    f"Skipping duplicate message {message.id} "
                    f"(thread_id={message.thread_id}, external_id={message.external_id})"
                )
                # Mark message as processed to avoid re-checking it
                message.is_processed = True
                duplicate_count += 1
                continue

            # Normalize
            event_data = normalize_message(message, text_normalizer)

            # Create NormalizedEvent
            normalized_event = NormalizedEvent(**event_data)
            db.add(normalized_event)
            normalized_count += 1

        except Exception as e:
            logger.error(f"Error normalizing message {message.id}: {e}")
            error_count += 1
            continue

    db.commit()

    if duplicate_count > 0:
        logger.info(f"Skipped {duplicate_count} duplicate messages based on thread_id/external_id")

    return {"normalized": normalized_count, "skipped": skipped_count, "errors": error_count, "duplicates": duplicate_count}


def _is_duplicate_message(db: Session, message: Message) -> bool:
    """
    Check if a message is a duplicate based on thread_id and external_id.

    This prevents re-processing of messages that share the same thread_id or external_id
    with already processed messages (especially important for Gmail threads where
    the same thread might be fetched multiple times).

    Args:
        db: Database session
        message: Message to check

    Returns:
        True if this message is a duplicate of an already-processed message
    """
    # Check 1: Same external_id within same workspace and connector (different message ID)
    # This catches re-fetched messages from the same source
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

    # Check 2: Same thread_id within same workspace (for Gmail threads and Slack threads)
    # This catches cases where the same thread content was ingested under different message IDs
    if message.thread_id and message.source in ("gmail", "slack"):
        # For Gmail: thread_id represents the Gmail thread ID
        # For Slack: thread_id represents the thread_ts
        existing_by_thread = db.query(Message).join(
            NormalizedEvent,
            and_(
                NormalizedEvent.source_table == "messages",
                NormalizedEvent.source_record_id == Message.id
            )
        ).filter(
            and_(
                Message.thread_id == message.thread_id,
                Message.workspace_id == message.workspace_id,
                Message.connector_id == message.connector_id,  # Same connector
                Message.id != message.id  # Different message record
            )
        ).first()

        if existing_by_thread:
            logger.debug(f"Found existing processed message with thread_id={message.thread_id}")
            return True

    return False

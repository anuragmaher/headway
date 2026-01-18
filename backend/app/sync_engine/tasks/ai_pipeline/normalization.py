"""
Normalization Task - State-Driven Execution

Converts source data (Messages, GmailThreads) into NormalizedEvents.
This is the first stage of the AI processing pipeline.

State-Driven Model:
- Queries source records where: is_processed=False AND no NormalizedEvent exists
- Uses LEFT OUTER JOIN for idempotent duplicate prevention (no row locking needed)
- Creates new NormalizedEvents with processing_stage='pending'
- Does NOT use row locking since it creates new records rather than updating existing ones

Idempotency:
- The OUTER JOIN ensures we never create duplicate NormalizedEvents for the same source record
- Safe to run multiple times - will only process records not yet normalized
"""

import logging
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.message import Message
from app.models.gmail import GmailThread
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
    actor_role = "unknown"
    if message.author_email:
        # Simple heuristic: if email matches company domain, it's internal
        # This would need to be enhanced with actual workspace domain checking
        actor_role = "external"  # Default to external, safer for feature extraction

    # Build metadata
    metadata = {
        "original_metadata": message.message_metadata,
        "channel_id": message.channel_id,
        "thread_id": message.thread_id,
        "is_thread_reply": message.is_thread_reply,
        "normalization_stats": normalized.removed_elements,
    }

    return {
        "workspace_id": message.workspace_id,
        "source_type": message.source,
        "source_id": message.external_id,
        "source_table": "messages",
        "source_record_id": message.id,
        "clean_text": normalized.clean_text,
        "text_length": normalized.clean_length,
        "actor_name": message.author_name,
        "actor_email": message.author_email,
        "actor_role": actor_role,
        "title": message.title,
        "event_timestamp": message.sent_at,
        "channel_or_label": message.channel_name,
        "event_metadata": metadata,
        "processing_stage": "pending",
    }


def normalize_gmail_thread(thread: GmailThread, text_normalizer) -> Dict[str, Any]:
    """
    Convert a GmailThread to NormalizedEvent data.

    Args:
        thread: GmailThread model instance
        text_normalizer: TextNormalizationService instance

    Returns:
        Dict with NormalizedEvent fields
    """
    # Normalize the text content
    normalized = text_normalizer.normalize(
        text=thread.content or "",
        source_type="gmail"
    )

    # Build metadata
    metadata = {
        "gmail_thread_id": thread.thread_id,
        "label_id": thread.label_id,
        "message_count": thread.message_count,
        "to_emails": thread.to_emails,
        "normalization_stats": normalized.removed_elements,
    }

    return {
        "workspace_id": thread.workspace_id,
        "source_type": "gmail",
        "source_id": thread.thread_id,
        "source_table": "gmail_threads",
        "source_record_id": thread.id,
        "clean_text": normalized.clean_text,
        "text_length": normalized.clean_length,
        "actor_name": thread.from_name,
        "actor_email": thread.from_email,
        "actor_role": "external",  # Gmail typically external
        "title": thread.subject,
        "event_timestamp": thread.thread_date,
        "channel_or_label": thread.label_name,
        "event_metadata": metadata,
        "processing_stage": "pending",
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

            total_normalized = 0
            total_skipped = 0
            total_errors = 0

            # Process Messages
            if source_type is None or source_type != "gmail":
                message_stats = _normalize_messages(
                    db=db,
                    workspace_id=workspace_id,
                    source_type=source_type,
                    batch_size=batch_size,
                    text_normalizer=text_normalizer
                )
                total_normalized += message_stats["normalized"]
                total_skipped += message_stats["skipped"]
                total_errors += message_stats["errors"]

            # Process GmailThreads
            if source_type is None or source_type == "gmail":
                gmail_stats = _normalize_gmail_threads(
                    db=db,
                    workspace_id=workspace_id,
                    batch_size=batch_size,
                    text_normalizer=text_normalizer
                )
                total_normalized += gmail_stats["normalized"]
                total_skipped += gmail_stats["skipped"]
                total_errors += gmail_stats["errors"]

            logger.info(
                f"✅ Normalization complete: {total_normalized} normalized, "
                f"{total_skipped} skipped, {total_errors} errors"
            )

            # Trigger next stage if we normalized any events
            if total_normalized > 0:
                from app.sync_engine.tasks.ai_pipeline.signal_scoring import score_normalized_events
                score_normalized_events.delay(workspace_id=workspace_id)
                logger.info("🔗 Triggered signal scoring stage")

            return {
                "status": "success",
                "total_normalized": total_normalized,
                "total_skipped": total_skipped,
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
    """
    normalized_count = 0
    skipped_count = 0
    error_count = 0

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
        return {"normalized": 0, "skipped": 0, "errors": 0}

    logger.info(f"Found {len(messages)} messages to normalize")

    for message in messages:
        try:
            # Skip if content is too short
            if not message.content or len(message.content.strip()) < 20:
                skipped_count += 1
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

    return {"normalized": normalized_count, "skipped": skipped_count, "errors": error_count}


def _normalize_gmail_threads(
    db: Session,
    workspace_id: Optional[str],
    batch_size: int,
    text_normalizer
) -> Dict[str, int]:
    """
    Normalize GmailThread records.

    Uses LEFT OUTER JOIN to find threads without NormalizedEvents (idempotent).
    """
    normalized_count = 0
    skipped_count = 0
    error_count = 0

    # Build query for unprocessed threads that don't have normalized events yet
    # This LEFT OUTER JOIN pattern provides idempotent duplicate prevention
    query = db.query(GmailThread).filter(
        GmailThread.is_processed == False
    ).outerjoin(
        NormalizedEvent,
        and_(
            NormalizedEvent.source_table == "gmail_threads",
            NormalizedEvent.source_record_id == GmailThread.id
        )
    ).filter(
        NormalizedEvent.id == None  # Not yet normalized (idempotent check)
    )

    if workspace_id:
        query = query.filter(GmailThread.workspace_id == UUID(workspace_id))

    threads = query.order_by(GmailThread.thread_date.asc()).limit(batch_size).all()

    if not threads:
        logger.info("No Gmail threads to normalize")
        return {"normalized": 0, "skipped": 0, "errors": 0}

    logger.info(f"Found {len(threads)} Gmail threads to normalize")

    for thread in threads:
        try:
            # Skip if content is too short
            if not thread.content or len(thread.content.strip()) < 50:
                skipped_count += 1
                continue

            # Normalize
            event_data = normalize_gmail_thread(thread, text_normalizer)

            # Create NormalizedEvent
            normalized_event = NormalizedEvent(**event_data)
            db.add(normalized_event)
            normalized_count += 1

        except Exception as e:
            logger.error(f"Error normalizing Gmail thread {thread.id}: {e}")
            error_count += 1
            continue

    db.commit()

    return {"normalized": normalized_count, "skipped": skipped_count, "errors": error_count}

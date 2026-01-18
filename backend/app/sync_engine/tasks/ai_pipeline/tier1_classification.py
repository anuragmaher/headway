"""
Tier-1 AI Classification Task - State-Driven Execution

Low-cost AI classification to determine if content contains feature requests.
This is a binary classification with confidence score - no extraction yet.

State-Driven Model:
- For NormalizedEvents: processing_stage='chunked' AND classified_at IS NULL AND is_chunked=False
- For EventChunks: processing_stage='pending' AND classified_at IS NULL
- Uses row-level locking to prevent duplicate processing
- Sets classified_at timestamp on completion for idempotent execution
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.normalized_event import NormalizedEvent, EventChunk
from app.services.tiered_ai_service import get_tiered_ai_service
from app.sync_engine.tasks.base import (
    engine,
    cleanup_after_task,
    test_db_connection,
)
from app.sync_engine.tasks.ai_pipeline.locking import (
    acquire_rows_for_processing,
    mark_row_processed,
    mark_row_error,
)

logger = logging.getLogger(__name__)

# Batch size for classification
CLASSIFICATION_BATCH_SIZE = 20

# Minimum confidence to proceed to extraction
MIN_CLASSIFICATION_CONFIDENCE = 0.6

# Max retries before giving up on a row
MAX_RETRIES = 3


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.classify_events",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=600,  # 10 minute limit (AI calls involved)
    soft_time_limit=540,
)
def classify_events(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = CLASSIFICATION_BATCH_SIZE,
    min_confidence: float = MIN_CLASSIFICATION_CONFIDENCE,
) -> Dict[str, Any]:
    """
    Classify chunked events using Tier-1 AI.

    State-Driven Execution:
    - For non-chunked events: processing_stage='chunked' AND classified_at IS NULL AND is_chunked=False
    - For chunks: processing_stage='pending' AND classified_at IS NULL
    - Acquires row-level locks to prevent race conditions
    - Sets classified_at timestamp on completion (idempotent marker)

    Args:
        workspace_id: Optional workspace to limit processing
        batch_size: Number of records to process per batch
        min_confidence: Minimum confidence to proceed to extraction

    Returns:
        Dict with processing stats
    """
    import uuid as uuid_module
    lock_token = uuid_module.uuid4()

    try:
        logger.info(f"🔍 Starting Tier-1 classification task (workspace={workspace_id}, lock={lock_token})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            ai_service = get_tiered_ai_service()

            total_classified = 0
            total_relevant = 0
            total_skipped = 0
            total_errors = 0

            # Process non-chunked events first
            non_chunked_stats = _classify_non_chunked_events(
                db, ai_service, workspace_id, batch_size // 2, min_confidence, lock_token
            )
            total_classified += non_chunked_stats["classified"]
            total_relevant += non_chunked_stats["relevant"]
            total_skipped += non_chunked_stats["skipped"]
            total_errors += non_chunked_stats["errors"]

            # Process chunks
            chunk_stats = _classify_chunks(
                db, ai_service, workspace_id, batch_size // 2, min_confidence, lock_token
            )
            total_classified += chunk_stats["classified"]
            total_relevant += chunk_stats["relevant"]
            total_skipped += chunk_stats["skipped"]
            total_errors += chunk_stats["errors"]

            db.commit()

            # Log early return if nothing to process
            if total_classified == 0:
                logger.info("✅ Tier-1 classification: No items to classify (all already processed)")
                return {
                    "status": "success",
                    "total_classified": 0,
                    "total_relevant": 0,
                    "total_skipped": 0,
                    "total_errors": 0,
                }

            logger.info(
                f"✅ Tier-1 classification complete: {total_classified} classified, "
                f"{total_relevant} feature-relevant, {total_skipped} skipped, {total_errors} errors"
            )

            # Trigger next stage if we found any relevant content
            if total_relevant > 0:
                from app.sync_engine.tasks.ai_pipeline.tier2_extraction import extract_features
                extract_features.delay(workspace_id=workspace_id)
                logger.info("🔗 Triggered extraction stage")

            return {
                "status": "success",
                "total_classified": total_classified,
                "total_relevant": total_relevant,
                "total_skipped": total_skipped,
                "total_errors": total_errors,
            }

    except Exception as e:
        logger.error(f"❌ Tier-1 classification task failed: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=120)
    finally:
        cleanup_after_task()


def _classify_non_chunked_events(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    min_confidence: float,
    lock_token,
) -> Dict[str, int]:
    """
    Classify events that weren't chunked (small enough to process directly).

    State-Driven filter:
    - processing_stage='chunked' (ready for classification)
    - classified_at IS NULL (not yet classified - idempotent)
    - is_chunked=False (doesn't have chunks)
    - skip_ai_processing=False (passed signal scoring)
    """
    import uuid as uuid_module
    stats = {"classified": 0, "relevant": 0, "skipped": 0, "errors": 0}

    # Build state-driven filter conditions
    filter_conditions = [
        NormalizedEvent.processing_stage == "chunked",
        NormalizedEvent.classified_at.is_(None),
        NormalizedEvent.is_chunked == False,
        NormalizedEvent.skip_ai_processing == False,
        NormalizedEvent.retry_count < MAX_RETRIES,
    ]

    if workspace_id:
        filter_conditions.append(
            NormalizedEvent.workspace_id == UUID(workspace_id)
        )

    # Acquire rows with row-level locking
    events = acquire_rows_for_processing(
        db=db,
        model=NormalizedEvent,
        filter_conditions=filter_conditions,
        order_by=NormalizedEvent.created_at.asc(),
        batch_size=batch_size,
        lock_token=lock_token,
    )

    if not events:
        logger.info("No non-chunked events to classify")
        return stats

    logger.info(f"Acquired {len(events)} non-chunked events for classification")

    for event in events:
        try:
            # Call Tier-1 AI classification
            result = ai_service.tier1_classify(
                text=event.clean_text,
                source_type=event.source_type,
                actor_role=event.actor_role,
            )

            # Update event with classification results
            event.is_feature_relevant = result.is_feature_relevant
            event.classification_confidence = result.confidence
            event.classification_timestamp = datetime.now(timezone.utc)

            # Determine next stage
            if result.is_feature_relevant and result.confidence >= min_confidence:
                # Mark as classified with state-driven timestamp
                mark_row_processed(
                    row=event,
                    stage="classified",
                    timestamp_field="classified_at",
                    lock_token=lock_token,
                )
                stats["relevant"] += 1
            else:
                # Skip extraction for non-relevant or low-confidence
                event.skip_ai_processing = True
                mark_row_processed(
                    row=event,
                    stage="completed",
                    timestamp_field="classified_at",
                    lock_token=lock_token,
                )
                stats["skipped"] += 1

            stats["classified"] += 1

        except Exception as e:
            logger.error(f"Error classifying event {event.id}: {e}")
            mark_row_error(
                row=event,
                error_message=f"Classification error: {str(e)[:400]}",
                lock_token=lock_token,
                increment_retry=True,
            )
            stats["errors"] += 1

    return stats


def _classify_chunks(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    min_confidence: float,
    lock_token,
) -> Dict[str, int]:
    """
    Classify event chunks.

    State-Driven filter:
    - processing_stage='pending' (ready for classification)
    - classified_at IS NULL (not yet classified - idempotent)
    - skip_extraction=False (not marked to skip)
    """
    import uuid as uuid_module
    stats = {"classified": 0, "relevant": 0, "skipped": 0, "errors": 0}

    # Build state-driven filter conditions
    filter_conditions = [
        EventChunk.processing_stage == "pending",
        EventChunk.classified_at.is_(None),
        EventChunk.skip_extraction == False,
        EventChunk.retry_count < MAX_RETRIES,
    ]

    if workspace_id:
        filter_conditions.append(
            EventChunk.workspace_id == UUID(workspace_id)
        )

    # Acquire rows with row-level locking
    chunks = acquire_rows_for_processing(
        db=db,
        model=EventChunk,
        filter_conditions=filter_conditions,
        order_by=EventChunk.created_at.asc(),
        batch_size=batch_size,
        lock_token=lock_token,
    )

    if not chunks:
        logger.info("No chunks to classify")
        return stats

    logger.info(f"Acquired {len(chunks)} chunks for classification")

    for chunk in chunks:
        try:
            # Get parent event for context
            parent_event = chunk.normalized_event

            # Call Tier-1 AI classification
            result = ai_service.tier1_classify(
                text=chunk.chunk_text,
                source_type=parent_event.source_type if parent_event else "unknown",
                actor_role=parent_event.actor_role if parent_event else None,
            )

            # Update chunk with classification results
            chunk.is_feature_relevant = result.is_feature_relevant
            chunk.classification_confidence = result.confidence
            chunk.classification_timestamp = datetime.now(timezone.utc)

            # Determine next stage
            if result.is_feature_relevant and result.confidence >= min_confidence:
                mark_row_processed(
                    row=chunk,
                    stage="classified",
                    timestamp_field="classified_at",
                    lock_token=lock_token,
                )
                stats["relevant"] += 1
            else:
                # Skip extraction for non-relevant or low-confidence
                chunk.skip_extraction = True
                mark_row_processed(
                    row=chunk,
                    stage="completed",
                    timestamp_field="classified_at",
                    lock_token=lock_token,
                )
                stats["skipped"] += 1

            stats["classified"] += 1

        except Exception as e:
            logger.error(f"Error classifying chunk {chunk.id}: {e}")
            mark_row_error(
                row=chunk,
                error_message=f"Classification error: {str(e)[:400]}",
                lock_token=lock_token,
                increment_retry=True,
            )
            stats["errors"] += 1

    # Update parent events that have all chunks classified
    _update_parent_events_after_classification(db, workspace_id)

    return stats


def _update_parent_events_after_classification(
    db: Session,
    workspace_id: Optional[str],
) -> None:
    """
    Update parent events when all their chunks are classified.

    This aggregates chunk classification results to the parent event level.
    """
    # Find chunked events that are still in 'chunked' stage
    query = db.query(NormalizedEvent).filter(
        NormalizedEvent.processing_stage == "chunked",
        NormalizedEvent.is_chunked == True,
    )

    if workspace_id:
        query = query.filter(NormalizedEvent.workspace_id == UUID(workspace_id))

    events = query.all()

    for event in events:
        # Check if all chunks are processed (not pending)
        pending_chunks = db.query(EventChunk).filter(
            EventChunk.normalized_event_id == event.id,
            EventChunk.processing_stage == "pending",
        ).count()

        if pending_chunks == 0:
            # All chunks processed, check if any are relevant
            relevant_chunks = db.query(EventChunk).filter(
                EventChunk.normalized_event_id == event.id,
                EventChunk.is_feature_relevant == True,
            ).count()

            now = datetime.now(timezone.utc)

            if relevant_chunks > 0:
                event.is_feature_relevant = True
                event.processing_stage = "classified"
            else:
                event.is_feature_relevant = False
                event.processing_stage = "completed"

            # Set overall confidence as max of chunk confidences
            max_confidence = db.query(EventChunk.classification_confidence).filter(
                EventChunk.normalized_event_id == event.id,
            ).order_by(EventChunk.classification_confidence.desc()).first()

            if max_confidence:
                event.classification_confidence = max_confidence[0]

            event.classification_timestamp = now
            event.classified_at = now
            event.updated_at = now

"""
Tier-1 AI Classification Task - THE ONLY FILTER POINT

Low-cost AI classification to determine if content contains feature requests.
This is a binary classification with confidence score - no extraction yet.

This is the ONLY place messages are filtered out:
- Score >= 6.0 proceeds to Tier-2 extraction (ALL further processing)
- Score < 6.0 stops processing (marked as completed)

No locking needed since we run a single worker.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import UUID

from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.normalized_event import NormalizedEvent, EventChunk
from app.models.message import Message
from app.services.tiered_ai_service import get_tiered_ai_service
from app.sync_engine.tasks.base import (
    engine,
    cleanup_after_task,
    test_db_connection,
)

logger = logging.getLogger(__name__)

# Batch size for classification
CLASSIFICATION_BATCH_SIZE = 20

# Minimum score to proceed to extraction (0-10 scale)
# Score >= 6 means likely contains feature request/feedback
MIN_CLASSIFICATION_SCORE = 6.0

# Max retries before giving up on a row
MAX_RETRIES = 3

# Maximum items to process per task invocation (prevents long-running tasks)
MAX_ITEMS_PER_RUN = 50

# Maximum message length to classify (skip oversized messages)
MAX_MESSAGE_LENGTH = 50000  # 50KB


# ============================================================================
# RECOVERY FUNCTIONS - Handle orphaned and exhausted items
# ============================================================================

def _process_orphaned_messages(db: Session, workspace_id: Optional[str]) -> int:
    """
    Find messages that have classified NormalizedEvents but still have tier1_processed=false.
    This happens when classification completed but the message wasn't updated.

    For each orphaned message, copy the score from its NormalizedEvent and mark tier1_processed=true.

    Returns:
        Count of orphaned messages fixed
    """
    # Find messages with tier1_processed=false that have CLASSIFIED NormalizedEvents
    from sqlalchemy import and_

    subquery = db.query(NormalizedEvent.source_record_id).filter(
        NormalizedEvent.source_table == "messages",
        NormalizedEvent.classified_at.isnot(None),  # Already classified
    ).subquery()

    query = db.query(Message).filter(
        Message.tier1_processed == False,
        Message.id.in_(subquery),
    )

    if workspace_id:
        query = query.filter(Message.workspace_id == UUID(workspace_id))

    messages = query.all()
    count = 0

    for message in messages:
        # Get the NormalizedEvent for this message
        event = db.query(NormalizedEvent).filter(
            NormalizedEvent.source_table == "messages",
            NormalizedEvent.source_record_id == message.id,
        ).first()

        if event and event.classified_at:
            # Copy score from event to message
            score = (event.classification_confidence or 0) * 10.0
            message.tier1_processed = True
            message.feature_score = score
            message.processed_at = event.classified_at

            logger.info(
                f"✓ Fixed orphaned message {message.id}: "
                f"tier1_processed=True, feature_score={score:.1f}"
            )
            db.commit()
            count += 1

    return count


def _process_exhausted_events(db: Session, workspace_id: Optional[str]) -> int:
    """
    Mark events that exhausted retries as completed and update their source messages.
    This prevents items with retry_count >= MAX_RETRIES from blocking the pipeline.

    Returns:
        Count of exhausted events processed
    """
    query = db.query(NormalizedEvent).filter(
        NormalizedEvent.processing_stage == "chunked",
        NormalizedEvent.classified_at.is_(None),
        NormalizedEvent.retry_count >= MAX_RETRIES,
    )

    if workspace_id:
        query = query.filter(NormalizedEvent.workspace_id == UUID(workspace_id))

    events = query.all()
    count = 0

    for event in events:
        now = datetime.now(timezone.utc)

        event.is_feature_relevant = False
        event.processing_stage = "completed"
        event.classification_confidence = 0.0
        event.classified_at = now

        # CRITICAL: Mark source message as processed
        if event.source_table == "messages" and event.source_record_id:
            message = db.query(Message).filter(
                Message.id == event.source_record_id
            ).first()
            if message and not message.tier1_processed:
                message.tier1_processed = True
                message.feature_score = 0.0
                message.processed_at = now
                logger.warning(
                    f"⚠️ Event {event.id} exhausted retries, marking message {message.id} "
                    f"tier1_processed=True, feature_score=0.0"
                )

        db.commit()
        count += 1

    return count


def _process_exhausted_chunks(db: Session, workspace_id: Optional[str]) -> int:
    """
    Mark chunks that exhausted retries as completed.
    This allows parent events to be updated even if some chunks failed.

    Returns:
        Count of exhausted chunks processed
    """
    query = db.query(EventChunk).filter(
        EventChunk.processing_stage == "pending",
        EventChunk.classified_at.is_(None),
        EventChunk.retry_count >= MAX_RETRIES,
    )

    if workspace_id:
        query = query.filter(EventChunk.workspace_id == UUID(workspace_id))

    chunks = query.all()
    count = 0

    for chunk in chunks:
        now = datetime.now(timezone.utc)

        chunk.is_feature_relevant = False
        chunk.processing_stage = "completed"
        chunk.classification_confidence = 0.0
        chunk.classified_at = now

        logger.warning(f"⚠️ Chunk {chunk.id} exhausted retries, marking as completed")
        db.commit()
        count += 1

    return count


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
    min_score: float = MIN_CLASSIFICATION_SCORE,
) -> Dict[str, Any]:
    """
    Classify ALL chunked events using Tier-1 AI.

    Processes events in batches, triggering Tier-2 after each batch to ensure
    progress even if task times out. Re-queues itself if MAX_ITEMS_PER_RUN reached.

    THIS IS THE ONLY FILTER POINT:
    - Score >= 6 proceeds to Tier-2 extraction (all further processing happens)
    - Score < 6 stops here (marked completed)

    Args:
        workspace_id: Optional workspace to limit processing
        batch_size: Number of records to process per batch
        min_score: Minimum score (0-10) to proceed to extraction (default: 6)

    Returns:
        Dict with processing stats
    """
    tier2_triggered = False
    total_classified = 0
    total_relevant = 0
    total_skipped = 0
    total_errors = 0
    timed_out = False

    try:
        logger.info(f"🔍 Starting Tier-1 classification task (workspace={workspace_id})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            # ============================================================
            # PHASE 0: RECOVERY - Fix orphaned and exhausted items
            # ============================================================

            # Fix orphaned messages (have classified NormalizedEvent but tier1_processed=false)
            orphaned_count = _process_orphaned_messages(db, workspace_id)
            if orphaned_count > 0:
                logger.info(f"📊 Fixed {orphaned_count} orphaned messages")

            # Handle exhausted events and chunks
            exhausted_events = _process_exhausted_events(db, workspace_id)
            exhausted_chunks = _process_exhausted_chunks(db, workspace_id)
            if exhausted_events > 0 or exhausted_chunks > 0:
                logger.info(
                    f"📊 Processed {exhausted_events} exhausted events, "
                    f"{exhausted_chunks} exhausted chunks"
                )

            # Update parent events (handles chunks that exhausted retries)
            _update_parent_events_after_classification(db, workspace_id)

            # ============================================================
            # DIAGNOSTIC LOGGING
            # ============================================================
            pending_messages = db.query(Message).filter(
                Message.tier1_processed == False
            )
            if workspace_id:
                pending_messages = pending_messages.filter(
                    Message.workspace_id == UUID(workspace_id)
                )
            pending_count = pending_messages.count()
            logger.info(f"📊 Tier 1 Start: {pending_count} messages with tier1_processed=false")

            # Log NormalizedEvents in each stage
            for stage in ["normalized", "chunked", "classified", "completed", "extracted"]:
                stage_query = db.query(NormalizedEvent).filter(
                    NormalizedEvent.processing_stage == stage
                )
                if workspace_id:
                    stage_query = stage_query.filter(
                        NormalizedEvent.workspace_id == UUID(workspace_id)
                    )
                count = stage_query.count()
                if count > 0:
                    logger.info(f"   - {stage}: {count} events")

            # ============================================================
            # PHASE 1: CLASSIFICATION LOOP
            # ============================================================

            ai_service = get_tiered_ai_service()

            # LOOP until ALL events and chunks are classified or limits reached
            while True:
                try:
                    # Process non-chunked events
                    non_chunked_stats = _classify_non_chunked_events(
                        db, ai_service, workspace_id, batch_size, min_score
                    )

                    # Process chunks
                    chunk_stats = _classify_chunks(
                        db, ai_service, workspace_id, batch_size, min_score
                    )

                    # Accumulate stats for this batch
                    batch_classified = non_chunked_stats["classified"] + chunk_stats["classified"]
                    batch_relevant = non_chunked_stats["relevant"] + chunk_stats["relevant"]
                    total_classified += batch_classified
                    total_relevant += batch_relevant
                    total_skipped += non_chunked_stats["skipped"] + chunk_stats["skipped"]
                    total_errors += non_chunked_stats["errors"] + chunk_stats["errors"]

                    # CRITICAL: Trigger Tier-2 after EACH batch that found relevant items
                    # This ensures progress even if task times out later
                    if batch_relevant > 0 and not tier2_triggered:
                        from app.sync_engine.tasks.ai_pipeline.tier2_extraction import extract_features
                        extract_features.delay(workspace_id=workspace_id)
                        tier2_triggered = True
                        logger.info("🔗 Triggered Tier-2 extraction (batch had relevant items)")

                    # Exit loop when no more items to classify
                    if batch_classified == 0:
                        logger.info("✅ Tier-1 loop complete: No more items to classify")
                        break

                    logger.info(f"📊 Tier-1 batch: {batch_classified} classified, continuing loop...")

                    # Safety valve: Re-queue if we've processed too many items
                    if total_classified >= MAX_ITEMS_PER_RUN:
                        logger.info(
                            f"📊 Processed {total_classified} items (limit: {MAX_ITEMS_PER_RUN}), "
                            "re-queuing for more"
                        )
                        classify_events.delay(workspace_id=workspace_id)
                        break

                except SoftTimeLimitExceeded:
                    logger.warning(
                        f"⏰ Soft timeout reached after {total_classified} items, "
                        "saving progress and exiting"
                    )
                    timed_out = True
                    # Re-queue to continue processing remaining items
                    classify_events.delay(workspace_id=workspace_id)
                    break

            # Log final results
            if total_classified == 0 and not timed_out:
                logger.info("✅ Tier-1 classification: No items to classify (all already processed)")
                return {
                    "status": "success",
                    "total_classified": 0,
                    "total_relevant": 0,
                    "total_skipped": 0,
                    "total_errors": 0,
                }

            status = "timeout" if timed_out else "success"
            logger.info(
                f"✅ Tier-1 classification complete: {total_classified} classified, "
                f"{total_relevant} feature-relevant, {total_skipped} skipped, {total_errors} errors"
            )

            return {
                "status": status,
                "total_classified": total_classified,
                "total_relevant": total_relevant,
                "total_skipped": total_skipped,
                "total_errors": total_errors,
                "tier2_triggered": tier2_triggered,
                "timed_out": timed_out,
            }

    except SoftTimeLimitExceeded:
        logger.warning(f"⏰ Soft timeout at task level after {total_classified} items")
        # Trigger Tier-2 if we found relevant items but haven't triggered yet
        if total_relevant > 0 and not tier2_triggered:
            from app.sync_engine.tasks.ai_pipeline.tier2_extraction import extract_features
            extract_features.delay(workspace_id=workspace_id)
            logger.info("🔗 Triggered Tier-2 extraction before timeout exit")
        # Re-queue to continue processing
        classify_events.delay(workspace_id=workspace_id)
        return {
            "status": "timeout",
            "total_classified": total_classified,
            "total_relevant": total_relevant,
            "timed_out": True,
        }

    except Exception as e:
        logger.error(f"❌ Tier-1 classification task failed: {e}")
        import traceback
        traceback.print_exc()
        # Still trigger Tier-2 if we found relevant items
        if total_relevant > 0 and not tier2_triggered:
            from app.sync_engine.tasks.ai_pipeline.tier2_extraction import extract_features
            extract_features.delay(workspace_id=workspace_id)
            logger.info("🔗 Triggered Tier-2 extraction before retry")
        raise self.retry(exc=e, countdown=120)
    finally:
        cleanup_after_task()


def _classify_non_chunked_events(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    min_score: float,
) -> Dict[str, int]:
    """
    Classify events that weren't chunked (small enough to process directly).

    THIS IS THE ONLY FILTER:
    - Score >= min_score (default 6) proceeds to extraction
    - Score < min_score stops here
    """
    stats = {"classified": 0, "relevant": 0, "skipped": 0, "errors": 0}

    # Build query
    query = db.query(NormalizedEvent).filter(
        NormalizedEvent.processing_stage == "chunked",
        NormalizedEvent.classified_at.is_(None),
        NormalizedEvent.is_chunked == False,
        NormalizedEvent.retry_count < MAX_RETRIES,
    )

    if workspace_id:
        query = query.filter(NormalizedEvent.workspace_id == UUID(workspace_id))

    events = query.order_by(NormalizedEvent.created_at.asc()).limit(batch_size).all()

    if not events:
        logger.info("No non-chunked events to classify")
        return stats

    logger.info(f"Processing {len(events)} non-chunked events for classification")

    for event in events:
        try:
            # Skip excessively long messages to prevent timeouts
            text_length = len(event.clean_text or "")
            if text_length > MAX_MESSAGE_LENGTH:
                logger.warning(
                    f"⚠️ Skipping oversized event {event.id} ({text_length} chars > {MAX_MESSAGE_LENGTH})"
                )
                now = datetime.now(timezone.utc)
                event.processing_stage = "completed"
                event.processing_error = f"Message too long ({text_length} chars)"
                event.is_feature_relevant = False
                event.classification_confidence = 0.0
                event.classified_at = now

                # Mark source message as processed
                if event.source_table == "messages" and event.source_record_id:
                    message = db.query(Message).filter(
                        Message.id == event.source_record_id
                    ).first()
                    if message:
                        message.tier1_processed = True
                        message.feature_score = 0.0
                        message.processed_at = now

                db.commit()
                stats["skipped"] += 1
                continue

            # Call Tier-1 AI scoring
            result = ai_service.tier1_classify(
                text=event.clean_text,
                source_type=event.source_type,
                actor_role=event.actor_role,
            )

            now = datetime.now(timezone.utc)

            # Update event with score results
            event.classification_confidence = result.confidence  # score/10
            event.classified_at = now

            # Single decision: score >= min_score proceeds to extraction
            if result.score >= min_score:
                event.is_feature_relevant = True
                event.processing_stage = "classified"
                stats["relevant"] += 1
            else:
                event.is_feature_relevant = False
                event.processing_stage = "completed"
                stats["skipped"] += 1

            stats["classified"] += 1

            # CRITICAL: Update the source Message with tier1 results
            # This ensures tier1_processed=True and feature_score are set
            if event.source_table == "messages" and event.source_record_id:
                message = db.query(Message).filter(
                    Message.id == event.source_record_id
                ).first()
                if message:
                    message.tier1_processed = True
                    message.feature_score = result.score  # Store 0-10 score
                    message.processed_at = now
                    logger.debug(f"✓ Marked message {message.id} tier1_processed=True, feature_score={result.score:.1f}")

            # Commit after each event to avoid statement timeout from accumulated updates
            db.commit()

        except Exception as e:
            logger.error(f"Error classifying event {event.id}: {e}")
            db.rollback()
            event.retry_count = (event.retry_count or 0) + 1
            event.processing_error = f"Classification error: {str(e)[:400]}"
            db.commit()
            stats["errors"] += 1

    return stats


def _classify_chunks(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    min_score: float,
) -> Dict[str, int]:
    """
    Classify event chunks.

    THIS IS THE ONLY FILTER:
    - Score >= min_score (default 6) proceeds to extraction
    - Score < min_score stops here
    """
    stats = {"classified": 0, "relevant": 0, "skipped": 0, "errors": 0}

    # Build query
    query = db.query(EventChunk).filter(
        EventChunk.processing_stage == "pending",
        EventChunk.classified_at.is_(None),
        EventChunk.retry_count < MAX_RETRIES,
    )

    if workspace_id:
        query = query.filter(EventChunk.workspace_id == UUID(workspace_id))

    chunks = query.order_by(EventChunk.created_at.asc()).limit(batch_size).all()

    if not chunks:
        logger.info("No chunks to classify")
        return stats

    logger.info(f"Processing {len(chunks)} chunks for classification")

    for chunk in chunks:
        try:
            # Get parent event for context
            parent_event = chunk.normalized_event

            # Call Tier-1 AI scoring
            result = ai_service.tier1_classify(
                text=chunk.chunk_text,
                source_type=parent_event.source_type if parent_event else "unknown",
                actor_role=parent_event.actor_role if parent_event else None,
            )

            now = datetime.now(timezone.utc)

            # Update chunk with score results
            chunk.classification_confidence = result.confidence  # score/10
            chunk.classified_at = now

            # Single decision: score >= min_score proceeds to extraction
            if result.score >= min_score:
                chunk.is_feature_relevant = True
                chunk.processing_stage = "classified"
                stats["relevant"] += 1
            else:
                chunk.is_feature_relevant = False
                chunk.processing_stage = "completed"
                stats["skipped"] += 1

            stats["classified"] += 1

            # Commit after each chunk to avoid statement timeout
            db.commit()

        except Exception as e:
            logger.error(f"Error classifying chunk {chunk.id}: {e}")
            db.rollback()
            chunk.retry_count = (chunk.retry_count or 0) + 1
            chunk.processing_error = f"Classification error: {str(e)[:400]}"
            db.commit()
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

            event.classified_at = now

            # CRITICAL: Update the source Message with tier1 results
            # This ensures tier1_processed=True and feature_score are set for chunked messages
            if event.source_table == "messages" and event.source_record_id:
                message = db.query(Message).filter(
                    Message.id == event.source_record_id
                ).first()
                if message:
                    # Convert confidence (0-1) back to score (0-10)
                    score = (event.classification_confidence or 0) * 10.0
                    message.tier1_processed = True
                    message.feature_score = score
                    message.processed_at = now
                    logger.info(f"✓ Marked chunked message {message.id} tier1_processed=True, feature_score={score:.1f}")

            # Commit after each parent event update to avoid timeout
            db.commit()

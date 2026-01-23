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

from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.normalized_event import NormalizedEvent, EventChunk
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
    Classify chunked events using Tier-1 AI.

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
    try:
        logger.info(f"🔍 Starting Tier-1 classification task (workspace={workspace_id})")

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
                db, ai_service, workspace_id, batch_size // 2, min_score
            )
            total_classified += non_chunked_stats["classified"]
            total_relevant += non_chunked_stats["relevant"]
            total_skipped += non_chunked_stats["skipped"]
            total_errors += non_chunked_stats["errors"]

            # Process chunks
            chunk_stats = _classify_chunks(
                db, ai_service, workspace_id, batch_size // 2, min_score
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

        except Exception as e:
            logger.error(f"Error classifying event {event.id}: {e}")
            event.retry_count = (event.retry_count or 0) + 1
            event.processing_error = f"Classification error: {str(e)[:400]}"
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

        except Exception as e:
            logger.error(f"Error classifying chunk {chunk.id}: {e}")
            chunk.retry_count = (chunk.retry_count or 0) + 1
            chunk.processing_error = f"Classification error: {str(e)[:400]}"
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

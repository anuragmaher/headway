"""
Signal Scoring Task - State-Driven Execution

Computes deterministic signal scores for NormalizedEvents.
This runs BEFORE any AI calls to filter out low-value content.

State-Driven Model:
- Queries rows where: processing_stage='pending' AND scored_at IS NULL AND lock_token IS NULL
- Uses row-level locking to prevent duplicate processing
- Sets scored_at timestamp on completion for idempotent execution
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.normalized_event import NormalizedEvent
from app.services.signal_scoring_service import get_signal_scoring_service
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

# Batch size for scoring
SCORING_BATCH_SIZE = 100

# Default skip threshold
DEFAULT_SKIP_THRESHOLD = 0.3

# Max retries before giving up on a row
MAX_RETRIES = 3


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.score_normalized_events",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=180,  # 3 minute limit (this is fast, no AI)
    soft_time_limit=150,
)
def score_normalized_events(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = SCORING_BATCH_SIZE,
    skip_threshold: float = DEFAULT_SKIP_THRESHOLD
) -> Dict[str, Any]:
    """
    Score normalized events using deterministic heuristics.

    State-Driven Execution:
    - Finds rows: processing_stage='pending' AND scored_at IS NULL AND lock_token IS NULL
    - Acquires row-level locks to prevent race conditions
    - Processes in batches with automatic lock cleanup
    - Sets scored_at timestamp on completion (idempotent marker)

    Args:
        workspace_id: Optional workspace to limit processing
        batch_size: Number of records to process per batch
        skip_threshold: Score below which to skip AI processing

    Returns:
        Dict with processing stats
    """
    import uuid as uuid_module
    lock_token = uuid_module.uuid4()

    try:
        logger.info(f"📊 Starting signal scoring task (workspace={workspace_id}, lock={lock_token})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            signal_scorer = get_signal_scoring_service(skip_threshold=skip_threshold)

            # Build state-driven filter conditions:
            # 1. processing_stage = 'pending' (eligible for scoring)
            # 2. scored_at IS NULL (not yet scored - idempotent check)
            # 3. lock_token IS NULL (not locked by another worker - added by acquire_rows)
            # 4. retry_count < MAX_RETRIES (not exhausted retries)
            filter_conditions = [
                NormalizedEvent.processing_stage == "pending",
                NormalizedEvent.scored_at.is_(None),
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
                logger.info("No events to score")
                return {
                    "status": "success",
                    "total_scored": 0,
                    "total_passed": 0,
                    "total_skipped": 0,
                }

            logger.info(f"Acquired {len(events)} events for scoring")

            total_scored = 0
            total_skipped = 0
            total_passed = 0
            total_errors = 0

            for event in events:
                try:
                    # Build metadata for scoring
                    metadata = event.event_metadata or {}

                    # Score the event
                    score_result = signal_scorer.score(
                        text=event.clean_text,
                        source_type=event.source_type,
                        actor_role=event.actor_role,
                        metadata=metadata
                    )

                    # Update event with score
                    event.signal_score = score_result.score
                    event.signal_reason = score_result.reason
                    event.signal_keywords = score_result.keywords_found
                    event.skip_ai_processing = score_result.should_skip

                    # Mark as processed with state-driven timestamp
                    mark_row_processed(
                        row=event,
                        stage="scored",
                        timestamp_field="scored_at",
                        lock_token=lock_token,
                    )

                    total_scored += 1
                    if score_result.should_skip:
                        total_skipped += 1
                    else:
                        total_passed += 1

                except Exception as e:
                    logger.error(f"Error scoring event {event.id}: {e}")
                    # Mark error but keep stage for retry
                    mark_row_error(
                        row=event,
                        error_message=f"Scoring error: {str(e)[:400]}",
                        lock_token=lock_token,
                        increment_retry=True,
                    )
                    total_errors += 1
                    continue

            db.commit()

            logger.info(
                f"✅ Signal scoring complete: {total_scored} scored, "
                f"{total_passed} passed threshold, {total_skipped} will skip AI, "
                f"{total_errors} errors"
            )

            # Trigger next stage if we processed any events
            if total_passed > 0:
                from app.sync_engine.tasks.ai_pipeline.chunking import chunk_normalized_events
                chunk_normalized_events.delay(workspace_id=workspace_id)
                logger.info("🔗 Triggered chunking stage")

            return {
                "status": "success",
                "total_scored": total_scored,
                "total_passed": total_passed,
                "total_skipped": total_skipped,
                "total_errors": total_errors,
            }

    except Exception as e:
        logger.error(f"❌ Signal scoring task failed: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=60)
    finally:
        cleanup_after_task()

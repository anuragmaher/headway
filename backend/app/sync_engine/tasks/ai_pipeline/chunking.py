"""
Semantic Chunking Task - State-Driven Execution

Splits large NormalizedEvents into semantic chunks for efficient AI processing.
Runs AFTER signal scoring, processes ALL scored events (no pre-filtering).

State-Driven Model:
- Queries rows where: processing_stage='scored' AND chunked_at IS NULL AND lock_token IS NULL
- Uses row-level locking to prevent duplicate processing
- Sets chunked_at timestamp on completion for idempotent execution

NOTE: All events proceed to Tier-1 classification. The ONLY filter that prevents
      messages from reaching Tier-2 extraction is the Tier-1 score (0-10, >= 6 passes).
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.normalized_event import NormalizedEvent, EventChunk
from app.services.semantic_chunking_service import get_semantic_chunking_service
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

# Batch size for chunking
CHUNKING_BATCH_SIZE = 50

# Max retries before giving up on a row
MAX_RETRIES = 3


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.chunk_normalized_events",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=300,  # 5 minute limit
    soft_time_limit=270,
)
def chunk_normalized_events(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = CHUNKING_BATCH_SIZE,
) -> Dict[str, Any]:
    """
    Split scored normalized events into semantic chunks.

    State-Driven Execution:
    - Finds rows: processing_stage='scored' AND chunked_at IS NULL
    - Acquires row-level locks to prevent race conditions
    - Creates EventChunk records for large texts
    - Sets chunked_at timestamp on completion (idempotent marker)

    NOTE: All events proceed to Tier-1. Only the Tier-1 score >= 6 determines
          whether content reaches Tier-2 extraction.

    Args:
        workspace_id: Optional workspace to limit processing
        batch_size: Number of records to process per batch

    Returns:
        Dict with processing stats
    """
    import uuid as uuid_module
    lock_token = uuid_module.uuid4()

    try:
        logger.info(f"✂️ Starting semantic chunking task (workspace={workspace_id}, lock={lock_token})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            chunking_service = get_semantic_chunking_service()

            # Build state-driven filter conditions:
            # 1. processing_stage = 'scored' (eligible for chunking)
            # 2. chunked_at IS NULL (not yet chunked - idempotent check)
            # 3. lock_token IS NULL (not locked - added by acquire_rows)
            # 4. retry_count < MAX_RETRIES (not exhausted retries)
            # NOTE: Removed skip_ai_processing filter - all events go to Tier-1
            #       The only filter should be the Tier-1 score (0-10, >= 6 passes)
            filter_conditions = [
                NormalizedEvent.processing_stage == "scored",
                NormalizedEvent.chunked_at.is_(None),
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
                logger.info("No events to chunk")
                return {
                    "status": "success",
                    "total_processed": 0,
                    "total_chunks_created": 0,
                    "total_not_chunked": 0,
                }

            logger.info(f"Acquired {len(events)} events for chunking")

            total_processed = 0
            total_chunks_created = 0
            total_not_chunked = 0
            total_errors = 0

            for event in events:
                try:
                    # Check if text needs chunking
                    if not chunking_service.should_chunk(event.clean_text):
                        # Text is small enough, no chunking needed
                        event.is_chunked = False
                        event.chunk_count = 0

                        # Mark as processed with state-driven timestamp
                        mark_row_processed(
                            row=event,
                            stage="chunked",
                            timestamp_field="chunked_at",
                            lock_token=lock_token,
                        )

                        total_not_chunked += 1
                        total_processed += 1
                        continue

                    # Build metadata for chunking hints
                    metadata = event.event_metadata or {}

                    # Perform semantic chunking
                    chunks = chunking_service.chunk(
                        text=event.clean_text,
                        source_type=event.source_type,
                        metadata=metadata
                    )

                    # Store chunks in database
                    for chunk in chunks:
                        # Truncate string fields to fit column constraints
                        speaker_name = chunk.speaker[:255] if chunk.speaker else None
                        speaker_role = chunk.speaker_role[:100] if chunk.speaker_role else None

                        event_chunk = EventChunk(
                            workspace_id=event.workspace_id,
                            normalized_event_id=event.id,
                            chunk_text=chunk.text,
                            chunk_index=chunk.chunk_index,
                            token_estimate=chunk.token_estimate,
                            start_offset=chunk.start_offset,
                            end_offset=chunk.end_offset,
                            start_timestamp_seconds=chunk.start_time_seconds,
                            end_timestamp_seconds=chunk.end_time_seconds,
                            speaker_name=speaker_name,
                            speaker_role=speaker_role,
                            processing_stage="pending",
                        )
                        db.add(event_chunk)

                    # Update event with chunk info
                    event.is_chunked = True
                    event.chunk_count = len(chunks)

                    # Mark as processed with state-driven timestamp
                    mark_row_processed(
                        row=event,
                        stage="chunked",
                        timestamp_field="chunked_at",
                        lock_token=lock_token,
                    )

                    total_chunks_created += len(chunks)
                    total_processed += 1

                    logger.debug(f"Created {len(chunks)} chunks for event {event.id}")

                except Exception as e:
                    logger.error(f"Error chunking event {event.id}: {e}")
                    # Mark error but keep stage for retry
                    mark_row_error(
                        row=event,
                        error_message=f"Chunking error: {str(e)[:400]}",
                        lock_token=lock_token,
                        increment_retry=True,
                    )
                    total_errors += 1
                    continue

            db.commit()

            logger.info(
                f"✅ Semantic chunking complete: {total_processed} events processed, "
                f"{total_chunks_created} chunks created, {total_not_chunked} events too small to chunk, "
                f"{total_errors} errors"
            )

            # Trigger next stage if we processed any events
            if total_processed > 0:
                from app.sync_engine.tasks.ai_pipeline.tier1_classification import classify_events
                classify_events.delay(workspace_id=workspace_id)
                logger.info("🔗 Triggered classification stage")

            return {
                "status": "success",
                "total_processed": total_processed,
                "total_chunks_created": total_chunks_created,
                "total_not_chunked": total_not_chunked,
                "total_errors": total_errors,
            }

    except Exception as e:
        logger.error(f"❌ Semantic chunking task failed: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=60)
    finally:
        cleanup_after_task()

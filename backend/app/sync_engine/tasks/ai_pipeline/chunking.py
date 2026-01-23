"""
Semantic Chunking Task - For Long Texts Only

Splits large NormalizedEvents (>2000 chars) into semantic chunks for efficient AI processing.
Runs AFTER normalization, processes normalized events.

Short texts (<= 2000 chars) skip chunking and go directly to Tier-1 classification.
Long texts (> 2000 chars) are split into semantic chunks for processing.

No locking needed since we run a single worker.
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

logger = logging.getLogger(__name__)

# Batch size for chunking
CHUNKING_BATCH_SIZE = 50

# Max retries before giving up on a row
MAX_RETRIES = 3

# Minimum text length to require chunking (chars)
# Texts <= this length are processed as-is without chunking
MIN_CHUNK_LENGTH = 2000


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
    Split large normalized events (>2000 chars) into semantic chunks.

    - Short texts (<= 2000 chars): Skip chunking, go directly to classification
    - Long texts (> 2000 chars): Split into semantic chunks for processing

    Args:
        workspace_id: Optional workspace to limit processing
        batch_size: Number of records to process per batch

    Returns:
        Dict with processing stats
    """
    try:
        logger.info(f"✂️ Starting semantic chunking task (workspace={workspace_id})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            chunking_service = get_semantic_chunking_service()

            # Query events ready for chunking (after normalization)
            query = db.query(NormalizedEvent).filter(
                NormalizedEvent.processing_stage == "normalized",
                NormalizedEvent.chunked_at.is_(None),
                NormalizedEvent.retry_count < MAX_RETRIES,
            )

            if workspace_id:
                query = query.filter(NormalizedEvent.workspace_id == UUID(workspace_id))

            events = query.order_by(NormalizedEvent.created_at.asc()).limit(batch_size).all()

            if not events:
                logger.info("No events to chunk")
                return {
                    "status": "success",
                    "total_processed": 0,
                    "total_chunks_created": 0,
                    "total_not_chunked": 0,
                }

            logger.info(f"Processing {len(events)} events for chunking")

            total_processed = 0
            total_chunks_created = 0
            total_not_chunked = 0
            total_errors = 0

            for event in events:
                try:
                    now = datetime.now(timezone.utc)
                    text_length = len(event.clean_text) if event.clean_text else 0

                    # Only chunk long texts (> 2000 chars)
                    if text_length <= MIN_CHUNK_LENGTH:
                        # Short text - no chunking needed
                        event.is_chunked = False
                        event.chunk_count = 0
                        event.processing_stage = "chunked"
                        event.chunked_at = now
                        total_not_chunked += 1
                        total_processed += 1
                        continue

                    # Long text - needs chunking
                    metadata = event.event_metadata or {}

                    # Perform semantic chunking
                    chunks = chunking_service.chunk(
                        text=event.clean_text,
                        source_type=event.source_type,
                        metadata=metadata
                    )

                    # Store chunks in database
                    for chunk in chunks:
                        # Store extra fields in chunk_metadata JSONB
                        chunk_metadata = {
                            "speaker_name": chunk.speaker[:255] if chunk.speaker else None,
                            "speaker_role": chunk.speaker_role[:100] if chunk.speaker_role else None,
                            "token_estimate": chunk.token_estimate,
                            "start_offset": chunk.start_offset,
                            "end_offset": chunk.end_offset,
                            "start_timestamp_seconds": chunk.start_time_seconds,
                            "end_timestamp_seconds": chunk.end_time_seconds,
                        }

                        event_chunk = EventChunk(
                            workspace_id=event.workspace_id,
                            normalized_event_id=event.id,
                            chunk_text=chunk.text,
                            chunk_index=chunk.chunk_index,
                            chunk_metadata=chunk_metadata,
                            processing_stage="pending",
                        )
                        db.add(event_chunk)

                    # Update event with chunk info
                    event.is_chunked = True
                    event.chunk_count = len(chunks)
                    event.processing_stage = "chunked"
                    event.chunked_at = now

                    total_chunks_created += len(chunks)
                    total_processed += 1

                    logger.debug(f"Created {len(chunks)} chunks for event {event.id} (text: {text_length} chars)")

                except Exception as e:
                    logger.error(f"Error chunking event {event.id}: {e}")
                    event.retry_count = (event.retry_count or 0) + 1
                    event.processing_error = f"Chunking error: {str(e)[:400]}"
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

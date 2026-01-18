"""
Tier-2 AI Structured Extraction Task - State-Driven Execution

Extract structured feature request data from classified content.
Only processes content that passed Tier-1 classification.

State-Driven Model:
- For NormalizedEvents: processing_stage='classified' AND extracted_at IS NULL AND is_chunked=False
- For EventChunks: processing_stage='classified' AND extracted_at IS NULL
- Uses row-level locking to prevent duplicate processing
- Sets extracted_at timestamp on completion for idempotent execution
"""

import logging
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.normalized_event import NormalizedEvent, EventChunk
from app.models.extracted_fact import ExtractedFact
from app.models.theme import Theme
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

# Batch size for extraction
EXTRACTION_BATCH_SIZE = 15

# Minimum extraction confidence to store
MIN_EXTRACTION_CONFIDENCE = 0.5

# Max retries before giving up on a row
MAX_RETRIES = 3


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.extract_features",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=90,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=900,  # 15 minute limit (complex AI calls)
    soft_time_limit=840,
)
def extract_features(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = EXTRACTION_BATCH_SIZE,
    min_confidence: float = MIN_EXTRACTION_CONFIDENCE,
) -> Dict[str, Any]:
    """
    Extract structured feature data using Tier-2 AI.

    State-Driven Execution:
    - For non-chunked events: processing_stage='classified' AND extracted_at IS NULL AND is_chunked=False
    - For chunks: processing_stage='classified' AND extracted_at IS NULL
    - Acquires row-level locks to prevent race conditions
    - Sets extracted_at timestamp on completion (idempotent marker)

    Args:
        workspace_id: Optional workspace to limit processing
        batch_size: Number of records to process per batch
        min_confidence: Minimum confidence to store extracted fact

    Returns:
        Dict with processing stats
    """
    import uuid as uuid_module
    lock_token = uuid_module.uuid4()

    try:
        logger.info(f"📝 Starting Tier-2 extraction task (workspace={workspace_id}, lock={lock_token})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            ai_service = get_tiered_ai_service()

            total_extracted = 0
            total_facts_created = 0
            total_skipped = 0
            total_errors = 0

            # Get workspace themes for classification
            themes = _get_workspace_themes(db, workspace_id)

            # Process non-chunked classified events
            event_stats = _extract_from_events(
                db, ai_service, workspace_id, batch_size // 2, min_confidence, themes, lock_token
            )
            total_extracted += event_stats["extracted"]
            total_facts_created += event_stats["facts_created"]
            total_skipped += event_stats["skipped"]
            total_errors += event_stats["errors"]

            # Process classified chunks
            chunk_stats = _extract_from_chunks(
                db, ai_service, workspace_id, batch_size // 2, min_confidence, themes, lock_token
            )
            total_extracted += chunk_stats["extracted"]
            total_facts_created += chunk_stats["facts_created"]
            total_skipped += chunk_stats["skipped"]
            total_errors += chunk_stats["errors"]

            db.commit()

            logger.info(
                f"✅ Tier-2 extraction complete: {total_extracted} processed, "
                f"{total_facts_created} facts created, {total_skipped} skipped, {total_errors} errors"
            )

            # Trigger next stage if we created any facts
            if total_facts_created > 0:
                from app.sync_engine.tasks.ai_pipeline.tier3_aggregation import aggregate_facts
                aggregate_facts.delay(workspace_id=workspace_id)
                logger.info("🔗 Triggered aggregation stage")

            return {
                "status": "success",
                "total_extracted": total_extracted,
                "total_facts_created": total_facts_created,
                "total_skipped": total_skipped,
                "total_errors": total_errors,
            }

    except Exception as e:
        logger.error(f"❌ Tier-2 extraction task failed: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=180)
    finally:
        cleanup_after_task()


def _get_workspace_themes(db: Session, workspace_id: Optional[str]) -> List[Dict[str, Any]]:
    """Get themes for a workspace for AI classification."""
    if not workspace_id:
        return []

    themes = db.query(Theme).filter(
        Theme.workspace_id == UUID(workspace_id)
    ).all()

    return [
        {
            "id": str(theme.id),
            "name": theme.name,
            "description": theme.description or "",
        }
        for theme in themes
    ]


def _compute_content_hash(text: str, title: str) -> str:
    """Compute a hash for deduplication purposes."""
    content = f"{title.lower().strip()}:{text[:500].lower().strip()}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def _extract_from_events(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    min_confidence: float,
    themes: List[Dict[str, Any]],
    lock_token,
) -> Dict[str, int]:
    """
    Extract features from non-chunked events.

    State-Driven filter:
    - processing_stage='classified' (ready for extraction)
    - extracted_at IS NULL (not yet extracted - idempotent)
    - is_chunked=False (doesn't have chunks)
    - is_feature_relevant=True (passed classification)
    """
    stats = {"extracted": 0, "facts_created": 0, "skipped": 0, "errors": 0}

    # Build state-driven filter conditions
    filter_conditions = [
        NormalizedEvent.processing_stage == "classified",
        NormalizedEvent.extracted_at.is_(None),
        NormalizedEvent.is_chunked == False,
        NormalizedEvent.is_feature_relevant == True,
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
        logger.info("No events for extraction")
        return stats

    logger.info(f"Acquired {len(events)} events for extraction")

    for event in events:
        try:
            # Build context for extraction
            metadata = event.event_metadata or {}

            # Call Tier-2 AI extraction
            result = ai_service.tier2_extract(
                text=event.clean_text,
                source_type=event.source_type,
                actor_name=event.actor_name,
                actor_role=event.actor_role,
                title=event.title,
                metadata=metadata,
            )

            # Check extraction confidence
            if result.confidence < min_confidence:
                event.processed_at = datetime.now(timezone.utc)
                mark_row_processed(
                    row=event,
                    stage="extracted",
                    timestamp_field="extracted_at",
                    lock_token=lock_token,
                )
                stats["skipped"] += 1
                stats["extracted"] += 1
                continue

            # Classify theme if we have themes
            theme_id = None
            theme_confidence = None
            if themes and result.feature_title:
                theme_result = ai_service.classify_theme(
                    feature_title=result.feature_title,
                    feature_description=result.feature_description or "",
                    themes=themes,
                )
                if theme_result.theme_id:
                    theme_id = UUID(theme_result.theme_id)
                    theme_confidence = theme_result.confidence

            # Create ExtractedFact
            content_hash = _compute_content_hash(
                event.clean_text, result.feature_title
            )

            fact = ExtractedFact(
                workspace_id=event.workspace_id,
                normalized_event_id=event.id,
                chunk_id=None,
                feature_title=result.feature_title,
                feature_description=result.feature_description,
                problem_statement=result.problem_statement,
                desired_outcome=result.desired_outcome,
                user_persona=result.user_persona,
                use_case=result.use_case,
                priority_hint=result.priority_hint,
                urgency_hint=result.urgency_hint,
                sentiment=result.sentiment,
                keywords=result.keywords,
                extraction_confidence=result.confidence,
                theme_id=theme_id,
                theme_confidence=theme_confidence,
                source_type=event.source_type,
                source_id=event.source_id,
                actor_name=event.actor_name,
                actor_email=event.actor_email,
                event_timestamp=event.event_timestamp,
                content_hash=content_hash,
                aggregation_status="pending",
            )
            db.add(fact)

            # Update event with state-driven timestamp
            event.processed_at = datetime.now(timezone.utc)
            mark_row_processed(
                row=event,
                stage="extracted",
                timestamp_field="extracted_at",
                lock_token=lock_token,
            )

            stats["extracted"] += 1
            stats["facts_created"] += 1

        except Exception as e:
            logger.error(f"Error extracting from event {event.id}: {e}")
            mark_row_error(
                row=event,
                error_message=f"Extraction error: {str(e)[:400]}",
                lock_token=lock_token,
                increment_retry=True,
            )
            stats["errors"] += 1

    return stats


def _extract_from_chunks(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    min_confidence: float,
    themes: List[Dict[str, Any]],
    lock_token,
) -> Dict[str, int]:
    """
    Extract features from classified chunks.

    State-Driven filter:
    - processing_stage='classified' (ready for extraction)
    - extracted_at IS NULL (not yet extracted - idempotent)
    - is_feature_relevant=True (passed classification)
    - skip_extraction=False (not marked to skip)
    """
    stats = {"extracted": 0, "facts_created": 0, "skipped": 0, "errors": 0}

    # Build state-driven filter conditions
    filter_conditions = [
        EventChunk.processing_stage == "classified",
        EventChunk.extracted_at.is_(None),
        EventChunk.is_feature_relevant == True,
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
        logger.info("No chunks for extraction")
        return stats

    logger.info(f"Acquired {len(chunks)} chunks for extraction")

    for chunk in chunks:
        try:
            # Get parent event for context
            parent_event = chunk.normalized_event
            if not parent_event:
                chunk.processed_at = datetime.now(timezone.utc)
                mark_row_processed(
                    row=chunk,
                    stage="extracted",
                    timestamp_field="extracted_at",
                    lock_token=lock_token,
                )
                stats["skipped"] += 1
                continue

            metadata = parent_event.event_metadata or {}

            # Call Tier-2 AI extraction
            result = ai_service.tier2_extract(
                text=chunk.chunk_text,
                source_type=parent_event.source_type,
                actor_name=chunk.speaker_name or parent_event.actor_name,
                actor_role=chunk.speaker_role or parent_event.actor_role,
                title=parent_event.title,
                metadata=metadata,
            )

            # Check extraction confidence
            if result.confidence < min_confidence:
                chunk.processed_at = datetime.now(timezone.utc)
                mark_row_processed(
                    row=chunk,
                    stage="extracted",
                    timestamp_field="extracted_at",
                    lock_token=lock_token,
                )
                stats["skipped"] += 1
                stats["extracted"] += 1
                continue

            # Classify theme if we have themes
            theme_id = None
            theme_confidence = None
            if themes and result.feature_title:
                theme_result = ai_service.classify_theme(
                    feature_title=result.feature_title,
                    feature_description=result.feature_description or "",
                    themes=themes,
                )
                if theme_result.theme_id:
                    theme_id = UUID(theme_result.theme_id)
                    theme_confidence = theme_result.confidence

            # Create ExtractedFact
            content_hash = _compute_content_hash(
                chunk.chunk_text, result.feature_title
            )

            fact = ExtractedFact(
                workspace_id=chunk.workspace_id,
                normalized_event_id=parent_event.id,
                chunk_id=chunk.id,
                feature_title=result.feature_title,
                feature_description=result.feature_description,
                problem_statement=result.problem_statement,
                desired_outcome=result.desired_outcome,
                user_persona=result.user_persona,
                use_case=result.use_case,
                priority_hint=result.priority_hint,
                urgency_hint=result.urgency_hint,
                sentiment=result.sentiment,
                keywords=result.keywords,
                extraction_confidence=result.confidence,
                theme_id=theme_id,
                theme_confidence=theme_confidence,
                source_type=parent_event.source_type,
                source_id=parent_event.source_id,
                actor_name=chunk.speaker_name or parent_event.actor_name,
                actor_email=parent_event.actor_email,
                event_timestamp=parent_event.event_timestamp,
                content_hash=content_hash,
                aggregation_status="pending",
            )
            db.add(fact)

            # Update chunk with state-driven timestamp
            chunk.processed_at = datetime.now(timezone.utc)
            mark_row_processed(
                row=chunk,
                stage="extracted",
                timestamp_field="extracted_at",
                lock_token=lock_token,
            )

            stats["extracted"] += 1
            stats["facts_created"] += 1

        except Exception as e:
            logger.error(f"Error extracting from chunk {chunk.id}: {e}")
            mark_row_error(
                row=chunk,
                error_message=f"Extraction error: {str(e)[:400]}",
                lock_token=lock_token,
                increment_retry=True,
            )
            stats["errors"] += 1

    # Update parent events after extraction
    _update_parent_events_after_extraction(db, workspace_id)

    return stats


def _update_parent_events_after_extraction(
    db: Session,
    workspace_id: Optional[str],
) -> None:
    """
    Update parent events when all their chunks are extracted.

    This marks the parent event as extracted when all chunks are done.
    """
    # Find chunked events that are still in 'classified' stage
    query = db.query(NormalizedEvent).filter(
        NormalizedEvent.processing_stage == "classified",
        NormalizedEvent.is_chunked == True,
    )

    if workspace_id:
        query = query.filter(NormalizedEvent.workspace_id == UUID(workspace_id))

    events = query.all()

    for event in events:
        # Check if all classified chunks are extracted
        pending_chunks = db.query(EventChunk).filter(
            EventChunk.normalized_event_id == event.id,
            EventChunk.processing_stage == "classified",
        ).count()

        if pending_chunks == 0:
            now = datetime.now(timezone.utc)
            event.processing_stage = "extracted"
            event.extracted_at = now
            event.processed_at = now
            event.updated_at = now

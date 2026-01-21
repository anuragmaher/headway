"""
Tier-2 AI Structured Extraction Task - State-Driven Execution

Extract structured feature request data from classified content.
Only processes content that passed Tier-1 classification (score >= 6).

New Flow (v2.0):
- Extracts feature details from text
- ALWAYS assigns to a theme (required)
- Matches against existing features or creates new ones
- Features are created/updated directly in Tier-2 (no Tier-3 aggregation needed)
- ExtractedFacts serve as audit trail

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
from app.models.feature import Feature
from app.models.message import Message, feature_messages
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

            # Get workspace themes and existing features for AI matching
            themes = _get_workspace_themes(db, workspace_id)
            existing_features = _get_workspace_features(db, workspace_id)

            # Process non-chunked classified events
            event_stats = _extract_from_events(
                db, ai_service, workspace_id, batch_size // 2, min_confidence, themes, existing_features, lock_token
            )
            total_extracted += event_stats["extracted"]
            total_facts_created += event_stats["facts_created"]
            total_skipped += event_stats["skipped"]
            total_errors += event_stats["errors"]

            # Refresh features list after processing events (new features may have been created)
            existing_features = _get_workspace_features(db, workspace_id)

            # Process classified chunks
            chunk_stats = _extract_from_chunks(
                db, ai_service, workspace_id, batch_size // 2, min_confidence, themes, existing_features, lock_token
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

            # Note: Feature creation/matching now happens directly in Tier-2
            # No need to trigger Tier-3 aggregation - facts are already linked to features

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
        logger.warning("_get_workspace_themes called with workspace_id=None, returning empty list")
        return []

    themes = db.query(Theme).filter(
        Theme.workspace_id == UUID(workspace_id) if isinstance(workspace_id, str) else Theme.workspace_id == workspace_id
    ).all()

    logger.info(f"Found {len(themes)} themes for workspace {workspace_id}")

    return [
        {
            "id": str(theme.id),
            "name": theme.name,
            "description": theme.description or "",
        }
        for theme in themes
    ]


def _get_themes_for_workspace_uuid(db: Session, workspace_id: UUID) -> List[Dict[str, Any]]:
    """Get themes for a workspace using UUID directly (for per-event fetching)."""
    themes = db.query(Theme).filter(Theme.workspace_id == workspace_id).all()

    logger.info(f"Found {len(themes)} themes for workspace UUID {workspace_id}")

    return [
        {
            "id": str(theme.id),
            "name": theme.name,
            "description": theme.description or "",
        }
        for theme in themes
    ]


def _get_default_theme_id(db: Session, workspace_id: UUID) -> Optional[UUID]:
    """
    Get the first available theme for a workspace as a fallback.

    This ensures features ALWAYS have a theme even if AI-assigned theme name doesn't match.
    """
    theme = db.query(Theme).filter(Theme.workspace_id == workspace_id).first()
    if theme:
        logger.info(f"Using default theme '{theme.name}' (ID: {theme.id}) as fallback")
        return theme.id
    return None


def _get_workspace_features(db: Session, workspace_id: Optional[str]) -> List[Dict[str, Any]]:
    """Get existing features for a workspace for AI matching."""
    if not workspace_id:
        return []

    # Get features with their theme names
    features = db.query(Feature, Theme.name.label("theme_name")).outerjoin(
        Theme, Feature.theme_id == Theme.id
    ).filter(
        Feature.workspace_id == UUID(workspace_id)
    ).order_by(Feature.mention_count.desc()).limit(50).all()

    return [
        {
            "id": str(f.Feature.id),
            "name": f.Feature.name,
            "description": f.Feature.description[:200] if f.Feature.description else "",
            "theme_name": f.theme_name or "Uncategorized",
            "mention_count": f.Feature.mention_count or 1,
        }
        for f in features
    ]


def _get_theme_id_by_name(themes: List[Dict[str, Any]], theme_name: str) -> Optional[UUID]:
    """
    Find theme ID by name (case-insensitive, with fuzzy matching).

    Tries exact match first, then partial/fuzzy match for robustness.
    """
    if not theme_name:
        logger.warning("No theme_name provided for theme matching")
        return None

    if not themes:
        logger.warning("No themes available for matching")
        return None

    theme_name_lower = theme_name.lower().strip()

    # Try exact match first (case-insensitive)
    for theme in themes:
        if theme["name"].lower().strip() == theme_name_lower:
            logger.debug(f"Exact theme match: '{theme_name}' -> '{theme['name']}' (ID: {theme['id']})")
            return UUID(theme["id"])

    # Try partial match (AI might return slightly different name)
    for theme in themes:
        theme_name_db = theme["name"].lower().strip()
        # Check if one contains the other
        if theme_name_lower in theme_name_db or theme_name_db in theme_name_lower:
            logger.info(f"Partial theme match: '{theme_name}' -> '{theme['name']}' (ID: {theme['id']})")
            return UUID(theme["id"])

    # Log warning if no match found
    available_themes = [t["name"] for t in themes]
    logger.warning(f"No theme match found for '{theme_name}'. Available themes: {available_themes}")
    return None


def _compute_content_hash(text: str, title: str) -> str:
    """Compute a hash for deduplication purposes."""
    content = f"{title.lower().strip()}:{text[:500].lower().strip()}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def _link_message_to_feature(
    db: Session,
    event: NormalizedEvent,
    feature_id: UUID,
) -> bool:
    """
    Link a message to a feature via the feature_messages association table.

    This enables querying messages by feature for the mentions/messages section.
    Also queues the message for AI insights processing (since it passed Tier-2).

    Args:
        db: Database session
        event: The NormalizedEvent containing source_table and source_record_id
        feature_id: The feature ID to link to

    Returns:
        True if link was created, False if not applicable or already exists
    """
    # Only link if the source is a message
    if event.source_table != "messages":
        logger.debug(f"Skipping message link - source_table is '{event.source_table}', not 'messages'")
        return False

    if not event.source_record_id:
        logger.debug(f"Skipping message link - no source_record_id")
        return False

    message_id = event.source_record_id

    # Check if link already exists
    existing = db.execute(
        feature_messages.select().where(
            feature_messages.c.feature_id == feature_id,
            feature_messages.c.message_id == message_id,
        )
    ).first()

    if existing:
        logger.debug(f"Message-feature link already exists: message={message_id}, feature={feature_id}")
        return False

    # Insert the link
    try:
        db.execute(
            feature_messages.insert().values(
                feature_id=feature_id,
                message_id=message_id,
            )
        )
        logger.info(f"Linked message {message_id} to feature {feature_id}")

        # Queue message for AI insights since it passed Tier-2
        _queue_message_for_ai_insights(str(message_id), str(event.workspace_id))

        return True
    except Exception as e:
        logger.warning(f"Failed to link message {message_id} to feature {feature_id}: {e}")
        return False


def _queue_message_for_ai_insights(message_id: str, workspace_id: str) -> None:
    """
    Queue a message for AI insights processing after it passes Tier-2.

    This is the ONLY entry point for AI insights - messages must pass Tier-2
    (be linked to a feature) before they can be processed for AI insights.
    """
    try:
        from app.sync_engine.tasks.ai_insights.worker import queue_message_for_insights
        queue_message_for_insights.apply_async(
            args=[message_id, workspace_id],
            priority=4,  # Medium-high priority for fresh Tier-2 passed messages
            countdown=2,  # Small delay to allow DB commit
        )
        logger.info(f"Queued message {message_id} for AI insights (passed Tier-2)")
    except Exception as e:
        logger.warning(f"Failed to queue message {message_id} for AI insights: {e}")


def _extract_from_events(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    min_confidence: float,
    themes: List[Dict[str, Any]],
    existing_features: List[Dict[str, Any]],
    lock_token,
) -> Dict[str, int]:
    """
    Extract features from non-chunked events.

    Now includes theme assignment and feature matching in Tier-2.
    Either matches an existing feature (increments mention count) or creates a new one.

    State-Driven filter:
    - processing_stage='classified' (ready for extraction)
    - extracted_at IS NULL (not yet extracted - idempotent)
    - is_chunked=False (doesn't have chunks)
    - is_feature_relevant=True (passed classification with score >= 6)
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

    # Cache themes per workspace for efficiency
    themes_cache: Dict[UUID, List[Dict[str, Any]]] = {}

    for event in events:
        try:
            # Get themes for this event's workspace (use cache or fetch)
            event_workspace_id = event.workspace_id
            logger.debug(f"Processing event {event.id} for workspace {event_workspace_id}")

            if event_workspace_id not in themes_cache:
                if themes:  # Use pre-fetched themes if available (when workspace_id was provided)
                    themes_cache[event_workspace_id] = themes
                    logger.info(f"Using {len(themes)} pre-fetched themes for workspace {event_workspace_id}")
                else:
                    # Fetch themes for this specific workspace
                    fetched_themes = _get_themes_for_workspace_uuid(db, event_workspace_id)
                    themes_cache[event_workspace_id] = fetched_themes
                    logger.info(f"Fetched {len(fetched_themes)} themes for workspace {event_workspace_id}")

            event_themes = themes_cache[event_workspace_id]

            # Log themes being passed to AI
            if event_themes:
                theme_names = [t.get("name", "?") for t in event_themes]
                logger.info(f"Passing {len(event_themes)} themes to Tier-2 AI: {theme_names}")
            else:
                logger.warning(f"NO THEMES available for workspace {event_workspace_id}! Check if themes exist in DB.")

            # Call Tier-2 AI extraction with themes and existing features
            result = ai_service.tier2_extract(
                text=event.clean_text,
                source_type=event.source_type,
                actor_name=event.actor_name,
                actor_role=event.actor_role,
                title=event.title,
                themes=event_themes,
                existing_features=existing_features,
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

            # Get theme ID from the AI-assigned theme name
            theme_id = _get_theme_id_by_name(event_themes, result.theme_name)

            # IMPORTANT: Features MUST have a theme - use fallback if no match
            if theme_id:
                logger.info(f"[Event] Tier-2: Assigned to theme '{result.theme_name}' (ID: {theme_id})")
            else:
                logger.warning(f"[Event] Tier-2: Could not find theme for '{result.theme_name}' - using fallback theme")
                theme_id = _get_default_theme_id(db, event_workspace_id)
                if theme_id:
                    logger.info(f"[Event] Tier-2: Using fallback theme (ID: {theme_id})")
                else:
                    logger.error(f"[Event] Tier-2: No themes exist for workspace {event_workspace_id}! Cannot assign feature to theme.")

            # Handle feature matching or creation
            feature_id = None
            if result.matched_feature_id and not result.is_new_feature:
                # AI matched an existing feature - increment mention count
                try:
                    feature_id = UUID(result.matched_feature_id)
                    feature = db.query(Feature).filter(Feature.id == feature_id).first()
                    if feature:
                        event_time = event.event_timestamp or datetime.now(timezone.utc)
                        feature.mention_count = (feature.mention_count or 1) + 1
                        # Update both old and new timestamp columns for compatibility
                        feature.last_mentioned_at = event_time
                        feature.last_mentioned = event_time  # Legacy column used by API
                        feature.updated_at = datetime.now(timezone.utc)
                        logger.info(f"Matched existing feature '{feature.name}' (mentions: {feature.mention_count})")
                    else:
                        # Feature not found, will create new
                        feature_id = None
                        result.is_new_feature = True
                except (ValueError, TypeError):
                    feature_id = None
                    result.is_new_feature = True

            if result.is_new_feature:
                # Create new feature
                event_time = event.event_timestamp or datetime.now(timezone.utc)
                new_feature = Feature(
                    workspace_id=event.workspace_id,
                    theme_id=theme_id,
                    name=result.feature_title[:255],
                    description=result.feature_description,
                    priority=_map_priority_hint(result.priority_hint),
                    urgency=_map_urgency_hint(result.urgency_hint),
                    mention_count=1,
                    # Set both old and new timestamp columns for compatibility
                    first_mentioned_at=event_time,
                    last_mentioned_at=event_time,
                    first_mentioned=event_time,  # Legacy column used by API
                    last_mentioned=event_time,   # Legacy column used by API
                    match_confidence=result.confidence,
                    feature_metadata={
                        "problem_statement": result.problem_statement,
                        "desired_outcome": result.desired_outcome,
                        "user_persona": result.user_persona,
                        "use_case": result.use_case,
                        "keywords": result.keywords,
                        "sentiment": result.sentiment,
                    },
                )
                db.add(new_feature)
                db.flush()
                feature_id = new_feature.id
                # Add to existing features list for subsequent matches in this batch
                existing_features.append({
                    "id": str(feature_id),
                    "name": result.feature_title,
                    "description": result.feature_description[:200] if result.feature_description else "",
                    "theme_name": result.theme_name or "Uncategorized",
                    "mention_count": 1,
                })
                logger.info(f"Created new feature '{result.feature_title}'")

            # Link the source message to the feature (for mentions display)
            if feature_id:
                _link_message_to_feature(db, event, feature_id)

            # Create ExtractedFact (for audit trail)
            content_hash = _compute_content_hash(event.clean_text, result.feature_title)
            fact = ExtractedFact(
                workspace_id=event.workspace_id,
                normalized_event_id=event.id,
                chunk_id=None,
                feature_id=feature_id,
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
                theme_confidence=result.theme_confidence,
                source_type=event.source_type,
                source_id=event.source_id,
                actor_name=event.actor_name,
                actor_email=event.actor_email,
                event_timestamp=event.event_timestamp,
                content_hash=content_hash,
                aggregation_status="aggregated" if feature_id else "pending",
            )
            db.add(fact)

            # Update event
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
            import traceback
            traceback.print_exc()
            mark_row_error(
                row=event,
                error_message=f"Extraction error: {str(e)[:400]}",
                lock_token=lock_token,
                increment_retry=True,
            )
            stats["errors"] += 1

    return stats


def _map_priority_hint(hint: Optional[str]) -> str:
    """Map AI priority hint to feature priority."""
    if not hint:
        return "medium"
    hint_lower = hint.lower()
    if hint_lower in ("high", "critical", "urgent"):
        return "high"
    elif hint_lower in ("low", "minor", "nice-to-have"):
        return "low"
    return "medium"


def _map_urgency_hint(hint: Optional[str]) -> str:
    """Map AI urgency hint to feature urgency."""
    if not hint:
        return "medium"
    hint_lower = hint.lower()
    if hint_lower in ("high", "critical", "immediate", "asap"):
        return "high"
    elif hint_lower in ("low", "whenever", "no-rush"):
        return "low"
    return "medium"


def _extract_from_chunks(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    min_confidence: float,
    themes: List[Dict[str, Any]],
    existing_features: List[Dict[str, Any]],
    lock_token,
) -> Dict[str, int]:
    """
    Extract features from classified chunks.

    Now includes theme assignment and feature matching in Tier-2.
    Either matches an existing feature (increments mention count) or creates a new one.

    State-Driven filter:
    - processing_stage='classified' (ready for extraction)
    - extracted_at IS NULL (not yet extracted - idempotent)
    - is_feature_relevant=True (passed classification with score >= 6)
    """
    stats = {"extracted": 0, "facts_created": 0, "skipped": 0, "errors": 0}

    # Build state-driven filter conditions
    filter_conditions = [
        EventChunk.processing_stage == "classified",
        EventChunk.extracted_at.is_(None),
        EventChunk.is_feature_relevant == True,
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

    # Cache themes per workspace for efficiency
    themes_cache: Dict[UUID, List[Dict[str, Any]]] = {}

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

            # Get themes for this chunk's workspace (use cache or fetch)
            chunk_workspace_id = chunk.workspace_id
            logger.debug(f"Processing chunk {chunk.id} for workspace {chunk_workspace_id}")

            if chunk_workspace_id not in themes_cache:
                if themes:  # Use pre-fetched themes if available (when workspace_id was provided)
                    themes_cache[chunk_workspace_id] = themes
                    logger.info(f"Using {len(themes)} pre-fetched themes for chunk workspace {chunk_workspace_id}")
                else:
                    # Fetch themes for this specific workspace
                    fetched_themes = _get_themes_for_workspace_uuid(db, chunk_workspace_id)
                    themes_cache[chunk_workspace_id] = fetched_themes
                    logger.info(f"Fetched {len(fetched_themes)} themes for chunk workspace {chunk_workspace_id}")

            chunk_themes = themes_cache[chunk_workspace_id]

            # Log themes being passed to AI
            if chunk_themes:
                theme_names = [t.get("name", "?") for t in chunk_themes]
                logger.info(f"Passing {len(chunk_themes)} themes to Tier-2 AI for chunk: {theme_names}")
            else:
                logger.warning(f"NO THEMES available for chunk workspace {chunk_workspace_id}! Check if themes exist in DB.")

            # Call Tier-2 AI extraction with themes and existing features
            result = ai_service.tier2_extract(
                text=chunk.chunk_text,
                source_type=parent_event.source_type,
                actor_name=chunk.speaker_name or parent_event.actor_name,
                actor_role=chunk.speaker_role or parent_event.actor_role,
                title=parent_event.title,
                themes=chunk_themes,
                existing_features=existing_features,
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

            # Get theme ID from the AI-assigned theme name
            theme_id = _get_theme_id_by_name(chunk_themes, result.theme_name)

            # IMPORTANT: Features MUST have a theme - use fallback if no match
            if theme_id:
                logger.info(f"[Chunk] Tier-2: Assigned to theme '{result.theme_name}' (ID: {theme_id})")
            else:
                logger.warning(f"[Chunk] Tier-2: Could not find theme for '{result.theme_name}' - using fallback theme")
                theme_id = _get_default_theme_id(db, chunk_workspace_id)
                if theme_id:
                    logger.info(f"[Chunk] Tier-2: Using fallback theme (ID: {theme_id})")
                else:
                    logger.error(f"[Chunk] Tier-2: No themes exist for workspace {chunk_workspace_id}! Cannot assign feature to theme.")

            # Handle feature matching or creation
            feature_id = None
            if result.matched_feature_id and not result.is_new_feature:
                # AI matched an existing feature - increment mention count
                try:
                    feature_id = UUID(result.matched_feature_id)
                    feature = db.query(Feature).filter(Feature.id == feature_id).first()
                    if feature:
                        event_time = parent_event.event_timestamp or datetime.now(timezone.utc)
                        feature.mention_count = (feature.mention_count or 1) + 1
                        # Update both old and new timestamp columns for compatibility
                        feature.last_mentioned_at = event_time
                        feature.last_mentioned = event_time  # Legacy column used by API
                        feature.updated_at = datetime.now(timezone.utc)
                        logger.info(f"Matched existing feature '{feature.name}' (mentions: {feature.mention_count})")
                    else:
                        feature_id = None
                        result.is_new_feature = True
                except (ValueError, TypeError):
                    feature_id = None
                    result.is_new_feature = True

            if result.is_new_feature:
                # Create new feature
                event_time = parent_event.event_timestamp or datetime.now(timezone.utc)
                new_feature = Feature(
                    workspace_id=chunk.workspace_id,
                    theme_id=theme_id,
                    name=result.feature_title[:255],
                    description=result.feature_description,
                    priority=_map_priority_hint(result.priority_hint),
                    urgency=_map_urgency_hint(result.urgency_hint),
                    mention_count=1,
                    # Set both old and new timestamp columns for compatibility
                    first_mentioned_at=event_time,
                    last_mentioned_at=event_time,
                    first_mentioned=event_time,  # Legacy column used by API
                    last_mentioned=event_time,   # Legacy column used by API
                    match_confidence=result.confidence,
                    feature_metadata={
                        "problem_statement": result.problem_statement,
                        "desired_outcome": result.desired_outcome,
                        "user_persona": result.user_persona,
                        "use_case": result.use_case,
                        "keywords": result.keywords,
                        "sentiment": result.sentiment,
                    },
                )
                db.add(new_feature)
                db.flush()
                feature_id = new_feature.id
                # Add to existing features list for subsequent matches
                existing_features.append({
                    "id": str(feature_id),
                    "name": result.feature_title,
                    "description": result.feature_description[:200] if result.feature_description else "",
                    "theme_name": result.theme_name or "Uncategorized",
                    "mention_count": 1,
                })
                logger.info(f"Created new feature '{result.feature_title}'")

            # Link the source message to the feature (for mentions display)
            # Use parent_event since it has the source_table and source_record_id
            if feature_id:
                _link_message_to_feature(db, parent_event, feature_id)

            # Create ExtractedFact (for audit trail)
            content_hash = _compute_content_hash(chunk.chunk_text, result.feature_title)
            fact = ExtractedFact(
                workspace_id=chunk.workspace_id,
                normalized_event_id=parent_event.id,
                chunk_id=chunk.id,
                feature_id=feature_id,
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
                theme_confidence=result.theme_confidence,
                source_type=parent_event.source_type,
                source_id=parent_event.source_id,
                actor_name=chunk.speaker_name or parent_event.actor_name,
                actor_email=parent_event.actor_email,
                event_timestamp=parent_event.event_timestamp,
                content_hash=content_hash,
                aggregation_status="aggregated" if feature_id else "pending",
            )
            db.add(fact)

            # Update chunk
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
            import traceback
            traceback.print_exc()
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

"""
Tier-2 AI Structured Extraction Task

Extracts structured feature request data from classified content.
Only processes content that passed Tier-1 classification (score >= 6).

Classification Rules:
1. Every message MUST belong to a Theme
2. Every message MUST belong to a SubTheme (child of the assigned Theme)
3. Messages are matched against existing CustomerAsks in the SAME SubTheme:
   - If confidence >= 75%: Link to existing CustomerAsk
   - If confidence < 75% OR no CustomerAsks exist in SubTheme: Create new CustomerAsk
4. Messages are linked to their CustomerAsk via message.customer_ask_id
5. After linking, messages are queued for AI insights processing
"""

import logging
import hashlib
import re
from difflib import SequenceMatcher
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.normalized_event import NormalizedEvent, EventChunk
from app.models.extracted_fact import ExtractedFact
from app.models.theme import Theme
from app.models.sub_theme import SubTheme
from app.models.customer_ask import CustomerAsk
from app.models.message import Message
from app.models.message_customer_ask import MessageCustomerAsk
from app.services.tiered_ai_service import get_tiered_ai_service
from app.sync_engine.tasks.base import engine, cleanup_after_task, test_db_connection

logger = logging.getLogger(__name__)

EXTRACTION_BATCH_SIZE = 15
CUSTOMER_ASK_MATCH_THRESHOLD = 0.75  # 75% confidence to match existing CustomerAsk
TITLE_SIMILARITY_THRESHOLD = 0.90  # 90% title similarity = definite match (pre-AI check)
MAX_RETRIES = 3


def _normalize_title(title: str) -> str:
    """Normalize title for comparison - lowercase, remove punctuation, collapse whitespace."""
    if not title:
        return ""
    title = title.lower().strip()
    title = re.sub(r'[^\w\s]', '', title)
    title = re.sub(r'\s+', ' ', title)
    return title


def _title_similarity(title1: str, title2: str) -> float:
    """Calculate similarity ratio between two titles (0-1)."""
    norm1 = _normalize_title(title1)
    norm2 = _normalize_title(title2)
    if not norm1 or not norm2:
        return 0.0
    return SequenceMatcher(None, norm1, norm2).ratio()

# Invalid feature titles that should NOT create CustomerAsks
# These indicate the AI couldn't extract a valid feature request
INVALID_FEATURE_TITLES = {
    "no feature found",
    "no feature request",
    "extraction failed",
    "extraction error",
    "untitled feature",
    "untitled",
    "n/a",
    "none",
    "not applicable",
    "no request",
    "general feedback",
    "general comment",
    "no specific feature",
}


def _is_valid_feature_title(title: str) -> bool:
    """
    Check if the extracted feature title is valid and should create a CustomerAsk.

    Returns False for:
    - Empty/whitespace-only titles
    - Known invalid titles from AI (e.g., "No Feature Found")
    - Very short titles (< 5 chars)
    - Titles that are just generic placeholders
    """
    if not title:
        return False

    title_clean = title.strip().lower()

    # Check against known invalid titles
    if title_clean in INVALID_FEATURE_TITLES:
        return False

    # Check for partial matches (e.g., "No feature found in this text")
    for invalid in INVALID_FEATURE_TITLES:
        if title_clean.startswith(invalid):
            return False

    # Title too short to be meaningful
    if len(title_clean) < 5:
        return False

    return True


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.resync_message_links",
    bind=True,
    time_limit=300,
    soft_time_limit=270,
)
def resync_message_links_task(
    self,
    workspace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Celery task to re-sync message <-> CustomerAsk links.

    Call this to fix any messages that weren't properly linked during tier2 extraction.
    This uses ExtractedFacts to trace back to original messages.

    Usage:
        from app.sync_engine.tasks.ai_pipeline.tier2_extraction import resync_message_links_task
        resync_message_links_task.delay(workspace_id="your-workspace-uuid")
    """
    try:
        logger.info(f"🔄 Starting message link resync (workspace={workspace_id})")
        result = resync_message_customer_ask_links(workspace_id)
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"❌ Message link resync failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        cleanup_after_task()


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.extract_features",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=90,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=900,
    soft_time_limit=840,
)
def extract_features(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = EXTRACTION_BATCH_SIZE,
) -> Dict[str, Any]:
    """Extract structured feature data using Tier-2 AI.

    NOTE: No confidence filtering here - all messages that passed Tier-1
    classification (score >= 6) will be processed. This ensures we don't
    miss potential customer asks.
    """
    try:
        logger.info(f"Starting Tier-2 extraction (workspace={workspace_id})")

        with Session(engine) as db:
            if not test_db_connection(db):
                return {"status": "error", "reason": "database_connection_failed"}

            ai_service = get_tiered_ai_service()

            # If no workspace specified, find workspaces with items to process
            if not workspace_id:
                workspace_ids = _get_workspaces_with_pending_items(db)
                if not workspace_ids:
                    logger.info("No items to extract across any workspace")
                    return {"status": "success", "extracted": 0, "facts_created": 0, "matched": 0, "created": 0, "skipped": 0, "errors": 0}
            else:
                workspace_ids = [workspace_id]

            total = {"extracted": 0, "facts_created": 0, "matched": 0, "created": 0, "skipped": 0, "errors": 0}

            for ws_id in workspace_ids:
                themes = _get_workspace_themes(db, ws_id)

                if not themes:
                    logger.warning(f"No themes found for workspace {ws_id} - skipping")
                    continue

                # Track messages linked to CustomerAsks to avoid redundant DB queries
                linked_messages = set()

                # Process events and chunks for this workspace
                event_stats = _process_items(
                    db, ai_service, ws_id, batch_size // 2,
                    themes, item_type="event",
                    linked_messages=linked_messages,
                )

                chunk_stats = _process_items(
                    db, ai_service, ws_id, batch_size // 2,
                    themes, item_type="chunk",
                    linked_messages=linked_messages,
                )

                # Accumulate stats
                for key in total:
                    total[key] += event_stats.get(key, 0) + chunk_stats.get(key, 0)

            db.commit()

            logger.info(
                f"Tier-2 complete: {total['extracted']} processed, "
                f"{total['matched']} matched to existing, {total['created']} new CustomerAsks, "
                f"{total['skipped']} skipped (no valid feature), {total['errors']} errors"
            )

            # Trigger AI insights batch processing for linked messages
            if total['extracted'] > 0:
                from app.sync_engine.tasks.ai_insights.worker import process_pending_insights
                process_pending_insights.delay(workspace_id=workspace_id)
                logger.info("🔗 Triggered AI insights batch processing")

            return {"status": "success", **total}

    except Exception as e:
        logger.error(f"Tier-2 extraction failed: {e}")
        raise self.retry(exc=e, countdown=180)
    finally:
        cleanup_after_task()


def _get_workspaces_with_pending_items(db: Session) -> List[str]:
    """Find workspaces that have items ready for tier-2 extraction."""
    from sqlalchemy import distinct, union_all

    # Find workspace IDs from events ready for extraction
    event_ws = db.query(distinct(NormalizedEvent.workspace_id)).filter(
        NormalizedEvent.processing_stage == "classified",
        NormalizedEvent.extracted_at.is_(None),
        NormalizedEvent.is_chunked == False,
        NormalizedEvent.is_feature_relevant == True,
        NormalizedEvent.retry_count < MAX_RETRIES,
    )

    # Find workspace IDs from chunks ready for extraction
    chunk_ws = db.query(distinct(EventChunk.workspace_id)).filter(
        EventChunk.processing_stage == "classified",
        EventChunk.extracted_at.is_(None),
        EventChunk.is_feature_relevant == True,
        EventChunk.retry_count < MAX_RETRIES,
    )

    # Combine and get unique workspace IDs
    all_ws = event_ws.union(chunk_ws).all()
    return [str(ws[0]) for ws in all_ws if ws[0]]


def _get_workspace_themes(db: Session, workspace_id: Optional[str]) -> List[Dict[str, Any]]:
    """Get themes with sub_themes for AI classification."""
    if not workspace_id:
        return []

    workspace_uuid = UUID(workspace_id) if isinstance(workspace_id, str) else workspace_id
    themes = db.query(Theme).filter(Theme.workspace_id == workspace_uuid).all()

    result = []
    for t in themes:
        sub_themes = db.query(SubTheme).filter(SubTheme.theme_id == t.id).all()
        # Only include themes that have at least one sub_theme
        if sub_themes:
            result.append({
                "id": str(t.id),
                "name": t.name,
                "description": t.description or "",
                "sub_themes": [
                    {"id": str(st.id), "name": st.name, "description": st.description or ""}
                    for st in sub_themes
                ]
            })

    return result


def _get_customer_asks_for_sub_theme(db: Session, sub_theme_id: UUID) -> List[Dict[str, Any]]:
    """Get existing CustomerAsks for a specific SubTheme for matching."""
    customer_asks = db.query(CustomerAsk).filter(
        CustomerAsk.sub_theme_id == sub_theme_id
    ).order_by(CustomerAsk.mention_count.desc()).limit(30).all()

    return [
        {
            "id": str(ca.id),
            "name": ca.name,
            "description": (ca.description or "")[:300],
            "mention_count": ca.mention_count or 1,
        }
        for ca in customer_asks
    ]


def _validate_theme_classification(
    themes: List[Dict], classification
) -> tuple[Optional[UUID], Optional[UUID], str, str]:
    """
    Validate and extract UUIDs from AI theme classification result.

    Returns: (theme_id, sub_theme_id, theme_name, sub_theme_name)

    The AI returns IDs directly, but we validate they exist in our themes list.
    If validation fails, falls back to first available theme/sub_theme.
    """
    if not themes:
        return None, None, "", ""

    # Try to use AI-provided IDs
    ai_theme_id = classification.theme_id
    ai_sub_theme_id = classification.sub_theme_id
    ai_theme_name = classification.theme_name or ""
    ai_sub_theme_name = classification.sub_theme_name or ""

    # Validate theme_id exists
    matched_theme = None
    for theme in themes:
        if theme["id"] == ai_theme_id:
            matched_theme = theme
            break

    # Fallback: match by name if ID not found
    if not matched_theme and ai_theme_name:
        theme_name_lower = ai_theme_name.lower().strip()
        for theme in themes:
            if theme["name"].lower().strip() == theme_name_lower:
                matched_theme = theme
                break

    # Final fallback: use first theme
    if not matched_theme:
        matched_theme = themes[0]
        logger.warning(f"Theme ID '{ai_theme_id}' not found, using fallback: '{matched_theme['name']}'")

    theme_id = UUID(matched_theme["id"])
    theme_name = matched_theme["name"]

    # Validate sub_theme_id exists within matched theme
    sub_themes = matched_theme.get("sub_themes", [])
    if not sub_themes:
        logger.error(f"Theme '{theme_name}' has no sub_themes!")
        return None, None, "", ""

    matched_sub_theme = None
    for st in sub_themes:
        if st["id"] == ai_sub_theme_id:
            matched_sub_theme = st
            break

    # Fallback: match by name if ID not found
    if not matched_sub_theme and ai_sub_theme_name:
        sub_name_lower = ai_sub_theme_name.lower().strip()
        for st in sub_themes:
            if st["name"].lower().strip() == sub_name_lower:
                matched_sub_theme = st
                break

    # Final fallback: use first sub_theme
    if not matched_sub_theme:
        matched_sub_theme = sub_themes[0]
        if ai_sub_theme_id:
            logger.warning(f"SubTheme ID '{ai_sub_theme_id}' not found, using fallback: '{matched_sub_theme['name']}'")

    sub_theme_id = UUID(matched_sub_theme["id"])
    sub_theme_name = matched_sub_theme["name"]

    return theme_id, sub_theme_id, theme_name, sub_theme_name


def _process_items(
    db: Session,
    ai_service,
    workspace_id: Optional[str],
    batch_size: int,
    themes: List[Dict],
    item_type: str,
    linked_messages: Optional[set] = None,
) -> Dict[str, int]:
    """Process events or chunks for extraction.

    NOTE: No confidence filtering - all items that passed Tier-1 will be processed.
    No locking needed since we run a single worker.
    """
    stats = {"extracted": 0, "facts_created": 0, "matched": 0, "created": 0, "skipped": 0, "errors": 0}

    # Track messages already linked to avoid redundant DB queries
    if linked_messages is None:
        linked_messages = set()

    # Build query
    if item_type == "event":
        model = NormalizedEvent
        query = db.query(model).filter(
            model.processing_stage == "classified",
            model.extracted_at.is_(None),
            model.is_chunked == False,
            model.is_feature_relevant == True,
            model.retry_count < MAX_RETRIES,
        )
    else:
        model = EventChunk
        query = db.query(model).filter(
            model.processing_stage == "classified",
            model.extracted_at.is_(None),
            model.is_feature_relevant == True,
            model.retry_count < MAX_RETRIES,
        )

    if workspace_id:
        query = query.filter(model.workspace_id == UUID(workspace_id))

    items = query.order_by(model.created_at.asc()).limit(batch_size).all()

    if not items:
        return stats

    logger.info(f"Processing {len(items)} {item_type}s")

    for item in items:
        try:
            ws_id = item.workspace_id

            # Get text and context based on item type
            if item_type == "event":
                text = item.clean_text
                source_type = item.source_type
                actor_name = item.actor_name
                actor_role = item.actor_role
                title = item.title
                event = item
            else:
                parent = item.normalized_event
                if not parent:
                    _mark_extracted(item)
                    continue
                text = item.chunk_text
                source_type = parent.source_type
                actor_name = item.speaker_name or parent.actor_name
                actor_role = item.speaker_role or parent.actor_role
                title = parent.title
                event = parent

            # Step 1: Call AI to extract feature details
            result = ai_service.tier2_extract(
                text=text,
                source_type=source_type,
                actor_name=actor_name,
                actor_role=actor_role,
                title=title,
                themes=themes,
                existing_features=[],
            )

            # VALIDATION: Check if extracted feature is valid
            # This filters out items that passed Tier-1 but don't have a real feature request
            if not _is_valid_feature_title(result.feature_title):
                logger.info(
                    f"⏭️ Skipping {item_type} {item.id}: Invalid feature title '{result.feature_title}' "
                    f"(confidence: {result.confidence:.0%}) - no CustomerAsk created"
                )
                # Mark as processed so we don't retry, but don't create CustomerAsk
                _mark_extracted(item)
                stats["extracted"] += 1
                stats["skipped"] += 1
                continue

            # Step 2: Score-based theme and sub_theme classification
            theme_classification = ai_service.classify_theme_by_score(
                text=text,
                feature_title=result.feature_title,
                feature_description=result.feature_description,
                themes=themes,
            )

            # Validate and get UUIDs from classification result
            theme_id, sub_theme_id, theme_name, sub_theme_name = _validate_theme_classification(
                themes, theme_classification
            )

            if not theme_id or not sub_theme_id:
                logger.error(f"Could not assign theme/sub_theme for {item_type} {item.id}")
                item.retry_count = (item.retry_count or 0) + 1
                item.processing_error = "Failed to assign theme/sub_theme - check theme configuration"
                stats["errors"] += 1
                continue

            logger.info(
                f"Classified into Theme: '{theme_name}' (score: {theme_classification.theme_confidence:.0%}) > "
                f"SubTheme: '{sub_theme_name}' (score: {theme_classification.sub_theme_confidence:.0%})"
            )

            # Step 3: Get existing CustomerAsks in this sub_theme and match/create
            # NOTE: With many-to-many, each chunk can link to its own CustomerAsk.
            # We no longer skip extraction just because another chunk from same message was processed.
            existing_customer_asks = _get_customer_asks_for_sub_theme(db, sub_theme_id)

            # Match against existing CustomerAsks or create new
            customer_ask_id, was_matched = _match_or_create_customer_ask(
                db=db,
                ai_service=ai_service,
                result=result,
                text=text,
                existing_customer_asks=existing_customer_asks,
                workspace_id=ws_id,
                sub_theme_id=sub_theme_id,
                event_time=event.event_timestamp,
            )

            # Handle case where CustomerAsk creation was skipped (invalid feature)
            if customer_ask_id is None:
                logger.info(f"⏭️ No CustomerAsk created for {item_type} {item.id} (invalid feature)")
                _mark_extracted(item)
                stats["extracted"] += 1
                stats["skipped"] += 1
                continue

            if was_matched:
                stats["matched"] += 1
            else:
                stats["created"] += 1

            # Step 4: Link message to CustomerAsk via junction table (CRITICAL for mentions panel)
            # With many-to-many, each chunk can create its own link to a different CustomerAsk.
            # The junction table tracks which message is linked to which CustomerAsk.
            chunk_id = item.id if item_type == "chunk" else None
            _link_message_to_customer_ask_m2m(
                db=db,
                event=event,
                customer_ask_id=customer_ask_id,
                linked_pairs=linked_messages,  # Now tracks (message_id, customer_ask_id) pairs
                was_matched=was_matched,
                extraction_confidence=result.confidence,
                chunk_id=chunk_id,
            )

            # Create audit fact
            _create_extracted_fact(
                db, item, event, result, theme_id, customer_ask_id, item_type
            )

            # Mark processed
            _mark_extracted(item)
            stats["extracted"] += 1
            stats["facts_created"] += 1

        except Exception as e:
            logger.error(f"Error extracting {item_type} {item.id}: {e}")
            import traceback
            traceback.print_exc()
            item.retry_count = (item.retry_count or 0) + 1
            item.processing_error = str(e)[:400]
            stats["errors"] += 1

    # Update parent events for chunks
    if item_type == "chunk":
        _update_parent_events(db, workspace_id)

    return stats


def _match_or_create_customer_ask(
    db: Session,
    ai_service,
    result,
    text: str,
    existing_customer_asks: List[Dict],
    workspace_id: UUID,
    sub_theme_id: UUID,
    event_time: Optional[datetime],
) -> tuple[Optional[UUID], bool]:
    """
    Match against existing CustomerAsks or create new one.

    Rules:
    - If existing CustomerAsks exist in this sub_theme:
      - Use AI to find best match with confidence score
      - If confidence >= 75%: Link to existing (increment mention_count)
      - If confidence < 75%: Create new CustomerAsk
    - If NO existing CustomerAsks in sub_theme: Create new CustomerAsk

    Returns: (customer_ask_id, was_matched) - customer_ask_id is None if feature is invalid
    """
    # Defensive check: validate feature title before creating CustomerAsk
    if not _is_valid_feature_title(result.feature_title):
        logger.warning(f"⚠️ Invalid feature title in _match_or_create_customer_ask: '{result.feature_title}'")
        return None, False

    event_time = event_time or datetime.now(timezone.utc)

    # If there are existing CustomerAsks in this sub_theme, try to match
    if existing_customer_asks:
        logger.info(f"Found {len(existing_customer_asks)} existing CustomerAsks in sub_theme, attempting match...")

        # STEP 1: Pre-AI check - match by title similarity (catches obvious duplicates)
        # This prevents duplicate CustomerAsks when AI matching returns low confidence
        # for essentially identical feature titles extracted from different chunks
        for ca in existing_customer_asks:
            similarity = _title_similarity(result.feature_title, ca["name"])
            if similarity >= TITLE_SIMILARITY_THRESHOLD:
                # Found highly similar title - match without AI confirmation
                try:
                    ca_id = UUID(ca["id"])
                    ca_obj = db.query(CustomerAsk).filter(CustomerAsk.id == ca_id).first()
                    if ca_obj:
                        ca_obj.mention_count = (ca_obj.mention_count or 1) + 1
                        ca_obj.last_mentioned_at = event_time
                        logger.info(
                            f"✓ Matched by title similarity ({similarity:.0%}): '{ca_obj.name}' "
                            f"(mentions: {ca_obj.mention_count})"
                        )
                        return ca_id, True
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid CustomerAsk ID in title similarity check: {ca['id']}, error: {e}")

        # STEP 2: Use AI to find best matching CustomerAsk (for non-obvious matches)
        match_result = ai_service.match_customer_ask(
            text=text,
            feature_title=result.feature_title,
            feature_description=result.feature_description,
            existing_customer_asks=existing_customer_asks,
        )

        if match_result and match_result.matched_id and match_result.confidence >= CUSTOMER_ASK_MATCH_THRESHOLD:
            # Found a match with >= 75% confidence
            try:
                ca_id = UUID(match_result.matched_id)
                ca = db.query(CustomerAsk).filter(CustomerAsk.id == ca_id).first()
                if ca:
                    ca.mention_count = (ca.mention_count or 1) + 1
                    ca.last_mentioned_at = event_time
                    logger.info(
                        f"✓ Matched existing CustomerAsk '{ca.name}' "
                        f"(confidence: {match_result.confidence:.0%}, mentions: {ca.mention_count})"
                    )
                    return ca_id, True
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid matched_id: {match_result.matched_id}, error: {e}")
        else:
            confidence = match_result.confidence if match_result else 0
            logger.info(
                f"✗ No match above threshold (best: {confidence:.0%}, required: {CUSTOMER_ASK_MATCH_THRESHOLD:.0%}). "
                f"Creating new CustomerAsk."
            )
    else:
        logger.info("No existing CustomerAsks in sub_theme. Creating new CustomerAsk.")

    # Create new CustomerAsk
    new_ca = CustomerAsk(
        workspace_id=workspace_id,
        sub_theme_id=sub_theme_id,
        name=result.feature_title[:255],
        description=result.feature_description,
        urgency=_map_urgency(result.urgency_hint),
        status="new",
        mention_count=1,
        first_mentioned_at=event_time,
        last_mentioned_at=event_time,
        match_confidence=result.confidence,
        ai_metadata={
            "problem_statement": result.problem_statement,
            "desired_outcome": result.desired_outcome,
            "user_persona": result.user_persona,
            "use_case": result.use_case,
            "keywords": result.keywords,
            "sentiment": result.sentiment,
        },
    )
    db.add(new_ca)
    db.flush()

    logger.info(f"✓ Created new CustomerAsk: '{result.feature_title}'")
    return new_ca.id, False


def _mark_extracted(item) -> None:
    """Mark item as extracted."""
    now = datetime.now(timezone.utc)
    item.processing_stage = "extracted"
    item.extracted_at = now


def _map_urgency(hint: Optional[str]) -> str:
    """Map AI urgency hint to customer_ask urgency."""
    if not hint:
        return "medium"
    hint_lower = hint.lower()
    if hint_lower in ("high", "critical", "immediate", "asap"):
        return "critical"
    if hint_lower in ("low", "whenever", "no-rush"):
        return "low"
    return "medium"


def _link_message_to_customer_ask_m2m(
    db: Session,
    event: NormalizedEvent,
    customer_ask_id: UUID,
    linked_pairs: Optional[set] = None,
    was_matched: bool = False,
    extraction_confidence: Optional[float] = None,
    chunk_id: Optional[UUID] = None,
) -> bool:
    """
    Link message to CustomerAsk via junction table (many-to-many).

    This creates an entry in the message_customer_asks junction table, allowing
    a single message to be linked to multiple CustomerAsks (e.g., a call transcript
    with multiple feature requests).

    Also stores the tier1 classification score (feature_score) on the message for analytics.
    Also updates the deprecated customer_ask_id FK for backward compatibility.

    CRITICAL: This is the link that connects messages to CustomerAsks for the mentions panel.

    Args:
        db: Database session
        event: NormalizedEvent containing source_record_id (message_id)
        customer_ask_id: The CustomerAsk to link to
        linked_pairs: Set of (message_id, customer_ask_id) tuples already linked in this batch
        was_matched: Whether this was matched to existing CustomerAsk (vs created new)
        extraction_confidence: AI confidence score for this extraction
        chunk_id: Optional chunk ID if this came from a chunked message
    """
    # Log at INFO level to track linking
    logger.info(
        f"🔗 Linking message (M2M): event.id={event.id}, "
        f"source_table='{event.source_table}', source_record_id={event.source_record_id}, "
        f"customer_ask_id={customer_ask_id}"
    )

    # Validate source_table
    if not event.source_table:
        logger.error(f"❌ Event {event.id} has NULL source_table - cannot link message")
        return False

    if event.source_table != "messages":
        logger.warning(f"⚠️ Event {event.id} has source_table='{event.source_table}', expected 'messages'")
        return False

    # Validate source_record_id
    if not event.source_record_id:
        logger.error(f"❌ Event {event.id} has NULL source_record_id - cannot link message")
        return False

    message_id = event.source_record_id

    # Check if this exact (message_id, customer_ask_id) pair was already linked in this batch
    # This prevents duplicate junction table entries for the same pair
    link_pair = (message_id, customer_ask_id)
    if linked_pairs is not None and link_pair in linked_pairs:
        logger.debug(
            f"ℹ️ Message {message_id} already linked to CustomerAsk {customer_ask_id} in this batch - skipping"
        )
        return True  # Already linked, not a failure

    # Find the message in the database
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        logger.error(f"❌ Message not found in database: {message_id}")
        return False

    # Check if junction table entry already exists
    existing_link = db.query(MessageCustomerAsk).filter(
        MessageCustomerAsk.message_id == message_id,
        MessageCustomerAsk.customer_ask_id == customer_ask_id,
    ).first()

    if existing_link:
        logger.info(
            f"ℹ️ Junction entry already exists: Message {message_id} → CustomerAsk {customer_ask_id}"
        )
    else:
        # Determine if this is the first/primary link for this message
        existing_links_count = db.query(MessageCustomerAsk).filter(
            MessageCustomerAsk.message_id == message_id
        ).count()
        is_primary = existing_links_count == 0

        # Create junction table entry
        junction_entry = MessageCustomerAsk(
            message_id=message_id,
            customer_ask_id=customer_ask_id,
            extraction_confidence=extraction_confidence,
            match_reason="matched_existing" if was_matched else "created_new",
            is_primary=is_primary,
            chunk_id=chunk_id,
        )
        db.add(junction_entry)

        if is_primary:
            logger.info(
                f"✓ Created PRIMARY junction: Message {message_id} → CustomerAsk {customer_ask_id}"
            )
        else:
            logger.info(
                f"✓ Created junction: Message {message_id} → CustomerAsk {customer_ask_id} "
                f"(link #{existing_links_count + 1})"
            )

    # BACKWARD COMPAT: Also update deprecated customer_ask_id FK on message
    # Only set if not already set (preserve first/primary link)
    if message.customer_ask_id is None:
        message.customer_ask_id = customer_ask_id
        logger.info(f"✓ Set deprecated FK: message.customer_ask_id = {customer_ask_id}")

    # Store tier1 feature score on the message (classification_confidence is 0-1 range from tier1)
    # Convert back to 0-10 scale for consistency with tier1 scoring
    if event.classification_confidence is not None:
        tier1_score = event.classification_confidence * 10.0  # Convert 0-1 to 0-10 scale
        if message.feature_score != tier1_score:
            message.feature_score = tier1_score
            logger.info(f"✓ Stored tier1 feature_score={tier1_score:.1f} on message {message.id}")

    # Track linked pairs to avoid duplicate processing in this batch
    if linked_pairs is not None:
        linked_pairs.add(link_pair)

    return True


def _create_extracted_fact(
    db: Session, item, event: NormalizedEvent, result,
    theme_id: UUID, customer_ask_id: Optional[UUID], item_type: str
) -> None:
    """Create ExtractedFact audit record."""
    text = item.clean_text if item_type == "event" else item.chunk_text
    content_hash = hashlib.sha256(f"{result.feature_title}:{text[:500]}".lower().encode()).hexdigest()[:16]

    fact = ExtractedFact(
        workspace_id=item.workspace_id,
        normalized_event_id=event.id,
        chunk_id=item.id if item_type == "chunk" else None,
        customer_ask_id=customer_ask_id,
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
        actor_name=item.speaker_name if item_type == "chunk" and hasattr(item, 'speaker_name') else event.actor_name,
        actor_email=event.actor_email,
        event_timestamp=event.event_timestamp,
        content_hash=content_hash,
        aggregation_status="aggregated" if customer_ask_id else "pending",
    )
    db.add(fact)


def _update_parent_events(db: Session, workspace_id: Optional[str]) -> None:
    """Mark parent events as extracted when all chunks are done."""
    query = db.query(NormalizedEvent).filter(
        NormalizedEvent.processing_stage == "classified",
        NormalizedEvent.is_chunked == True,
    )
    if workspace_id:
        query = query.filter(NormalizedEvent.workspace_id == UUID(workspace_id))

    for event in query.all():
        pending = db.query(EventChunk).filter(
            EventChunk.normalized_event_id == event.id,
            EventChunk.processing_stage == "classified",
        ).count()

        if pending == 0:
            now = datetime.now(timezone.utc)
            event.processing_stage = "extracted"
            event.extracted_at = now


def resync_message_customer_ask_links(workspace_id: Optional[str] = None) -> Dict[str, int]:
    """
    Re-sync message <-> CustomerAsk links based on ExtractedFacts.

    This is a recovery function that can be called to fix messages that
    weren't properly linked during tier2 extraction. It uses ExtractedFacts
    (which have customer_ask_id) to trace back to the original messages
    through NormalizedEvents.

    Creates junction table entries (message_customer_asks) for many-to-many support.
    Also updates the deprecated customer_ask_id FK for backward compatibility.

    Usage:
        from app.sync_engine.tasks.ai_pipeline.tier2_extraction import resync_message_customer_ask_links
        result = resync_message_customer_ask_links("workspace-uuid")

    Returns: {"checked": N, "linked": M, "already_linked": K, "errors": E}
    """
    from sqlalchemy.orm import Session
    from app.sync_engine.tasks.base import engine

    stats = {"checked": 0, "linked": 0, "already_linked": 0, "not_found": 0, "errors": 0}

    with Session(engine) as db:
        # Find all ExtractedFacts that have a customer_ask_id
        query = db.query(ExtractedFact).filter(
            ExtractedFact.customer_ask_id.isnot(None)
        )
        if workspace_id:
            query = query.filter(ExtractedFact.workspace_id == UUID(workspace_id))

        facts = query.all()
        logger.info(f"🔄 Re-syncing message links (M2M): found {len(facts)} ExtractedFacts with customer_ask_id")

        for fact in facts:
            stats["checked"] += 1
            try:
                # Get the NormalizedEvent
                event = db.query(NormalizedEvent).filter(
                    NormalizedEvent.id == fact.normalized_event_id
                ).first()

                if not event:
                    logger.warning(f"NormalizedEvent not found: {fact.normalized_event_id}")
                    stats["errors"] += 1
                    continue

                if event.source_table != "messages" or not event.source_record_id:
                    logger.warning(
                        f"NormalizedEvent {event.id} has invalid source info: "
                        f"source_table='{event.source_table}', source_record_id={event.source_record_id}"
                    )
                    stats["errors"] += 1
                    continue

                message_id = event.source_record_id
                customer_ask_id = fact.customer_ask_id

                # Find the message
                message = db.query(Message).filter(Message.id == message_id).first()

                if not message:
                    logger.warning(f"Message not found: {message_id}")
                    stats["not_found"] += 1
                    continue

                # Check if junction table entry already exists
                existing_link = db.query(MessageCustomerAsk).filter(
                    MessageCustomerAsk.message_id == message_id,
                    MessageCustomerAsk.customer_ask_id == customer_ask_id,
                ).first()

                if existing_link:
                    stats["already_linked"] += 1
                else:
                    # Determine if this is the first/primary link for this message
                    existing_links_count = db.query(MessageCustomerAsk).filter(
                        MessageCustomerAsk.message_id == message_id
                    ).count()
                    is_primary = existing_links_count == 0

                    # Create junction table entry
                    junction_entry = MessageCustomerAsk(
                        message_id=message_id,
                        customer_ask_id=customer_ask_id,
                        extraction_confidence=fact.extraction_confidence,
                        match_reason="resync",
                        is_primary=is_primary,
                        chunk_id=fact.chunk_id,
                    )
                    db.add(junction_entry)

                    logger.info(
                        f"✓ Created junction: Message {message_id} → CustomerAsk {customer_ask_id} "
                        f"(primary={is_primary})"
                    )
                    stats["linked"] += 1

                # BACKWARD COMPAT: Also update deprecated customer_ask_id FK on message
                # Only set if not already set (preserve first/primary link)
                if message.customer_ask_id is None:
                    message.customer_ask_id = customer_ask_id
                    logger.info(f"✓ Set deprecated FK: message.customer_ask_id = {customer_ask_id}")

                # Also store tier1 score from NormalizedEvent if available
                if event.classification_confidence is not None and message.feature_score is None:
                    tier1_score = event.classification_confidence * 10.0  # Convert 0-1 to 0-10 scale
                    message.feature_score = tier1_score
                    logger.info(f"✓ Stored tier1 feature_score={tier1_score:.1f} on message {message.id}")

            except Exception as e:
                logger.error(f"Error processing ExtractedFact {fact.id}: {e}")
                stats["errors"] += 1

        db.commit()
        logger.info(
            f"🔄 Re-sync complete (M2M): {stats['checked']} checked, {stats['linked']} linked, "
            f"{stats['already_linked']} already linked, {stats['not_found']} not found, {stats['errors']} errors"
        )

    return stats

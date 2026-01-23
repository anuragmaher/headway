"""
AI Insights Worker - State-Driven Batch Processing

Generates AI insights for messages linked to CustomerAsks.

STATE-DRIVEN APPROACH:
- Queries messages WHERE customer_ask_id IS NOT NULL AND no AIInsight exists
- Processes in batches (no individual message queuing)
- Triggered automatically after tier2_extraction completes
- No duplicate processing - state-based filtering

Flow:
1. tier2_extraction links messages to CustomerAsks
2. tier2_extraction triggers process_pending_insights
3. This worker queries and processes messages missing insights
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.sync_engine.tasks.base import (
    engine,
    cleanup_after_task,
    test_db_connection,
)
from app.models.message import Message
from app.models.theme import Theme
from app.models.sub_theme import SubTheme
from app.models.customer_ask import CustomerAsk
from app.models.ai_insight import AIInsight
from app.services.ai_insights_service import get_ai_insights_service

logger = logging.getLogger(__name__)

# Constants
DEFAULT_MODEL_VERSION = "v1.0.0"
BATCH_SIZE = 20
MIN_CONTENT_LENGTH = 10


def get_available_themes(db: Session, workspace_id: uuid.UUID) -> List[Dict[str, Any]]:
    """Get all themes with their sub-themes for a workspace."""
    themes = db.query(Theme).filter(Theme.workspace_id == workspace_id).all()
    result = []
    for theme in themes:
        theme_data = {
            'id': str(theme.id),
            'name': theme.name,
            'description': theme.description,
            'sub_themes': []
        }
        sub_themes = db.query(SubTheme).filter(SubTheme.theme_id == theme.id).all()
        for st in sub_themes:
            theme_data['sub_themes'].append({
                'id': str(st.id),
                'name': st.name,
                'description': st.description,
            })
        result.append(theme_data)
    return result


def get_locked_theme_from_customer_ask(db: Session, message: Message) -> Optional[Dict[str, Any]]:
    """
    Get locked theme from customer_ask for a message.

    If the message is assigned to a customer_ask with a sub_theme,
    that theme/sub_theme is locked for the AI insights.
    """
    if not message.customer_ask_id:
        return None

    customer_ask = db.query(CustomerAsk).filter(
        CustomerAsk.id == message.customer_ask_id
    ).first()

    if not customer_ask or not customer_ask.sub_theme_id:
        return None

    sub_theme = db.query(SubTheme).filter(
        SubTheme.id == customer_ask.sub_theme_id
    ).first()

    if not sub_theme or not sub_theme.theme_id:
        return None

    theme = db.query(Theme).filter(Theme.id == sub_theme.theme_id).first()
    if theme:
        return {
            'id': str(theme.id),
            'name': theme.name,
            'sub_theme_id': str(sub_theme.id),
            'sub_theme_name': sub_theme.name,
        }
    return None


@celery_app.task(
    name="app.sync_engine.tasks.ai_insights.process_pending_insights",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=600,
    time_limit=660,
    acks_late=True,
)
def process_pending_insights(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = BATCH_SIZE,
    model_version: str = DEFAULT_MODEL_VERSION,
) -> Dict[str, Any]:
    """
    Process AI insights for messages linked to CustomerAsks but missing insights.

    STATE-DRIVEN: Queries database for messages that need processing.
    No individual message queuing - prevents duplicates.

    Criteria for processing:
    - message.customer_ask_id IS NOT NULL (linked to a CustomerAsk)
    - No existing AIInsight for this message+model_version
    - message.content length >= MIN_CONTENT_LENGTH

    Args:
        workspace_id: Optional workspace to limit processing
        batch_size: Number of messages to process per batch
        model_version: Version of the AI model/prompt

    Returns:
        Dict with processing stats
    """
    logger.info(f"🧠 Starting AI insights batch processing (workspace={workspace_id})")

    try:
        with Session(engine) as db:
            if not test_db_connection(db):
                return {"status": "error", "reason": "database_connection_failed"}

            # Find messages that need AI insights:
            # - Linked to CustomerAsk (customer_ask_id IS NOT NULL)
            # - No existing AIInsight record
            # - Has sufficient content

            # Subquery to find messages that already have insights
            messages_with_insights = db.query(AIInsight.message_id).filter(
                AIInsight.model_version == model_version
            ).subquery()

            # Query messages needing insights
            query = db.query(Message).filter(
                Message.customer_ask_id.isnot(None),  # Must be linked to CustomerAsk
            ).outerjoin(
                messages_with_insights,
                Message.id == messages_with_insights.c.message_id
            ).filter(
                messages_with_insights.c.message_id.is_(None)  # No existing insight
            )

            if workspace_id:
                query = query.filter(Message.workspace_id == uuid.UUID(workspace_id))

            # Order by sent_at to process oldest first
            messages = query.order_by(Message.sent_at.asc()).limit(batch_size).all()

            if not messages:
                logger.info("✓ No messages pending AI insights")
                return {
                    "status": "success",
                    "processed": 0,
                    "skipped": 0,
                    "errors": 0,
                }

            logger.info(f"Processing {len(messages)} messages for AI insights")

            ai_service = get_ai_insights_service()

            processed = 0
            skipped = 0
            errors = 0

            for message in messages:
                try:
                    # Skip if content too short
                    if not message.content or len(message.content.strip()) < MIN_CONTENT_LENGTH:
                        skipped += 1
                        continue

                    # Double-check no insight exists (race condition protection)
                    existing = db.query(AIInsight).filter(
                        and_(
                            AIInsight.message_id == message.id,
                            AIInsight.model_version == model_version,
                        )
                    ).first()

                    if existing:
                        logger.debug(f"Insight already exists for message {message.id}")
                        skipped += 1
                        continue

                    # Get themes and locked theme from customer_ask
                    available_themes = get_available_themes(db, message.workspace_id)
                    locked_theme = get_locked_theme_from_customer_ask(db, message)

                    # Generate insights
                    result = ai_service.generate_insights(
                        message_content=message.content,
                        available_themes=available_themes,
                        message_title=message.title,
                        source_type=message.source,
                        author_name=message.author_name,
                        author_role=None,
                        locked_theme=locked_theme,
                    )

                    # Create insight record
                    insight = AIInsight(
                        workspace_id=message.workspace_id,
                        message_id=message.id,
                        customer_ask_id=message.customer_ask_id,
                        model_version=model_version,
                        summary=result.summary,
                        pain_point=result.pain_point,
                        pain_point_quote=result.pain_point_quote,
                        feature_request=result.feature_request,
                        customer_usecase=result.customer_usecase,
                        sentiment=result.sentiment,
                        keywords=result.keywords,
                        tokens_used=result.tokens_used,
                    )

                    # Link to theme/sub_theme
                    if locked_theme:
                        insight.theme_id = uuid.UUID(locked_theme['id'])
                        if 'sub_theme_id' in locked_theme:
                            insight.sub_theme_id = uuid.UUID(locked_theme['sub_theme_id'])
                    elif result.themes and len(result.themes) > 0:
                        first_theme = result.themes[0]
                        theme_id = first_theme.get('theme_id')
                        if theme_id:
                            try:
                                insight.theme_id = uuid.UUID(theme_id)
                            except (ValueError, TypeError):
                                pass

                    db.add(insight)
                    processed += 1

                    logger.info(f"✓ Generated AI insights for message {message.id}")

                except Exception as e:
                    logger.error(f"Error processing message {message.id}: {e}")
                    errors += 1
                    continue

            db.commit()

            logger.info(
                f"✅ AI insights batch complete: {processed} processed, "
                f"{skipped} skipped, {errors} errors"
            )

            # If there are more messages to process, trigger another batch
            remaining = query.count()
            if remaining > 0:
                logger.info(f"🔄 {remaining} more messages pending, triggering next batch")
                process_pending_insights.delay(
                    workspace_id=workspace_id,
                    batch_size=batch_size,
                    model_version=model_version,
                )

            return {
                "status": "success",
                "processed": processed,
                "skipped": skipped,
                "errors": errors,
                "remaining": remaining,
            }

    except Exception as e:
        logger.error(f"AI insights batch processing failed: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=120)
    finally:
        cleanup_after_task()


# Backwards compatibility - redirect individual calls to batch processing
@celery_app.task(
    name="app.sync_engine.tasks.ai_insights.queue_message",
)
def queue_message_for_insights(
    message_id: str,
    workspace_id: str,
    model_version: str = DEFAULT_MODEL_VERSION,
    priority: int = 5,
) -> Dict[str, Any]:
    """
    DEPRECATED: Use process_pending_insights instead.

    This function now just triggers the batch processor.
    Kept for backwards compatibility during transition.
    """
    logger.info(f"📥 queue_message_for_insights called for {message_id} - redirecting to batch processor")

    # Don't queue individual messages - the batch processor will pick it up
    # This prevents duplicate processing
    return {
        "status": "redirected_to_batch",
        "message_id": message_id,
        "note": "Message will be processed by batch processor"
    }


@celery_app.task(
    name="app.sync_engine.tasks.ai_insights.process_single_message",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=120,
    time_limit=180,
    acks_late=True,
)
def process_single_message_insights(
    self,
    message_id: str,
    workspace_id: str,
    model_version: str = DEFAULT_MODEL_VERSION,
) -> Dict[str, Any]:
    """
    Process AI insights for a single message.

    NOTE: Prefer using process_pending_insights for batch processing.
    This is kept for direct/manual processing of specific messages.
    """
    logger.info(f"🧠 Processing AI insights for single message {message_id}")

    try:
        with Session(engine) as db:
            if not test_db_connection(db):
                return {"status": "error", "reason": "database_connection_failed"}

            message_uuid = uuid.UUID(message_id)
            workspace_uuid = uuid.UUID(workspace_id)

            # Check if insight already exists
            existing = db.query(AIInsight).filter(
                and_(
                    AIInsight.message_id == message_uuid,
                    AIInsight.model_version == model_version,
                )
            ).first()

            if existing:
                logger.info(f"✓ AI insights already exist for message {message_id}")
                return {
                    "status": "already_exists",
                    "message_id": message_id,
                    "insight_id": str(existing.id),
                }

            # Get message
            message = db.query(Message).filter(Message.id == message_uuid).first()
            if not message:
                return {
                    "status": "error",
                    "message_id": message_id,
                    "error": "Message not found",
                }

            # Check minimum content length
            if not message.content or len(message.content.strip()) < MIN_CONTENT_LENGTH:
                return {
                    "status": "not_eligible",
                    "message_id": message_id,
                    "reason": "Content too short",
                }

            # Get available themes and locked theme from customer_ask
            available_themes = get_available_themes(db, workspace_uuid)
            locked_theme = get_locked_theme_from_customer_ask(db, message)

            # Generate insights
            ai_service = get_ai_insights_service()
            result = ai_service.generate_insights(
                message_content=message.content,
                available_themes=available_themes,
                message_title=message.title,
                source_type=message.source,
                author_name=message.author_name,
                author_role=None,
                locked_theme=locked_theme,
            )

            # Create insight record
            insight = AIInsight(
                workspace_id=workspace_uuid,
                message_id=message_uuid,
                customer_ask_id=message.customer_ask_id,
                model_version=model_version,
                summary=result.summary,
                pain_point=result.pain_point,
                pain_point_quote=result.pain_point_quote,
                feature_request=result.feature_request,
                customer_usecase=result.customer_usecase,
                sentiment=result.sentiment,
                keywords=result.keywords,
                tokens_used=result.tokens_used,
            )

            # Link to theme/sub_theme
            if locked_theme:
                insight.theme_id = uuid.UUID(locked_theme['id'])
                if 'sub_theme_id' in locked_theme:
                    insight.sub_theme_id = uuid.UUID(locked_theme['sub_theme_id'])
            elif result.themes and len(result.themes) > 0:
                first_theme = result.themes[0]
                theme_id = first_theme.get('theme_id')
                if theme_id:
                    try:
                        insight.theme_id = uuid.UUID(theme_id)
                    except (ValueError, TypeError):
                        pass

            db.add(insight)
            db.commit()

            logger.info(f"✓ Created AI insights for message {message_id}")

            return {
                "status": "completed",
                "message_id": message_id,
                "insight_id": str(insight.id),
                "tokens_used": result.tokens_used,
            }

    except Exception as e:
        logger.error(f"Error processing AI insights for message {message_id}: {e}")
        raise self.retry(exc=e)
    finally:
        cleanup_after_task()

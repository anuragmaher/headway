"""
AI Insights Worker Tasks

Celery tasks for AI insights processing (runs on default queue).

IMPORTANT: AI insights are processed for messages that have been assigned to a customer_ask.
Messages with a customer_ask_id are eligible for AI insights processing.

Flow:
1. Message is ingested from source (Slack, Gmail, etc.)
2. Message goes through normalization and AI classification
3. If message is linked to a customer_ask (via customer_ask_id), it's eligible for insights
4. AI insights are extracted (themes, summary, pain_point, customer_usecase, etc.)

Features:
- Process one message at a time
- Idempotent processing
- Safe retry handling
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.sync_engine.tasks.base import (
    task_db_session,
    cleanup_after_task,
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
MAX_RETRY_COUNT = 3
LOCK_TIMEOUT_MINUTES = 30


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
        # Get sub-themes for this theme
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

    If the message is assigned to a customer_ask, and that customer_ask
    has a sub_theme with a parent theme, that theme is locked.
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


def is_message_eligible(message: Message) -> tuple[bool, str]:
    """
    Check if a message is eligible for AI insights processing.

    Messages with a customer_ask_id are eligible for AI insights.

    Args:
        message: Message to check

    Returns:
        Tuple of (eligible, reason)
    """
    # Check minimum content length
    if not message.content or len(message.content.strip()) < 10:
        return False, "Content too short"

    # Messages assigned to a customer_ask are eligible
    if message.customer_ask_id:
        return True, "Eligible (assigned to customer_ask)"

    # Messages without customer_ask can still be processed for general insights
    # This allows the system to extract themes and insights without requiring assignment
    return True, "Eligible (general processing)"


@celery_app.task(
    name="app.sync_engine.tasks.ai_insights.process_single_message",
    bind=True,
    max_retries=MAX_RETRY_COUNT,
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

    This is the core task that generates AI insights for one message.
    Processes one message at a time (no batching).

    Args:
        message_id: UUID of the message
        workspace_id: UUID of the workspace
        model_version: Version of the AI model/prompt

    Returns:
        Dict with processing result
    """
    logger.info(f"🧠 Processing AI insights for message {message_id}")

    try:
        with task_db_session() as db:
            message_uuid = uuid.UUID(message_id)
            workspace_uuid = uuid.UUID(workspace_id)

            # Check if insight already exists for this message + model_version
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

            # Check eligibility
            eligible, reason = is_message_eligible(message)
            if not eligible:
                logger.info(f"Message {message_id} not eligible for AI insights: {reason}")
                return {
                    "status": "not_eligible",
                    "message_id": message_id,
                    "reason": reason,
                }

            # Get available themes
            available_themes = get_available_themes(db, workspace_uuid)

            # Get locked theme from customer_ask
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
                model_version=model_version,
                summary=result.summary,
                pain_point=result.pain_point,
                pain_point_quote=getattr(result, 'pain_point_quote', None),
                feature_request=result.feature_request,
                customer_usecase=getattr(result, 'customer_usecase', None),
                sentiment=result.sentiment,
                keywords=result.keywords,
                tokens_used=result.tokens_used,
            )

            # Link to theme/sub_theme/customer_ask if available
            if locked_theme:
                insight.theme_id = uuid.UUID(locked_theme['id'])
                if 'sub_theme_id' in locked_theme:
                    insight.sub_theme_id = uuid.UUID(locked_theme['sub_theme_id'])
            elif result.themes and len(result.themes) > 0:
                # Try to find matching theme
                for available_theme in available_themes:
                    if available_theme['name'].lower() == result.themes[0].lower():
                        insight.theme_id = uuid.UUID(available_theme['id'])
                        break

            # Link to customer_ask if message has one
            if message.customer_ask_id:
                insight.customer_ask_id = message.customer_ask_id

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
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e)
    finally:
        cleanup_after_task()


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
    Queue a message for AI insights processing.

    Args:
        message_id: UUID of the message
        workspace_id: UUID of the workspace
        model_version: Version of the AI model/prompt
        priority: Task priority (lower = higher priority)

    Returns:
        Dict with queue status
    """
    logger.info(f"📥 Queuing message {message_id} for AI insights")

    try:
        with task_db_session() as db:
            message_uuid = uuid.UUID(message_id)

            # Check if already exists
            existing = db.query(AIInsight).filter(
                and_(
                    AIInsight.message_id == message_uuid,
                    AIInsight.model_version == model_version,
                )
            ).first()

            if existing:
                return {
                    "status": "already_exists",
                    "message_id": message_id,
                    "insight_id": str(existing.id),
                }

            # Dispatch processing task
            process_single_message_insights.apply_async(
                args=[message_id, workspace_id, model_version],
                priority=priority,
            )

            return {
                "status": "queued",
                "message_id": message_id,
            }

    except Exception as e:
        logger.error(f"Error queuing message {message_id}: {e}")
        return {
            "status": "error",
            "message_id": message_id,
            "error": str(e),
        }


@celery_app.task(
    name="app.sync_engine.tasks.ai_insights.process_fresh_messages",
    soft_time_limit=300,
    time_limit=360,
)
def process_fresh_messages(hours_back: int = 1, batch_size: int = 20) -> Dict[str, Any]:
    """
    Process AI insights for fresh messages.

    Args:
        hours_back: How far back to look for messages
        batch_size: Maximum messages to process per run

    Returns:
        Dict with processing stats
    """
    logger.info(f"🔍 Looking for fresh messages (last {hours_back}h)")

    try:
        with task_db_session() as db:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)

            # Subquery to find messages that already have insights
            insights_subq = db.query(AIInsight.message_id).filter(
                AIInsight.model_version == DEFAULT_MODEL_VERSION
            ).subquery()

            # Get messages that:
            # 1. Were created within the time window
            # 2. Don't already have AI insights
            # 3. Have sufficient content
            messages = db.query(Message).filter(
                and_(
                    Message.created_at >= cutoff,
                    Message.id.notin_(db.query(insights_subq)),
                    func.length(Message.content) >= 10,
                )
            ).order_by(Message.created_at.desc()).limit(batch_size).all()

            if not messages:
                logger.info("No fresh messages to process")
                return {"status": "ok", "processed": 0}

            queued_count = 0
            for message in messages:
                queue_message_for_insights.apply_async(
                    args=[str(message.id), str(message.workspace_id), DEFAULT_MODEL_VERSION],
                    priority=3,
                )
                queued_count += 1

            logger.info(f"✓ Queued {queued_count} fresh messages for AI insights")
            return {
                "status": "ok",
                "processed": queued_count,
                "total_found": len(messages),
            }

    except Exception as e:
        logger.error(f"Error processing fresh messages: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        cleanup_after_task()


@celery_app.task(
    name="app.sync_engine.tasks.ai_insights.backfill_insights",
    soft_time_limit=600,
    time_limit=720,
)
def backfill_insights(batch_size: int = 10, days_back: int = 30) -> Dict[str, Any]:
    """
    Backfill AI insights for older messages.

    Args:
        batch_size: Maximum messages to process per run
        days_back: How far back to look for messages

    Returns:
        Dict with processing stats
    """
    logger.info(f"📚 Running AI insights backfill (batch_size={batch_size}, days_back={days_back})")

    try:
        with task_db_session() as db:
            max_age_cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)

            # Subquery for messages with insights
            insights_subq = db.query(AIInsight.message_id).filter(
                AIInsight.model_version == DEFAULT_MODEL_VERSION
            ).subquery()

            # Find oldest messages that:
            # 1. Don't have insights
            # 2. Are within the age cutoff
            # 3. Have sufficient content
            messages = db.query(Message).filter(
                and_(
                    Message.created_at >= max_age_cutoff,
                    Message.id.notin_(db.query(insights_subq)),
                    func.length(Message.content) >= 10,
                )
            ).order_by(
                Message.created_at.asc(),
            ).limit(batch_size).all()

            if not messages:
                logger.info("No messages to backfill")
                return {"status": "ok", "processed": 0}

            queued_count = 0
            for message in messages:
                queue_message_for_insights.apply_async(
                    args=[str(message.id), str(message.workspace_id), DEFAULT_MODEL_VERSION],
                    priority=7,
                )
                queued_count += 1

            logger.info(f"✓ Queued {queued_count} messages for backfill")
            return {
                "status": "ok",
                "processed": queued_count,
                "total_found": len(messages),
            }

    except Exception as e:
        logger.error(f"Error in backfill: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        cleanup_after_task()

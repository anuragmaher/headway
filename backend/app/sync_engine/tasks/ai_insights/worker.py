"""
AI Insights Worker Tasks

Celery tasks for AI insights processing (runs on default queue).

IMPORTANT: AI insights are ONLY processed for messages that have passed Tier-2 extraction.
This means a message must be linked to at least one feature via the feature_messages table.
There is NO other way for a message to be eligible for AI insights.

Flow:
1. Message goes through Tier-1 classification (score 0-10)
2. If score >= 6, message goes to Tier-2 extraction
3. Tier-2 links message to a feature (new or existing)
4. After linking, message is automatically queued for AI insights
5. AI insights are extracted (themes, summary, pain_point, customer_usecase, etc.)

Features:
- Process one message at a time
- Rate limiting per workspace and global
- Idempotent processing
- Safe retry handling
- Progress tracking
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
from app.models.message import Message, feature_messages
from app.models.theme import Theme
from app.models.feature import Feature
from app.models.ai_message_insight import (
    AIMessageInsight,
    AIInsightsProgress,
    AIInsightsConfig,
)
from app.services.ai_insights_service import get_ai_insights_service

logger = logging.getLogger(__name__)

# Constants
DEFAULT_MODEL_VERSION = "v1.0.0"
MAX_RETRY_COUNT = 3
LOCK_TIMEOUT_MINUTES = 30
PROGRESS_WINDOW_DAYS = 7
# NOTE: MIN_SIGNAL_SCORE removed - AI insights only runs on Tier-2 passed messages


def get_or_create_config(db: Session) -> AIInsightsConfig:
    """Get or create the global AI insights config."""
    config = db.query(AIInsightsConfig).first()
    if not config:
        config = AIInsightsConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def get_or_create_progress(db: Session, workspace_id: uuid.UUID) -> AIInsightsProgress:
    """Get or create workspace progress tracking record."""
    progress = db.query(AIInsightsProgress).filter(
        AIInsightsProgress.workspace_id == workspace_id
    ).first()
    if not progress:
        progress = AIInsightsProgress(workspace_id=workspace_id)
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return progress


def check_rate_limits(db: Session, workspace_id: uuid.UUID) -> tuple[bool, str]:
    """
    Check if processing is allowed under rate limits.

    Returns:
        Tuple of (allowed, reason)
    """
    config = get_or_create_config(db)

    # Check global kill switch
    if not config.enabled:
        return False, "AI insights globally disabled"

    # Check global rate limits
    now = datetime.now(timezone.utc)

    # Reset minute counter if needed
    if not config.minute_reset_at or now >= config.minute_reset_at:
        config.current_minute_count = 0
        config.minute_reset_at = now + timedelta(minutes=1)

    # Reset hour counter if needed
    if not config.hour_reset_at or now >= config.hour_reset_at:
        config.current_hour_count = 0
        config.hour_reset_at = now + timedelta(hours=1)

    if config.current_minute_count >= config.global_rate_limit_per_minute:
        return False, f"Global minute rate limit ({config.global_rate_limit_per_minute}/min)"

    if config.current_hour_count >= config.global_rate_limit_per_hour:
        return False, f"Global hour rate limit ({config.global_rate_limit_per_hour}/hour)"

    # Check workspace rate limits
    progress = get_or_create_progress(db, workspace_id)

    if not progress.ai_insights_enabled:
        return False, "AI insights disabled for workspace"

    # Reset workspace minute counter if needed
    if not progress.minute_reset_at or now >= progress.minute_reset_at:
        progress.current_minute_count = 0
        progress.minute_reset_at = now + timedelta(minutes=1)

    # Reset workspace hour counter if needed
    if not progress.hour_reset_at or now >= progress.hour_reset_at:
        progress.current_hour_count = 0
        progress.hour_reset_at = now + timedelta(hours=1)

    if progress.current_minute_count >= progress.rate_limit_per_minute:
        return False, f"Workspace minute rate limit ({progress.rate_limit_per_minute}/min)"

    if progress.current_hour_count >= progress.rate_limit_per_hour:
        return False, f"Workspace hour rate limit ({progress.rate_limit_per_hour}/hour)"

    db.commit()
    return True, "OK"


def increment_rate_counters(db: Session, workspace_id: uuid.UUID) -> None:
    """Increment rate limit counters after processing."""
    config = get_or_create_config(db)
    config.current_minute_count += 1
    config.current_hour_count += 1

    progress = get_or_create_progress(db, workspace_id)
    progress.current_minute_count += 1
    progress.current_hour_count += 1

    db.commit()


def get_available_themes(db: Session, workspace_id: uuid.UUID) -> List[Dict[str, Any]]:
    """Get all themes for a workspace."""
    themes = db.query(Theme).filter(Theme.workspace_id == workspace_id).all()
    return [
        {
            'id': str(t.id),
            'name': t.name,
            'description': t.description,
        }
        for t in themes
    ]


def get_locked_theme(db: Session, message_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """
    Get locked theme from feature pipeline for a message.

    If the message has already been processed by the feature extraction pipeline
    and assigned to a feature with a theme, that theme is locked and cannot be overridden.
    """
    # Check if message has features with themes
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message or not message.features:
        return None

    # Get the most confident/recent feature's theme
    for feature in message.features:
        if feature.theme:
            return {
                'id': str(feature.theme_id),
                'name': feature.theme.name,
            }
    return None


def is_message_eligible(
    db: Session,
    message: Message,
    config: AIInsightsConfig,
) -> tuple[bool, str]:
    """
    Check if a message is eligible for AI insights processing.

    ONLY messages that have passed Tier-2 extraction (linked to a feature via
    feature_messages table) are eligible for AI insights. This is the ONLY
    eligibility criteria - no other metrics are used.

    Args:
        db: Database session
        message: Message to check
        config: Global config

    Returns:
        Tuple of (eligible, reason)
    """
    # Check minimum content length
    if not message.content or len(message.content.strip()) < 10:
        return False, "Content too short"

    # ONLY messages that passed Tier-2 (have feature links) are eligible
    # This is the ONLY criteria - a message must be linked to at least one feature
    feature_link = db.execute(
        feature_messages.select().where(
            feature_messages.c.message_id == message.id
        ).limit(1)
    ).first()

    if not feature_link:
        return False, "Not passed Tier-2 (no feature linked)"

    return True, "Eligible (passed Tier-2)"


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

            # Check rate limits
            allowed, reason = check_rate_limits(db, workspace_uuid)
            if not allowed:
                logger.warning(f"Rate limited: {reason}")
                # Retry later
                raise self.retry(countdown=30, exc=Exception(f"Rate limited: {reason}"))

            # Check if insight already exists for this message + model_version
            existing = db.query(AIMessageInsight).filter(
                and_(
                    AIMessageInsight.message_id == message_uuid,
                    AIMessageInsight.model_version == model_version,
                    AIMessageInsight.status == "completed",
                )
            ).first()

            if existing:
                logger.info(f"✓ AI insights already exist for message {message_id}")
                return {
                    "status": "already_exists",
                    "message_id": message_id,
                    "insight_id": str(existing.id),
                }

            # Get or create insight record
            insight = db.query(AIMessageInsight).filter(
                and_(
                    AIMessageInsight.message_id == message_uuid,
                    AIMessageInsight.model_version == model_version,
                )
            ).first()

            if not insight:
                insight = AIMessageInsight(
                    workspace_id=workspace_uuid,
                    message_id=message_uuid,
                    model_version=model_version,
                    status="queued",
                )
                db.add(insight)
                db.flush()

            # Check if already processing (with stale lock detection)
            if insight.status == "processing":
                if insight.locked_at:
                    lock_age = datetime.now(timezone.utc) - insight.locked_at
                    if lock_age < timedelta(minutes=LOCK_TIMEOUT_MINUTES):
                        logger.warning(f"Message {message_id} already being processed")
                        return {
                            "status": "already_processing",
                            "message_id": message_id,
                        }
                    # Stale lock - reset
                    logger.warning(f"Resetting stale lock for message {message_id}")

            # Acquire lock
            lock_token = uuid.uuid4()
            insight.status = "processing"
            insight.lock_token = lock_token
            insight.locked_at = datetime.now(timezone.utc)
            insight.started_at = datetime.now(timezone.utc)
            db.commit()

            # Get message
            message = db.query(Message).filter(Message.id == message_uuid).first()
            if not message:
                insight.status = "failed"
                insight.error_message = "Message not found"
                insight.lock_token = None
                insight.locked_at = None
                db.commit()
                return {
                    "status": "error",
                    "message_id": message_id,
                    "error": "Message not found",
                }

            # CRITICAL: Check if message passed Tier-2 (linked to a feature)
            # AI insights should ONLY run on messages that passed Tier-2 extraction
            config = get_or_create_config(db)
            eligible, reason = is_message_eligible(db, message, config)
            if not eligible:
                logger.info(f"Message {message_id} not eligible for AI insights: {reason}")
                # Mark as skipped, not failed
                insight.status = "failed"
                insight.error_message = f"Not eligible: {reason}"
                insight.lock_token = None
                insight.locked_at = None
                db.commit()
                return {
                    "status": "not_eligible",
                    "message_id": message_id,
                    "reason": reason,
                }

            # Get available themes
            available_themes = get_available_themes(db, workspace_uuid)

            # Get locked theme from feature pipeline
            locked_theme = get_locked_theme(db, message_uuid)

            # Generate insights
            ai_service = get_ai_insights_service()
            result = ai_service.generate_insights(
                message_content=message.content,
                available_themes=available_themes,
                message_title=message.title,
                source_type=message.source,
                author_name=message.author_name,
                author_role=None,  # Could extract from customer relationship
                locked_theme=locked_theme,
            )

            # Verify lock still held
            db.refresh(insight)
            if insight.lock_token != lock_token:
                logger.warning(f"Lock lost for message {message_id}")
                return {
                    "status": "lock_lost",
                    "message_id": message_id,
                }

            # Update insight record
            if result.error:
                insight.status = "failed"
                insight.error_message = result.error
                insight.retry_count += 1
            else:
                insight.status = "completed"
                insight.themes = result.themes
                insight.summary = result.summary
                insight.pain_point = result.pain_point
                insight.feature_request = result.feature_request
                insight.customer_usecase = result.customer_usecase
                insight.explanation = result.explanation
                insight.sentiment = result.sentiment
                insight.urgency = result.urgency
                insight.keywords = result.keywords
                insight.tokens_used = result.tokens_used
                insight.latency_ms = result.latency_ms

                if locked_theme:
                    insight.locked_theme_id = uuid.UUID(locked_theme['id'])
                    insight.locked_theme_name = locked_theme['name']

            insight.completed_at = datetime.now(timezone.utc)
            insight.lock_token = None
            insight.locked_at = None

            # Increment rate counters
            increment_rate_counters(db, workspace_uuid)

            db.commit()

            logger.info(f"✓ Completed AI insights for message {message_id}, status={insight.status}")

            return {
                "status": insight.status,
                "message_id": message_id,
                "insight_id": str(insight.id),
                "tokens_used": result.tokens_used,
                "latency_ms": result.latency_ms,
            }

    except Exception as e:
        logger.error(f"Error processing AI insights for message {message_id}: {e}")
        import traceback
        traceback.print_exc()

        # Update failure status
        try:
            with task_db_session() as db:
                insight = db.query(AIMessageInsight).filter(
                    and_(
                        AIMessageInsight.message_id == uuid.UUID(message_id),
                        AIMessageInsight.model_version == model_version,
                    )
                ).first()
                if insight:
                    insight.status = "failed"
                    insight.error_message = str(e)
                    insight.retry_count += 1
                    insight.lock_token = None
                    insight.locked_at = None
                    db.commit()
        except Exception:
            pass

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

    Creates the insight record in 'queued' status and dispatches
    the processing task.

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
            workspace_uuid = uuid.UUID(workspace_id)

            # Check if already exists
            existing = db.query(AIMessageInsight).filter(
                and_(
                    AIMessageInsight.message_id == message_uuid,
                    AIMessageInsight.model_version == model_version,
                )
            ).first()

            if existing and existing.status == "completed":
                return {
                    "status": "already_completed",
                    "message_id": message_id,
                    "insight_id": str(existing.id),
                }

            if existing and existing.status in ("queued", "processing"):
                return {
                    "status": f"already_{existing.status}",
                    "message_id": message_id,
                    "insight_id": str(existing.id),
                }

            # Create queued record
            if not existing:
                insight = AIMessageInsight(
                    workspace_id=workspace_uuid,
                    message_id=message_uuid,
                    model_version=model_version,
                    status="queued",
                )
                db.add(insight)
                db.commit()
                db.refresh(insight)
            else:
                insight = existing
                insight.status = "queued"
                insight.queued_at = datetime.now(timezone.utc)
                db.commit()

            # Dispatch processing task
            process_single_message_insights.apply_async(
                args=[message_id, workspace_id, model_version],
                priority=priority,
            )

            return {
                "status": "queued",
                "message_id": message_id,
                "insight_id": str(insight.id),
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
    Process AI insights for fresh messages that passed Tier-2.

    ONLY processes messages that have been linked to features via Tier-2 extraction.
    This is the ONLY criteria for AI insights eligibility.

    Args:
        hours_back: How far back to look for messages
        batch_size: Maximum messages to process per run

    Returns:
        Dict with processing stats
    """
    logger.info(f"🔍 Looking for fresh Tier-2 passed messages (last {hours_back}h)")

    try:
        with task_db_session() as db:
            config = get_or_create_config(db)

            if not config.enabled:
                logger.info("AI insights globally disabled")
                return {"status": "disabled", "processed": 0}

            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)

            # Subquery to find messages that already have insights
            insights_subq = db.query(AIMessageInsight.message_id).filter(
                AIMessageInsight.model_version == config.current_model_version
            ).subquery()

            # Subquery to get message IDs that have feature links (passed Tier-2)
            tier2_passed_subq = db.query(feature_messages.c.message_id).distinct().subquery()

            # Get messages that:
            # 1. Were created within the time window
            # 2. Don't already have AI insights
            # 3. Have passed Tier-2 (have feature links)
            messages = db.query(Message).filter(
                and_(
                    Message.created_at >= cutoff,
                    Message.id.notin_(db.query(insights_subq)),
                    Message.id.in_(db.query(tier2_passed_subq)),
                )
            ).order_by(Message.created_at.desc()).limit(batch_size).all()

            if not messages:
                logger.info("No fresh Tier-2 passed messages to process")
                return {"status": "ok", "processed": 0}

            queued_count = 0
            for message in messages:
                # Basic content check
                if not message.content or len(message.content.strip()) < 10:
                    logger.debug(f"Message {message.id} content too short")
                    continue

                # Queue for processing
                queue_message_for_insights.apply_async(
                    args=[str(message.id), str(message.workspace_id), config.current_model_version],
                    priority=3,  # Higher priority for fresh messages
                )
                queued_count += 1

            logger.info(f"✓ Queued {queued_count} fresh Tier-2 passed messages for AI insights")
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
def backfill_insights(batch_size: int = 10) -> Dict[str, Any]:
    """
    Backfill AI insights for older messages that passed Tier-2.

    ONLY processes messages that have been linked to features via Tier-2 extraction.
    This is the ONLY criteria for AI insights eligibility.

    Args:
        batch_size: Maximum messages to process per run

    Returns:
        Dict with processing stats
    """
    logger.info(f"📚 Running AI insights backfill for Tier-2 passed messages (batch_size={batch_size})")

    try:
        with task_db_session() as db:
            config = get_or_create_config(db)

            if not config.enabled:
                logger.info("AI insights globally disabled")
                return {"status": "disabled", "processed": 0}

            # Check if queue has pending items
            pending_count = db.query(func.count(AIMessageInsight.id)).filter(
                AIMessageInsight.status.in_(["queued", "processing"])
            ).scalar()

            if pending_count > batch_size:
                logger.info(f"Queue not idle ({pending_count} pending), skipping backfill")
                return {"status": "queue_not_idle", "pending": pending_count}

            # Calculate max age cutoff
            max_age_cutoff = datetime.now(timezone.utc) - timedelta(days=config.backfill_max_age_days)

            # Subquery for messages with insights
            insights_subq = db.query(AIMessageInsight.message_id).filter(
                AIMessageInsight.model_version == config.current_model_version
            ).subquery()

            # Subquery to get message IDs that have feature links (passed Tier-2)
            tier2_passed_subq = db.query(feature_messages.c.message_id).distinct().subquery()

            # Find oldest messages that:
            # 1. Don't have insights
            # 2. Have passed Tier-2 (have feature links)
            # 3. Are within the age cutoff
            messages_query = db.query(Message).filter(
                and_(
                    Message.created_at >= max_age_cutoff,
                    Message.id.notin_(db.query(insights_subq)),
                    Message.id.in_(db.query(tier2_passed_subq)),
                )
            ).order_by(
                Message.created_at.asc(),  # Oldest first
            ).limit(config.backfill_batch_size)

            messages = messages_query.all()

            if not messages:
                logger.info("No Tier-2 passed messages to backfill")
                return {"status": "ok", "processed": 0}

            queued_count = 0
            for message in messages:
                # Basic content check
                if not message.content or len(message.content.strip()) < 10:
                    logger.debug(f"Message {message.id} content too short")
                    continue

                # Queue for processing with lower priority
                queue_message_for_insights.apply_async(
                    args=[str(message.id), str(message.workspace_id), config.current_model_version],
                    priority=7,  # Lower priority for backfill
                )
                queued_count += 1

            logger.info(f"✓ Queued {queued_count} Tier-2 passed messages for backfill")
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


@celery_app.task(
    name="app.sync_engine.tasks.ai_insights.update_progress",
    soft_time_limit=60,
    time_limit=120,
)
def update_progress_stats() -> Dict[str, Any]:
    """
    Update progress statistics for all workspaces.

    Calculates completion rates for recent messages (configurable window).
    Used by UI progress bar.

    Returns:
        Dict with update stats
    """
    logger.info("📊 Updating AI insights progress stats")

    try:
        with task_db_session() as db:
            config = get_or_create_config(db)

            # Get all workspaces with messages
            from app.models.workspace import Workspace
            workspaces = db.query(Workspace).filter(Workspace.is_active == True).all()

            updated_count = 0
            for workspace in workspaces:
                progress = get_or_create_progress(db, workspace.id)

                # Calculate cutoff for progress window
                cutoff = datetime.now(timezone.utc) - timedelta(days=progress.progress_window_days)

                # Count eligible messages in window
                total_messages = db.query(func.count(Message.id)).filter(
                    and_(
                        Message.workspace_id == workspace.id,
                        Message.created_at >= cutoff,
                    )
                ).scalar()

                # Count insights by status
                insights_stats = db.query(
                    AIMessageInsight.status,
                    func.count(AIMessageInsight.id)
                ).filter(
                    and_(
                        AIMessageInsight.workspace_id == workspace.id,
                        AIMessageInsight.model_version == config.current_model_version,
                        AIMessageInsight.created_at >= cutoff,
                    )
                ).group_by(AIMessageInsight.status).all()

                stats_dict = dict(insights_stats)

                progress.total_eligible = total_messages or 0
                progress.completed_count = stats_dict.get("completed", 0)
                progress.pending_count = stats_dict.get("queued", 0)
                progress.processing_count = stats_dict.get("processing", 0)
                progress.failed_count = stats_dict.get("failed", 0)
                progress.last_sync_at = datetime.now(timezone.utc)

                # Calculate processing rate (messages per hour over last hour)
                hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
                recent_completed = db.query(func.count(AIMessageInsight.id)).filter(
                    and_(
                        AIMessageInsight.workspace_id == workspace.id,
                        AIMessageInsight.status == "completed",
                        AIMessageInsight.completed_at >= hour_ago,
                    )
                ).scalar()

                progress.avg_processing_rate_per_hour = recent_completed or 0
                progress.last_rate_calculation = datetime.now(timezone.utc)

                updated_count += 1

            db.commit()

            logger.info(f"✓ Updated progress stats for {updated_count} workspaces")
            return {
                "status": "ok",
                "workspaces_updated": updated_count,
            }

    except Exception as e:
        logger.error(f"Error updating progress stats: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        cleanup_after_task()


@celery_app.task(
    name="app.sync_engine.tasks.ai_insights.cleanup_stale",
    soft_time_limit=60,
    time_limit=120,
)
def cleanup_stale_insights() -> Dict[str, Any]:
    """
    Cleanup stale processing states.

    Resets insights stuck in 'processing' state back to 'queued'.

    Returns:
        Dict with cleanup stats
    """
    logger.info("🧹 Cleaning up stale AI insights processing states")

    try:
        with task_db_session() as db:
            stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=LOCK_TIMEOUT_MINUTES)

            # Find stale processing records
            stale_insights = db.query(AIMessageInsight).filter(
                and_(
                    AIMessageInsight.status == "processing",
                    or_(
                        AIMessageInsight.locked_at == None,
                        AIMessageInsight.locked_at < stale_cutoff,
                    )
                )
            ).all()

            reset_count = 0
            for insight in stale_insights:
                if insight.retry_count < MAX_RETRY_COUNT:
                    insight.status = "queued"
                    insight.lock_token = None
                    insight.locked_at = None
                    reset_count += 1

                    # Re-queue for processing
                    queue_message_for_insights.apply_async(
                        args=[str(insight.message_id), str(insight.workspace_id), insight.model_version],
                        priority=5,
                    )
                else:
                    insight.status = "failed"
                    insight.error_message = "Max retries exceeded"
                    insight.lock_token = None
                    insight.locked_at = None

            db.commit()

            logger.info(f"✓ Reset {reset_count} stale insights, {len(stale_insights) - reset_count} marked failed")
            return {
                "status": "ok",
                "reset": reset_count,
                "failed": len(stale_insights) - reset_count,
            }

    except Exception as e:
        logger.error(f"Error cleaning up stale insights: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        cleanup_after_task()

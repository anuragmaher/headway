"""
AI Insights Celery Tasks

Tasks for AI insights processing (runs on default celery queue).

Features:
- Rate-limited processing
- Processes one message at a time
- Idempotent with progress tracking
"""

from app.sync_engine.tasks.ai_insights.worker import (
    process_single_message_insights,
    queue_message_for_insights,
    process_fresh_messages,
    backfill_insights,
    update_progress_stats,
    cleanup_stale_insights,
)

__all__ = [
    "process_single_message_insights",
    "queue_message_for_insights",
    "process_fresh_messages",
    "backfill_insights",
    "update_progress_stats",
    "cleanup_stale_insights",
]

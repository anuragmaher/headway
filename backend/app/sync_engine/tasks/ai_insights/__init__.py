"""
AI Insights Celery Tasks

Dedicated worker and queue for AI insights processing.
Queue name: ai_insights

Features:
- Low priority, rate-limited processing
- Safe to pause/scale independently
- Does not block ingestion or feature extraction
- Processes one message at a time
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

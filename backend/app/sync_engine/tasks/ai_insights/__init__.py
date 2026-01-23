"""
AI Insights Celery Tasks

Tasks for AI insights processing.

AI insights are processed on-demand when messages are linked to CustomerAsks
during the tier2_extraction pipeline.
"""

from app.sync_engine.tasks.ai_insights.worker import (
    process_single_message_insights,
    queue_message_for_insights,
)

__all__ = [
    "process_single_message_insights",
    "queue_message_for_insights",
]

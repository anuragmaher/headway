"""
Celery application configuration for background tasks and scheduled jobs

Memory optimization settings for production:
- worker_max_tasks_per_child: Restart workers after N tasks to prevent memory leaks
- worker_prefetch_multiplier: Limit task prefetching to reduce memory
- task_acks_late: Acknowledge tasks after completion for better reliability
- worker_max_memory_per_child: Kill workers exceeding memory limit (Linux only)
"""

import sys
from celery import Celery
from celery.schedules import schedule
from app.core.config import Settings
import logging

logger = logging.getLogger(__name__)

settings = Settings()

# Initialize Celery app
celery_app = Celery(
    "headway",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        # === DATA INGESTION TASKS ===
        "app.sync_engine.tasks.periodic.health",
        "app.sync_engine.tasks.periodic.slack",
        "app.sync_engine.tasks.periodic.gmail",
        "app.sync_engine.tasks.periodic.gong",
        "app.sync_engine.tasks.periodic.fathom",
        # === ON-DEMAND TASKS (user-triggered) ===
        "app.sync_engine.tasks.ondemand.gmail",
        "app.sync_engine.tasks.ondemand.slack",
        "app.sync_engine.tasks.ondemand.gong",
        "app.sync_engine.tasks.ondemand.fathom",
        "app.sync_engine.tasks.ondemand.themes",
        # === AI PIPELINE (state-driven tiered processing) ===
        "app.sync_engine.tasks.ai_pipeline.normalization",
        "app.sync_engine.tasks.ai_pipeline.chunking",
        "app.sync_engine.tasks.ai_pipeline.tier1_classification",
        "app.sync_engine.tasks.ai_pipeline.tier2_extraction",
        "app.sync_engine.tasks.ai_pipeline.tier3_aggregation",
        # === AI INSIGHTS (dedicated per-message insights) ===
        "app.sync_engine.tasks.ai_insights.worker",
    ]
)

# Auto-discover tasks from sync_engine
celery_app.autodiscover_tasks([
    'app.sync_engine.tasks',
    'app.sync_engine.tasks.periodic',
    'app.sync_engine.tasks.ondemand',
    'app.sync_engine.tasks.ai_pipeline',
    'app.sync_engine.tasks.ai_insights',
], force=True)

# Configure Celery with memory optimization for production
celery_config = {
    # Serialization
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,

    # Task tracking
    "task_track_started": True,

    # Time limits
    "task_time_limit": 30 * 60,  # 30 minutes hard limit
    "task_soft_time_limit": 25 * 60,  # 25 minutes soft limit

    # === MEMORY OPTIMIZATION SETTINGS ===

    # Restart worker after completing 50 tasks to prevent memory leaks
    # This is CRITICAL for long-running workers
    "worker_max_tasks_per_child": 50,

    # Only prefetch 1 task at a time (default is 4)
    # Reduces memory usage when tasks are memory-intensive
    "worker_prefetch_multiplier": 1,

    # Acknowledge tasks after they complete (not before)
    # Ensures tasks aren't lost if worker crashes
    "task_acks_late": True,

    # Reject tasks if worker is shutting down (re-queue them)
    "task_reject_on_worker_lost": True,

    # Don't store task results by default (saves Redis memory)
    # Individual tasks can override with ignore_result=False
    "task_ignore_result": True,

    # Result expiration (1 hour) - cleanup old results
    "result_expires": 3600,

    # Disable task events to reduce overhead (enable only if using Flower)
    "worker_send_task_events": False,
    "task_send_sent_event": False,

    # Connection pool optimization for Redis
    "broker_pool_limit": 3,  # Limit Redis connections
    "broker_connection_retry_on_startup": True,

    # Beat schedule persistence
    "beat_scheduler": "celery.beat:PersistentScheduler",

    # Default queue for all tasks (single worker architecture)
    "task_default_queue": "celery",
}

# Platform-specific settings
if sys.platform == "win32":
    # Windows: Use solo pool (single process, no forking)
    celery_config["worker_pool"] = "solo"
    celery_config["worker_concurrency"] = 1
else:
    # Linux/Mac: Use prefork pool with limited concurrency
    celery_config["worker_pool"] = "prefork"
    celery_config["worker_concurrency"] = 2  # Limit to 2 workers
    # Memory limit per worker child (512MB) - Linux only
    celery_config["worker_max_memory_per_child"] = 512000  # in KB = 512MB

celery_app.conf.update(**celery_config)

# Configure periodic tasks (Celery Beat schedule)
# All tasks check for active connections before syncing
# Note: Using default queue for all tasks to avoid queue configuration issues
celery_app.conf.beat_schedule = {
    # Health check every 5 minutes
    "health-check": {
        "task": "app.sync_engine.sync_tasks.health_check",
        "schedule": schedule(run_every=300),  # 300 seconds = 5 minutes
    },
    # Slack sync every 30 minutes
    "sync-slack-messages": {
        "task": "app.sync_engine.sync_tasks.sync_slack_periodic",
        "schedule": schedule(run_every=1800),  # 1800 seconds = 30 minutes
    },
    # Gong sync every 30 minutes (staggered by 20 seconds)
    "sync-gong-calls": {
        "task": "app.sync_engine.sync_tasks.sync_gong_periodic",
        "schedule": schedule(run_every=1820),  # 1820 seconds = 30m 20s (staggered)
    },
    # Fathom sync every 30 minutes (staggered by 40 seconds)
    "sync-fathom-sessions": {
        "task": "app.sync_engine.sync_tasks.sync_fathom_periodic",
        "schedule": schedule(run_every=1840),  # 1840 seconds = 30m 40s (staggered)
    },
    # Gmail sync every 30 minutes (staggered by 60 seconds)
    "sync-gmail-threads": {
        "task": "app.sync_engine.sync_tasks.sync_gmail_periodic",
        "schedule": schedule(run_every=1860),  # 1860 seconds = 31 minutes (staggered)
    },

    # === AI PIPELINE ===
    # FULLY STATE-DRIVEN ARCHITECTURE - No scheduled AI tasks!
    #
    # Pipeline is triggered automatically when new messages are ingested:
    # ingestion → normalize → chunk → classify → extract → AI insights
    #
    # Each stage triggers the next immediately upon completion.
    # No time-based scheduling - purely event-driven.
}

logger.info(f"Celery app initialized with broker: {settings.REDIS_URL}")
logger.info("Data Ingestion (periodic):")
logger.info("  - Slack: every 30 min | Gong: every 30m 20s | Fathom: every 30m 40s | Gmail: every 31 min")
logger.info("AI Pipeline (STATE-DRIVEN - triggered on ingestion):")
logger.info("  ingestion → normalize → chunk → classify → extract → AI insights")
logger.info("  Each stage triggers the next immediately - no scheduled tasks")
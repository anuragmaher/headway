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
        "app.sync_engine.tasks.ai_pipeline.signal_scoring",
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

    # === QUEUE ROUTING ===
    # Route ai_insights tasks to dedicated queue for independent scaling
    "task_routes": {
        "app.sync_engine.tasks.ai_insights.*": {"queue": "ai_insights"},
    },

    # Queue definitions with priority support
    "task_queues": {
        "celery": {"exchange": "celery", "routing_key": "celery"},
        "ai_insights": {"exchange": "ai_insights", "routing_key": "ai_insights"},
    },

    # Default queue for tasks without explicit routing
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
    # Slack sync every 1 minute for testing, then increase to 15 minutes
    "sync-slack-messages": {
        "task": "app.sync_engine.sync_tasks.sync_slack_periodic",
        "schedule": schedule(run_every=900),  # 900 seconds = 15 minutes
    },
    # Gong sync every 15 minutes (staggered by 5 minutes)
    "sync-gong-calls": {
        "task": "app.sync_engine.sync_tasks.sync_gong_periodic",
        "schedule": schedule(run_every=920),  # 920 seconds = 15m 20s (staggered)
    },
    # Fathom sync every 15 minutes (staggered by 10 minutes)
    "sync-fathom-sessions": {
        "task": "app.sync_engine.sync_tasks.sync_fathom_periodic",
        "schedule": schedule(run_every=940),  # 940 seconds = 15m 40s (staggered)
    },
    # Gmail sync every 15 minutes (staggered by 15 minutes)
    "sync-gmail-threads": {
        "task": "app.sync_engine.sync_tasks.sync_gmail_periodic",
        "schedule": schedule(run_every=960),  # 960 seconds = 16 minutes (staggered)
    },

    # === AI PIPELINE (Tiered Processing) ===
    # State-driven pipeline with automatic chaining:
    # normalization -> signal_scoring -> chunking -> classification -> extraction -> aggregation
    #
    # Each task triggers the next stage automatically when it completes processing.
    # These scheduled tasks serve as "catch-up" mechanisms to process any missed items.

    # Step 1: Normalize raw data into NormalizedEvents (entry point)
    # Triggers signal_scoring automatically when items are normalized
    "ai-pipeline-normalize": {
        "task": "app.sync_engine.tasks.ai_pipeline.normalize_source_data",
        "schedule": schedule(run_every=300),  # Every 5 minutes (catch-up)
    },

    # Step 2-6: Catch-up tasks for each pipeline stage
    # These run infrequently since chaining handles the normal flow
    # They only serve as backup to catch any missed items
    "ai-pipeline-signal-score": {
        "task": "app.sync_engine.tasks.ai_pipeline.score_normalized_events",
        "schedule": schedule(run_every=900),  # Every 15 minutes (catch-up only)
    },

    "ai-pipeline-chunk": {
        "task": "app.sync_engine.tasks.ai_pipeline.chunk_normalized_events",
        "schedule": schedule(run_every=900),  # Every 15 minutes (catch-up only)
    },

    "ai-pipeline-classify": {
        "task": "app.sync_engine.tasks.ai_pipeline.classify_events",
        "schedule": schedule(run_every=900),  # Every 15 minutes (catch-up only)
    },

    "ai-pipeline-extract": {
        "task": "app.sync_engine.tasks.ai_pipeline.extract_features",
        "schedule": schedule(run_every=900),  # Every 15 minutes (catch-up only)
    },

    "ai-pipeline-aggregate": {
        "task": "app.sync_engine.tasks.ai_pipeline.aggregate_facts",
        "schedule": schedule(run_every=1800),  # Every 30 minutes (catch-up only)
    },

    # Cleanup old aggregated facts (daily)
    "ai-pipeline-cleanup": {
        "task": "app.sync_engine.tasks.ai_pipeline.cleanup_old_facts",
        "schedule": schedule(run_every=86400),  # Every 24 hours
    },

    # Cleanup stale processing states (every 15 minutes)
    # Resets facts/events stuck in processing state back to pending
    "ai-pipeline-cleanup-stale": {
        "task": "app.sync_engine.tasks.ai_pipeline.cleanup_stale_processing",
        "schedule": schedule(run_every=900),  # Every 15 minutes
    },

    # === AI INSIGHTS (Per-Message Insights) ===
    # Dedicated queue for AI insights - safe to pause/scale independently
    # Does NOT block ingestion or feature extraction

    # Process fresh messages (Mode A): Shortly after normalization
    # Queues recently created messages for AI insights
    "ai-insights-fresh-messages": {
        "task": "app.sync_engine.tasks.ai_insights.process_fresh_messages",
        "schedule": schedule(run_every=300),  # Every 5 minutes
        "options": {"queue": "ai_insights"},
    },

    # Backfill older messages (Mode B): When queue is idle
    # Small batches, oldest or highest-signal first
    "ai-insights-backfill": {
        "task": "app.sync_engine.tasks.ai_insights.backfill_insights",
        "schedule": schedule(run_every=1800),  # Every 30 minutes
        "options": {"queue": "ai_insights"},
    },

    # Update progress stats for UI progress bar
    "ai-insights-progress-update": {
        "task": "app.sync_engine.tasks.ai_insights.update_progress",
        "schedule": schedule(run_every=60),  # Every minute
        "options": {"queue": "ai_insights"},
    },

    # Cleanup stale AI insights processing states
    "ai-insights-cleanup-stale": {
        "task": "app.sync_engine.tasks.ai_insights.cleanup_stale",
        "schedule": schedule(run_every=900),  # Every 15 minutes
        "options": {"queue": "ai_insights"},
    },
}

logger.info(f"Celery app initialized with broker: {settings.REDIS_URL}")
logger.info("Sync Engine - Data ingestion tasks:")
logger.info("  - Health check: every 5 minutes")
logger.info("  - Slack sync: every 15 minutes")
logger.info("  - Gong sync: every 15 minutes")
logger.info("  - Fathom sync: every 15 minutes")
logger.info("  - Gmail sync: every 16 minutes")
logger.info("AI Pipeline - State-driven with automatic chaining:")
logger.info("  Flow: normalize -> score -> chunk -> classify -> extract -> aggregate")
logger.info("  Each stage triggers the next automatically when items are processed.")
logger.info("  Scheduled tasks (every 5 min) serve as catch-up for missed items.")
logger.info("  - Stale cleanup: every 15 minutes")
logger.info("  - Old facts cleanup: every 24 hours")
logger.info("AI Insights - Dedicated queue for per-message insights:")
logger.info("  Queue: ai_insights (low priority, rate-limited)")
logger.info("  - Fresh messages: every 5 minutes")
logger.info("  - Backfill: every 30 minutes (when queue idle)")
logger.info("  - Progress update: every minute")
logger.info("  - Stale cleanup: every 15 minutes")
"""
Celery application configuration for background tasks and scheduled jobs

Memory optimization settings for production:
- worker_max_tasks_per_child: Restart workers after N tasks to prevent memory leaks
- worker_prefetch_multiplier: Limit task prefetching to reduce memory
- task_acks_late: Acknowledge tasks after completion for better reliability
- worker_max_memory_per_child: Kill workers exceeding memory limit (Linux only)

Langfuse OpenTelemetry tracing is initialized when workers start to trace
all AI/LLM calls in background tasks.
"""

import sys
from celery import Celery
from celery.schedules import schedule
from celery.signals import worker_process_init, worker_process_shutdown
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
        # === TRANSCRIPT PROCESSING ===
        "app.sync_engine.tasks.ai_pipeline.transcript_processing",
    ]
)

# Auto-discover tasks from sync_engine
celery_app.autodiscover_tasks([
    'app.sync_engine.tasks',
    'app.sync_engine.tasks.periodic',
    'app.sync_engine.tasks.ondemand',
    'app.sync_engine.tasks.ai_pipeline',
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
    # Gong sync every 1 hour (also supports on-demand via Sources API)
    "sync-gong-calls": {
        "task": "app.sync_engine.sync_tasks.sync_gong_periodic",
        "schedule": schedule(run_every=3600),  # 3600 seconds = 1 hour
    },
    # Fathom sync every 1 hour (also supports on-demand via Sources API)
    "sync-fathom-sessions": {
        "task": "app.sync_engine.sync_tasks.sync_fathom_periodic",
        "schedule": schedule(run_every=3600),  # 3600 seconds = 1 hour
    },
    # Gmail sync every 30 minutes (staggered by 60 seconds)
    "sync-gmail-threads": {
        "task": "app.sync_engine.sync_tasks.sync_gmail_periodic",
        "schedule": schedule(run_every=1860),  # 1860 seconds = 31 minutes (staggered)
    },

    # === TRANSCRIPT PROCESSING ===
    # Process raw transcripts every 2 minutes
    "process-raw-transcripts": {
        "task": "app.sync_engine.tasks.ai_pipeline.transcript_processing.process_raw_transcripts",
        "schedule": schedule(run_every=120),  # 120 seconds = 2 minutes
    },
}

logger.info(f"Celery app initialized with broker: {settings.REDIS_URL}")
logger.info("Data Ingestion (periodic):")
logger.info("  - Slack: every 30 min | Gong: every 1 hour | Fathom: every 1 hour | Gmail: every 31 min")
logger.info("Transcript Processing (periodic):")
logger.info("  - Process raw transcripts: every 2 min")


# ============================================================================
# LANGFUSE OPENTELEMETRY TRACING FOR CELERY WORKERS
# ============================================================================
# Initialize tracing when each worker process starts.
# This ensures all AI/LLM calls in Celery tasks are traced to Langfuse.

@worker_process_init.connect
def init_worker_tracing(**kwargs):
    """Initialize Langfuse tracing when a worker process starts."""
    try:
        from app.core.langfuse_tracing import init_langfuse_tracing
        tracing_enabled = init_langfuse_tracing()
        if tracing_enabled:
            logger.info("📊 Langfuse tracing initialized for Celery worker")
        else:
            logger.warning("📊 Langfuse tracing not enabled (keys not configured)")
    except Exception as e:
        logger.error(f"Failed to initialize Langfuse tracing in worker: {e}")


@worker_process_shutdown.connect
def shutdown_worker_tracing(**kwargs):
    """Shutdown tracing and flush pending spans when worker exits."""
    try:
        from app.core.langfuse_tracing import shutdown_tracing
        shutdown_tracing()
        logger.info("📊 Langfuse tracing shut down for Celery worker")
    except Exception as e:
        logger.error(f"Error shutting down Langfuse tracing in worker: {e}")
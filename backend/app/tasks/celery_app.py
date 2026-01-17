"""
Celery application configuration for background tasks and scheduled jobs
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
        # Import all task modules for Celery to discover
        "app.sync_engine.tasks.periodic.health",
        "app.sync_engine.tasks.periodic.slack",
        "app.sync_engine.tasks.periodic.gmail",
        "app.sync_engine.tasks.periodic.gong",
        "app.sync_engine.tasks.periodic.fathom",
        "app.sync_engine.tasks.ondemand.gmail",
        "app.sync_engine.tasks.ondemand.slack",
        "app.sync_engine.tasks.ondemand.gong",
        "app.sync_engine.tasks.ondemand.fathom",
        "app.sync_engine.tasks.ondemand.themes",
    ]
)

# Auto-discover tasks from sync_engine
celery_app.autodiscover_tasks([
    'app.sync_engine.tasks',
    'app.sync_engine.tasks.periodic',
    'app.sync_engine.tasks.ondemand',
], force=True)

# Configure Celery
celery_config = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
    "task_track_started": True,
    "task_time_limit": 30 * 60,  # 30 minutes hard limit
    "task_soft_time_limit": 25 * 60,  # 25 minutes soft limit
}

# Use solo pool on Windows to avoid multiprocessing issues
if sys.platform == "win32":
    celery_config["worker_pool"] = "solo"
    celery_config["worker_concurrency"] = 1

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
}

logger.info(f"Celery app initialized with broker: {settings.REDIS_URL}")
logger.info("Sync Engine - Scheduled tasks configured:")
logger.info("  - Health check: every 5 minutes")
logger.info("  - Slack sync: every 15 minutes (only active integrations)")
logger.info("  - Gong sync: every 15 minutes (only active connectors)")
logger.info("  - Fathom sync: every 15 minutes (only active connectors)")
logger.info("  - Gmail sync: every 15 minutes (only active accounts, with AI extraction)")
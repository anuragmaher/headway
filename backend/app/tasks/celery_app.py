"""
Celery application configuration for background tasks and scheduled jobs
"""

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
        "app.tasks.ingestion_tasks"
    ]
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes hard limit
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
)

# Configure periodic tasks (Celery Beat schedule)
celery_app.conf.beat_schedule = {
    # Gong ingestion every 15 minutes
    "ingest-gong-calls": {
        "task": "app.tasks.ingestion_tasks.ingest_gong_periodic",
        "schedule": schedule(run_every=900),  # 900 seconds = 15 minutes
        "options": {
            "queue": "ingestion",
            "priority": 10
        }
    },
    # Fathom ingestion every 15 minutes (staggered by 2 minutes to avoid conflicts)
    "ingest-fathom-sessions": {
        "task": "app.tasks.ingestion_tasks.ingest_fathom_periodic",
        "schedule": schedule(run_every=920),  # 920 seconds = 15m 20s (staggered)
        "options": {
            "queue": "ingestion",
            "priority": 10
        }
    },
}

logger.info(f"Celery app initialized with broker: {settings.REDIS_URL}")
logger.info("Scheduled tasks configured:")
logger.info("  - Gong ingestion: every 15 minutes")
logger.info("  - Fathom ingestion: every 15 minutes (staggered by 20s)")

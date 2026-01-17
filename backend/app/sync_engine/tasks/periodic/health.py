"""
Health check task for Celery sync engine.
"""

import logging
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.sync_engine.sync_tasks.health_check")
def health_check():
    """
    Health check task to verify Celery sync engine is working.

    Runs every 5 minutes to confirm the worker is alive.
    """
    logger.info("✅ Celery sync engine health check: OK")
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "sync_engine"
    }

"""
Periodic Customer Extraction Task.

NOTE: Customer extraction functionality has been disabled.
The tasks below are placeholder stubs that return immediately without processing.
"""

import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.extract_customers_periodic",
    bind=True,
)
def extract_customers_periodic(self, batch_size: int = 200):
    """
    Periodic task to extract customers from messages.

    NOTE: This task is currently disabled and returns immediately.
    """
    logger.info("⏭️ Customer extraction task is disabled - skipping")
    return {
        "status": "skipped",
        "reason": "customer_extraction_disabled",
    }


@celery_app.task(
    name="app.sync_engine.sync_tasks.extract_customers_for_workspace",
    bind=True,
)
def extract_customers_for_workspace(self, workspace_id: str, batch_size: int = 500):
    """
    Extract customers for a specific workspace.

    NOTE: This task is currently disabled and returns immediately.
    """
    logger.info(f"⏭️ Customer extraction for workspace {workspace_id} is disabled - skipping")
    return {
        "status": "skipped",
        "reason": "customer_extraction_disabled",
        "workspace_id": workspace_id,
    }

"""
On-demand Fathom sync task.

Triggered by the Sources API when user clicks "Sync All Sources".
Uses optimized batch ingestion - data storage only, no AI extraction.
AI extraction happens in a separate batch processing task.
"""

import logging

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace_connector import WorkspaceConnector
from app.services.fathom_batch_ingestion_service import fathom_batch_ingestion_service
from app.sync_engine.tasks.base import engine, run_async_task, update_sync_record

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_workspace_fathom",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=60,
)
def sync_workspace_fathom(self, workspace_id: str, sync_id: str):
    """
    On-demand task to sync Fathom for a specific workspace.

    Triggered by the Sources API when user clicks "Sync All Sources".
    Uses batch ingestion - AI extraction happens in separate task.
    """
    logger.info(f"🚀 Starting on-demand Fathom sync for workspace {workspace_id}")

    try:
        with Session(engine) as db:
            # Update sync record to in_progress
            update_sync_record(db, sync_id, "in_progress")

            # Check for active Fathom connector
            connector = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.workspace_id == workspace_id,
                    WorkspaceConnector.connector_type == "fathom",
                    WorkspaceConnector.is_active == True
                )
            ).first()

            if not connector:
                logger.info(f"No active Fathom connector for workspace {workspace_id}")
                update_sync_record(db, sync_id, "success", 0, 0)
                return {"status": "skipped", "reason": "no_connector"}

            # Use batch ingestion (data storage only, no AI)
            result = run_async_task(
                fathom_batch_ingestion_service.ingest_sessions(
                    db=db,
                    workspace_id=workspace_id,
                    limit=60,
                    days_back=7,
                    min_duration_seconds=0
                )
            )

            total_checked = result.get("total_checked", 0)
            new_added = result.get("new_added", 0)
            inserted_ids = result.get("inserted_ids", [])

            update_sync_record(db, sync_id, "success", total_checked, new_added, synced_item_ids=inserted_ids)
            logger.info(f"✅ Fathom sync complete: {new_added} new sessions")

            return {
                "status": "success",
                "total_checked": total_checked,
                "new_added": new_added,
            }

    except Exception as e:
        logger.error(f"❌ Fathom sync failed for workspace {workspace_id}: {e}")
        with Session(engine) as db:
            update_sync_record(db, sync_id, "failed", error_message=str(e))
        raise self.retry(exc=e, countdown=120)

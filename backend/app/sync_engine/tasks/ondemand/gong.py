"""
On-demand Gong sync task.

Triggered by the Sources API when user clicks "Sync All Sources".
Stores raw call data in raw_transcripts table (ai_processed=False).
AI processing happens in a separate Celery task (transcript_processing).
"""

import logging

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace_connector import WorkspaceConnector
from app.services.gong_ingestion_service import gong_ingestion_service
from app.sync_engine.tasks.base import engine, run_async_task, update_sync_record

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_workspace_gong",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=60,
)
def sync_workspace_gong(self, workspace_id: str, sync_id: str):
    """
    On-demand task to sync Gong for a specific workspace.

    Triggered by the Sources API when user clicks "Sync All Sources".
    Stores raw data in raw_transcripts table (ai_processed=False).
    AI processing happens via transcript_processing Celery task.
    """
    logger.info(f"🚀 Starting on-demand Gong sync for workspace {workspace_id}")

    try:
        with Session(engine) as db:
            # Update sync record to in_progress
            update_sync_record(db, sync_id, "in_progress")

            # Check for active Gong connector
            connector = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.workspace_id == workspace_id,
                    WorkspaceConnector.connector_type == "gong",
                    WorkspaceConnector.is_active == True
                )
            ).first()

            if not connector:
                logger.info(f"No active Gong connector for workspace {workspace_id}")
                update_sync_record(db, sync_id, "success", 0, 0)
                return {"status": "skipped", "reason": "no_connector"}

            # Use batch ingestion (data storage only, no AI)
            result = run_async_task(
                gong_ingestion_service.ingest_calls(
                    db=db,
                    workspace_id=workspace_id,
                    limit=60,
                    days_back=7,
                    fetch_transcripts=True
                )
            )

            total_checked = result.get("total_checked", 0)
            new_added = result.get("new_added", 0)
            inserted_ids = result.get("inserted_ids", [])

            update_sync_record(db, sync_id, "success", total_checked, new_added, synced_item_ids=inserted_ids)
            logger.info(f"✅ Gong sync complete: {new_added} new calls")

            return {
                "status": "success",
                "total_checked": total_checked,
                "new_added": new_added,
            }

    except Exception as e:
        logger.error(f"❌ Gong sync failed for workspace {workspace_id}: {e}")
        with Session(engine) as db:
            update_sync_record(db, sync_id, "failed", error_message=str(e))
        raise self.retry(exc=e, countdown=120)

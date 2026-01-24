"""
On-demand Gmail sync task.

Triggered by the Sources API when user clicks "Sync All Sources".
Uses optimized batch ingestion - data storage only, no AI extraction.
AI extraction happens in a separate batch processing task.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace_connector import WorkspaceConnector
from app.services.gmail_batch_ingestion_service import gmail_batch_ingestion_service
from app.sync_engine.tasks.base import engine, update_sync_record

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_workspace_gmail",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=60,
)
def sync_workspace_gmail(self, workspace_id: str, sync_id: str):
    """
    On-demand task to sync Gmail for a specific workspace.

    Triggered by the Sources API when user clicks "Sync All Sources".
    Uses batch ingestion - AI extraction happens in separate task.
    """
    logger.info(f"🚀 Starting on-demand Gmail sync for workspace {workspace_id}")

    try:
        with Session(engine) as db:
            # Update sync record to in_progress
            update_sync_record(db, sync_id, "in_progress")

            # Get Gmail connectors for this workspace
            connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.workspace_id == workspace_id,
                    WorkspaceConnector.connector_type == "gmail",
                    WorkspaceConnector.is_active == True,
                    WorkspaceConnector.access_token.isnot(None),
                    WorkspaceConnector.refresh_token.isnot(None)
                )
            ).all()

            if not connectors:
                logger.info(f"No Gmail connectors for workspace {workspace_id}")
                update_sync_record(db, sync_id, "success", 0, 0)
                return {"status": "skipped", "reason": "no_connectors"}

            total_ingested = 0
            total_checked = 0
            all_inserted_ids = []

            for connector in connectors:
                try:
                    connector_name = connector.external_id or connector.name or "Gmail"
                    logger.info(f"Syncing Gmail connector: {connector_name}")

                    # Use batch ingestion (data storage only, no AI)
                    result = gmail_batch_ingestion_service.ingest_messages_for_connector(
                        connector_id=str(connector.id),
                        db=db,
                        max_messages=60,
                    )

                    if result.get("status") != "error":
                        total_ingested += result.get("new_added", 0)
                        total_checked += result.get("total_checked", 0)
                        all_inserted_ids.extend(result.get("inserted_ids", []))

                        # Update connector last sync time
                        connector.last_synced_at = datetime.now(timezone.utc)
                        connector.sync_status = "success"
                        db.commit()

                except Exception as e:
                    logger.error(f"Error syncing Gmail connector {connector.id}: {e}")
                    continue

            update_sync_record(db, sync_id, "success", total_checked, total_ingested, synced_item_ids=all_inserted_ids)
            logger.info(f"✅ Gmail sync complete: {total_ingested} new messages ingested")

            return {
                "status": "success",
                "total_checked": total_checked,
                "total_ingested": total_ingested,
            }

    except Exception as e:
        logger.error(f"❌ Gmail sync failed for workspace {workspace_id}: {e}")
        with Session(engine) as db:
            update_sync_record(db, sync_id, "failed", error_message=str(e))
        raise self.retry(exc=e, countdown=120)

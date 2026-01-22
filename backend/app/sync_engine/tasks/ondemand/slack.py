"""
On-demand Slack sync task.

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
from app.services.slack_batch_ingestion_service import slack_batch_ingestion_service
from app.sync_engine.tasks.base import engine, run_async_task, update_sync_record

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_workspace_slack",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=60,
)
def sync_workspace_slack(self, workspace_id: str, sync_id: str, hours_back: int = 24):
    """
    On-demand task to sync Slack for a specific workspace.

    Triggered by the Sources API when user clicks "Sync All Sources".
    Uses batch ingestion - AI extraction happens in separate task.
    """
    logger.info(f"🚀 Starting on-demand Slack sync for workspace {workspace_id}")

    try:
        with Session(engine) as db:
            # Update sync record to in_progress
            update_sync_record(db, sync_id, "in_progress")

            # Get Slack connectors for this workspace
            connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.workspace_id == workspace_id,
                    WorkspaceConnector.connector_type == "slack",
                    WorkspaceConnector.is_active == True
                )
            ).all()

            if not connectors:
                logger.info(f"No Slack connectors for workspace {workspace_id}")
                update_sync_record(db, sync_id, "success", 0, 0)
                return {"status": "skipped", "reason": "no_connectors"}

            total_checked = 0
            total_new = 0
            all_inserted_ids = []

            for connector in connectors:
                try:
                    logger.info(f"Syncing Slack connector: {connector.external_name or connector.name}")

                    # Use batch ingestion (data storage only, no AI)
                    result = run_async_task(
                        slack_batch_ingestion_service.ingest_messages(
                            connector_id=str(connector.id),
                            db=db,
                            hours_back=hours_back
                        )
                    )

                    total_checked += result.get("total_checked", 0)
                    total_new += result.get("new_added", 0)
                    all_inserted_ids.extend(result.get("inserted_ids", []))

                    # Update connector last sync time
                    connector.last_synced_at = datetime.now(timezone.utc)
                    connector.sync_status = "success"
                    db.commit()

                except Exception as e:
                    logger.error(f"Error syncing Slack connector {connector.id}: {e}")
                    continue

            update_sync_record(db, sync_id, "success", total_checked, total_new, synced_item_ids=all_inserted_ids)
            logger.info(f"✅ Slack sync complete: {total_new} new messages")

            return {
                "status": "success",
                "total_checked": total_checked,
                "total_new": total_new,
            }

    except Exception as e:
        logger.error(f"❌ Slack sync failed for workspace {workspace_id}: {e}")
        with Session(engine) as db:
            update_sync_record(db, sync_id, "failed", error_message=str(e))
        raise self.retry(exc=e, countdown=120)

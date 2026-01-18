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
from app.models.integration import Integration
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

            # Get Slack integrations for this workspace
            integrations = db.query(Integration).filter(
                and_(
                    Integration.workspace_id == workspace_id,
                    Integration.provider == "slack",
                    Integration.is_active == True
                )
            ).all()

            if not integrations:
                logger.info(f"No Slack integrations for workspace {workspace_id}")
                update_sync_record(db, sync_id, "success", 0, 0)
                return {"status": "skipped", "reason": "no_integrations"}

            total_checked = 0
            total_new = 0

            for integration in integrations:
                try:
                    logger.info(f"Syncing Slack integration: {integration.external_team_name}")

                    # Use batch ingestion (data storage only, no AI)
                    result = run_async_task(
                        slack_batch_ingestion_service.ingest_messages(
                            integration_id=str(integration.id),
                            db=db,
                            hours_back=hours_back
                        )
                    )

                    total_checked += result.get("total_checked", 0)
                    total_new += result.get("new_added", 0)

                    # Update integration last sync time
                    integration.last_synced_at = datetime.now(timezone.utc)
                    integration.sync_status = "success"
                    db.commit()

                except Exception as e:
                    logger.error(f"Error syncing Slack integration {integration.id}: {e}")
                    continue

            update_sync_record(db, sync_id, "success", total_checked, total_new)
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

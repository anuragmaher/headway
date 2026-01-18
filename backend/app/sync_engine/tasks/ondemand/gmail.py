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
from app.models.gmail import GmailAccounts
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

            # Get Gmail accounts for this workspace
            gmail_accounts = db.query(GmailAccounts).filter(
                and_(
                    GmailAccounts.workspace_id == workspace_id,
                    GmailAccounts.access_token.isnot(None),
                    GmailAccounts.refresh_token.isnot(None)
                )
            ).all()

            if not gmail_accounts:
                logger.info(f"No Gmail accounts for workspace {workspace_id}")
                update_sync_record(db, sync_id, "success", 0, 0)
                return {"status": "skipped", "reason": "no_accounts"}

            total_ingested = 0
            total_checked = 0

            for account in gmail_accounts:
                try:
                    logger.info(f"Syncing Gmail account: {account.gmail_email}")

                    # Use batch ingestion (data storage only, no AI)
                    result = gmail_batch_ingestion_service.ingest_threads_for_account(
                        gmail_account_id=str(account.id),
                        db=db,
                        max_threads=20,
                    )

                    if result.get("status") != "error":
                        total_ingested += result.get("new_added", 0)
                        total_checked += result.get("total_checked", 0)

                        # Update account last sync time
                        account.last_synced_at = datetime.now(timezone.utc)
                        account.sync_status = "success"
                        db.commit()

                except Exception as e:
                    logger.error(f"Error syncing Gmail account {account.gmail_email}: {e}")
                    continue

            update_sync_record(db, sync_id, "success", total_checked, total_ingested)
            logger.info(f"✅ Gmail sync complete: {total_ingested} new threads ingested")

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

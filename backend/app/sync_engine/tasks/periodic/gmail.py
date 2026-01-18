"""
Periodic Gmail sync task.

Syncs Gmail threads from all active accounts every 15 minutes.
Uses optimized batch ingestion - data storage only, no AI extraction.
AI extraction happens in a separate batch processing task.
"""

import logging

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace import Workspace
from app.models.gmail import GmailAccounts
from app.services.gmail_batch_ingestion_service import gmail_batch_ingestion_service
from app.sync_engine.tasks.base import (
    engine,
    create_sync_record,
    finalize_sync_record,
    test_db_connection,
    get_active_gmail_accounts,
    cleanup_after_task,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_gmail_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def sync_gmail_periodic(self):
    """
    Periodic task to sync Gmail threads every 15 minutes.

    This task:
    - Runs periodically (e.g., every 15 minutes)
    - Only syncs active Gmail accounts with selected labels
    - Fetches latest Gmail threads from selected labels
    - Stores threads in GmailThread table with is_processed=False
    - Creates SyncHistory records for tracking

    AI extraction is NOT performed here - it happens in a separate batch task.
    """
    try:
        logger.info("🚀 Starting periodic Gmail sync task (batch ingestion only)")

        with Session(engine) as db:
            # Test database connection first
            if not test_db_connection(db):
                logger.error("❌ Database connection failed! Cannot proceed with sync.")
                return {"status": "error", "reason": "database_connection_failed"}

            logger.info("✅ Database connection verified")

            # Use diagnostic function to log all Gmail accounts
            get_active_gmail_accounts(db)

            # Get all Gmail accounts with workspace_id (active accounts)
            gmail_accounts = db.query(GmailAccounts).filter(
                and_(
                    GmailAccounts.workspace_id.isnot(None),
                    GmailAccounts.access_token.isnot(None),
                    GmailAccounts.refresh_token.isnot(None)
                )
            ).all()

            logger.info(f"Found {len(gmail_accounts)} active Gmail accounts to sync")

            if not gmail_accounts:
                logger.info("No active Gmail accounts found. Skipping Gmail sync.")
                return {"status": "skipped", "reason": "no_accounts", "count": 0}

            total_ingested = 0
            total_skipped = 0
            successful_accounts = 0
            failed_accounts = 0

            for account in gmail_accounts:
                try:
                    workspace = db.query(Workspace).filter(
                        Workspace.id == account.workspace_id
                    ).first()

                    if not workspace:
                        logger.warning(f"Workspace not found for Gmail account {account.id}")
                        continue

                    logger.info(f"Syncing Gmail threads for account: {account.gmail_email} (Workspace: {workspace.name})")

                    # Use optimized batch ingestion (data storage only, no AI)
                    result = gmail_batch_ingestion_service.ingest_threads_for_account(
                        gmail_account_id=str(account.id),
                        db=db,
                        max_threads=10
                    )

                    if result.get("status") == "error":
                        failed_accounts += 1
                        logger.error(f"❌ Gmail sync failed for {account.gmail_email}: {result.get('error')}")
                        # Create a failed sync record for errors
                        try:
                            error_record = create_sync_record(
                                db=db,
                                workspace_id=str(workspace.id),
                                source_type="gmail",
                                source_name=account.gmail_email or "Gmail",
                                gmail_account_id=str(account.id),
                            )
                            finalize_sync_record(
                                db=db,
                                sync_record=error_record,
                                status="failed",
                                error_message=result.get('error', 'Unknown error'),
                            )
                        except Exception:
                            pass
                        continue

                    # Extract counts from result
                    total_checked = result.get("total_checked", 0)
                    new_added = result.get("new_added", 0)
                    duplicates_skipped = result.get("duplicates_skipped", 0)

                    total_ingested += new_added
                    total_skipped += duplicates_skipped

                    # Only create sync history record if new data was found
                    if new_added > 0:
                        sync_record = create_sync_record(
                            db=db,
                            workspace_id=str(workspace.id),
                            source_type="gmail",
                            source_name=account.gmail_email or "Gmail",
                            gmail_account_id=str(account.id),
                        )
                        finalize_sync_record(
                            db=db,
                            sync_record=sync_record,
                            status="success",
                            items_processed=total_checked,
                            items_new=new_added,
                        )
                        logger.info(f"✅ Checked {total_checked} Gmail threads, added {new_added} new for {account.gmail_email}")
                    else:
                        logger.info(f"ℹ️ Checked {total_checked} Gmail threads, no new data for {account.gmail_email}")

                    successful_accounts += 1

                except Exception as e:
                    failed_accounts += 1
                    logger.error(f"❌ Error syncing Gmail threads for {account.gmail_email}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Create a failed sync record for errors
                    try:
                        error_record = create_sync_record(
                            db=db,
                            workspace_id=str(workspace.id),
                            source_type="gmail",
                            source_name=account.gmail_email or "Gmail",
                            gmail_account_id=str(account.id),
                        )
                        finalize_sync_record(
                            db=db,
                            sync_record=error_record,
                            status="failed",
                            error_message=str(e),
                        )
                    except Exception:
                        pass
                    continue

            logger.info(
                f"✅ Gmail periodic sync complete. "
                f"Total threads: {total_ingested} new, {total_skipped} skipped, "
                f"Accounts: {successful_accounts} successful, {failed_accounts} failed"
            )
            return {
                "status": "success",
                "total_ingested": total_ingested,
                "total_skipped": total_skipped,
                "successful_accounts": successful_accounts,
                "failed_accounts": failed_accounts
            }

    except Exception as e:
        logger.error(f"❌ Fatal error in Gmail periodic sync: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=600)
    finally:
        # Always cleanup after task to free memory
        cleanup_after_task()

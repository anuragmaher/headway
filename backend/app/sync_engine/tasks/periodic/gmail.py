"""
Periodic Gmail sync task.

Syncs Gmail threads from all active accounts every 15 minutes.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace import Workspace
from app.models.gmail import GmailAccounts, GmailThread
from app.models.integration import Integration
from app.services.gmail_ingestion_service import gmail_ingestion_service
from app.sync_engine.tasks.base import (
    engine,
    create_sync_record,
    finalize_sync_record,
    test_db_connection,
    get_active_gmail_accounts,
)

logger = logging.getLogger(__name__)


def _process_gmail_threads_for_ai(db: Session, workspace_id: str, gmail_account_id: str) -> int:
    """
    Process unprocessed Gmail threads through AI extraction to discover features.

    This bridges Gmail data to the same AI extraction pipeline used by Gong/Fathom.

    Args:
        db: Database session
        workspace_id: Workspace UUID
        gmail_account_id: Gmail account UUID

    Returns:
        Number of features extracted
    """
    from app.services.transcript_ingestion_service import get_transcript_ingestion_service

    try:
        # Get unprocessed threads for this account
        unprocessed_threads = db.query(GmailThread).filter(
            and_(
                GmailThread.gmail_account_id == gmail_account_id,
                GmailThread.workspace_id == workspace_id,
                GmailThread.is_processed == False
            )
        ).limit(20).all()

        if not unprocessed_threads:
            logger.debug(f"No unprocessed Gmail threads for account {gmail_account_id}")
            return 0

        # Get or create Gmail integration for this workspace
        integration = db.query(Integration).filter(
            and_(
                Integration.workspace_id == workspace_id,
                Integration.provider == "gmail"
            )
        ).first()

        if not integration:
            logger.info(f"Creating Gmail integration for workspace {workspace_id}")
            integration = Integration(
                name="Gmail",
                provider="gmail",
                is_active=True,
                workspace_id=workspace_id,
                provider_metadata={
                    "ingestion_method": "api",
                    "source": "gmail_threads"
                },
                sync_status="pending"
            )
            db.add(integration)
            db.commit()
            db.refresh(integration)

        # Initialize transcript ingestion service
        transcript_service = get_transcript_ingestion_service(db)

        features_extracted = 0

        for thread in unprocessed_threads:
            try:
                # Skip threads with no content
                if not thread.content or len(thread.content.strip()) < 50:
                    thread.is_processed = True
                    thread.processed_at = datetime.now(timezone.utc)
                    continue

                # Prepare metadata for transcript service
                metadata = {
                    "thread_id": thread.thread_id,
                    "subject": thread.subject,
                    "from_email": thread.from_email,
                    "from_name": thread.from_name,
                    "to_emails": thread.to_emails,
                    "label_id": thread.label_id,
                    "label_name": thread.label_name,
                    "message_count": thread.message_count,
                    "snippet": thread.snippet
                }

                # Process through transcript ingestion service
                message_id = transcript_service.ingest_transcript(
                    workspace_id=workspace_id,
                    external_id=f"gmail_{thread.thread_id}",
                    transcript_text=thread.content,
                    source="gmail",
                    metadata=metadata,
                    channel_name=thread.label_name or "Gmail",
                    channel_id=thread.label_id or "gmail",
                    author_name=thread.from_name or thread.from_email or "Unknown",
                    author_email=thread.from_email,
                    author_id=None,
                    customer_id=None,
                    sent_at=thread.thread_date or datetime.now(timezone.utc),
                    integration_id=str(integration.id),
                    extract_features=True
                )

                # Mark thread as processed
                thread.is_processed = True
                thread.processed_at = datetime.now(timezone.utc)

                if message_id:
                    features_extracted += 1
                    logger.info(f"Processed Gmail thread: {thread.subject[:50] if thread.subject else 'No subject'}")

            except Exception as e:
                logger.error(f"Error processing Gmail thread {thread.thread_id}: {e}")
                thread.is_processed = True
                thread.processed_at = datetime.now(timezone.utc)
                thread.ai_insights = {"error": str(e)}
                continue

        db.commit()
        return features_extracted

    except Exception as e:
        logger.error(f"Error in _process_gmail_threads_for_ai: {e}")
        db.rollback()
        return 0


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_gmail_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,
)
def sync_gmail_periodic(self):
    """
    Periodic task to sync Gmail threads every 15 minutes.

    This task:
    - Runs periodically (e.g., every 15 minutes)
    - Only syncs active Gmail accounts with selected labels
    - Fetches latest Gmail threads from selected labels
    - Creates SyncHistory records for tracking
    - Processes threads through AI extraction for feature discovery
    - Updates the database with new threads and features
    """
    try:
        logger.info("🚀 Starting periodic Gmail sync task")
        logger.info("📊 SyncHistory tracking enabled for periodic Gmail sync")

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
            total_features_extracted = 0
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

                    # Step 1: Ingest threads into gmail_threads table
                    result = gmail_ingestion_service.ingest_threads_for_account(
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
                    total_ingested += new_added

                    # Step 2: Process unprocessed threads for AI extraction
                    features_count = _process_gmail_threads_for_ai(
                        db=db,
                        workspace_id=str(workspace.id),
                        gmail_account_id=str(account.id)
                    )
                    total_features_extracted += features_count

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
                f"Total threads: {total_ingested}, "
                f"Features extracted: {total_features_extracted}, "
                f"Accounts: {successful_accounts} successful, {failed_accounts} failed"
            )
            return {
                "status": "success",
                "total_ingested": total_ingested,
                "total_features_extracted": total_features_extracted,
                "successful_accounts": successful_accounts,
                "failed_accounts": failed_accounts
            }

    except Exception as e:
        logger.error(f"❌ Fatal error in Gmail periodic sync: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=600)

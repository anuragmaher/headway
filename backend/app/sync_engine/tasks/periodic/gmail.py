"""
Periodic Gmail sync task.

Syncs Gmail messages from all active workspace connectors every 15 minutes.
Uses optimized batch ingestion - data storage only, no AI extraction.
AI extraction happens in a separate batch processing task.
"""

import logging

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.services.gmail_batch_ingestion_service import gmail_batch_ingestion_service
from app.sync_engine.tasks.base import (
    engine,
    create_sync_record,
    finalize_sync_record,
    test_db_connection,
    get_active_connectors,
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
    Periodic task to sync Gmail messages every 15 minutes.

    This task:
    - Runs periodically (e.g., every 15 minutes)
    - Only syncs active Gmail connectors with selected labels
    - Fetches latest Gmail messages from selected labels
    - Stores messages in Message table with tier1_processed=False
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

            # Use diagnostic function to log all connectors
            get_active_connectors(db, "gmail")

            # Get all Gmail connectors with workspace_id and tokens (active connectors)
            connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.connector_type == "gmail",
                    WorkspaceConnector.workspace_id.isnot(None),
                    WorkspaceConnector.is_active == True,
                    WorkspaceConnector.access_token.isnot(None),
                    WorkspaceConnector.refresh_token.isnot(None)
                )
            ).all()

            logger.info(f"Found {len(connectors)} active Gmail connectors to sync")

            if not connectors:
                logger.info("No active Gmail connectors found. Skipping Gmail sync.")
                return {"status": "skipped", "reason": "no_connectors", "count": 0}

            total_ingested = 0
            total_skipped = 0
            successful_connectors = 0
            failed_connectors = 0

            for connector in connectors:
                try:
                    workspace = db.query(Workspace).filter(
                        Workspace.id == connector.workspace_id
                    ).first()

                    if not workspace:
                        logger.warning(f"Workspace not found for Gmail connector {connector.id}")
                        continue

                    connector_name = connector.external_id or connector.name or "Gmail"
                    logger.info(f"Syncing Gmail messages for connector: {connector_name} (Workspace: {workspace.name})")

                    # Use optimized batch ingestion (data storage only, no AI)
                    result = gmail_batch_ingestion_service.ingest_messages_for_connector(
                        connector_id=str(connector.id),
                        db=db,
                        max_messages=10
                    )

                    if result.get("status") == "error":
                        failed_connectors += 1
                        logger.error(f"❌ Gmail sync failed for {connector_name}: {result.get('error')}")
                        # Create a failed sync record for errors
                        try:
                            error_record = create_sync_record(
                                db=db,
                                workspace_id=str(workspace.id),
                                source_type="gmail",
                                source_name=connector_name,
                                connector_id=str(connector.id),
                                trigger_type="periodic",  # This is a scheduled periodic sync
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

                    # Extract counts and IDs from result
                    total_checked = result.get("total_checked", 0)
                    new_added = result.get("new_added", 0)
                    duplicates_skipped = result.get("duplicates_skipped", 0)
                    inserted_ids = result.get("inserted_ids", [])

                    total_ingested += new_added
                    total_skipped += duplicates_skipped

                    # Only create sync history record if new data was found
                    if new_added > 0:
                        sync_record = create_sync_record(
                            db=db,
                            workspace_id=str(workspace.id),
                            source_type="gmail",
                            source_name=connector_name,
                            connector_id=str(connector.id),
                            trigger_type="periodic",  # This is a scheduled periodic sync
                        )
                        finalize_sync_record(
                            db=db,
                            sync_record=sync_record,
                            status="success",
                            items_processed=total_checked,
                            items_new=new_added,
                            synced_item_ids=inserted_ids,
                        )
                        logger.info(f"✅ Checked {total_checked} Gmail messages, added {new_added} new for {connector_name}")
                    else:
                        logger.info(f"ℹ️ Checked {total_checked} Gmail messages, no new data for {connector_name}")

                    successful_connectors += 1

                except Exception as e:
                    failed_connectors += 1
                    logger.error(f"❌ Error syncing Gmail messages for connector {connector.id}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Create a failed sync record for errors
                    try:
                        error_record = create_sync_record(
                            db=db,
                            workspace_id=str(workspace.id),
                            source_type="gmail",
                            source_name=connector.external_id or connector.name or "Gmail",
                            connector_id=str(connector.id),
                            trigger_type="periodic",  # This is a scheduled periodic sync
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
                f"Total messages: {total_ingested} new, {total_skipped} skipped, "
                f"Connectors: {successful_connectors} successful, {failed_connectors} failed"
            )
            return {
                "status": "success",
                "total_ingested": total_ingested,
                "total_skipped": total_skipped,
                "successful_connectors": successful_connectors,
                "failed_connectors": failed_connectors
            }

    except Exception as e:
        logger.error(f"❌ Fatal error in Gmail periodic sync: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=600)
    finally:
        # Always cleanup after task to free memory
        cleanup_after_task()

"""
Periodic Fathom sync task.

Syncs Fathom sessions from all active connectors every 15 minutes.
Uses optimized batch ingestion - data storage only, no AI extraction.
AI extraction happens in a separate batch processing task.
"""

import logging

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.services.fathom_batch_ingestion_service import fathom_batch_ingestion_service
from app.sync_engine.tasks.base import (
    engine,
    run_async_task,
    create_sync_record,
    finalize_sync_record,
    test_db_connection,
    get_active_connectors,
    cleanup_after_task,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_fathom_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def sync_fathom_periodic(self):
    """
    Periodic task to sync Fathom sessions every 15 minutes.

    This task:
    - Runs every 15 minutes (staggered by 20 seconds after Gong)
    - Only syncs workspaces with active Fathom connectors
    - Fetches latest Fathom sessions from the last 24 hours
    - Creates SyncHistory records for tracking
    - Extracts features with AI
    - Updates the database
    """
    try:
        logger.info("🚀 Starting periodic Fathom sync task")

        with Session(engine) as db:
            # Test database connection first
            if not test_db_connection(db):
                logger.error("❌ Database connection failed! Cannot proceed with sync.")
                return {"status": "error", "reason": "database_connection_failed"}

            logger.info("✅ Database connection verified")

            # Use diagnostic function to log all connectors
            get_active_connectors(db, "fathom")

            # Get all workspaces with active Fathom connectors
            fathom_connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.connector_type == "fathom",
                    WorkspaceConnector.is_active == True
                )
            ).all()

            logger.info(f"Found {len(fathom_connectors)} active Fathom connectors to sync")

            if not fathom_connectors:
                logger.info("No active Fathom connectors found. Skipping Fathom sync.")
                return {"status": "skipped", "reason": "no_active_connectors", "count": 0}

            total_ingested = 0
            successful_workspaces = 0
            failed_workspaces = 0

            for connector in fathom_connectors:
                try:
                    workspace = db.query(Workspace).filter(
                        Workspace.id == connector.workspace_id
                    ).first()

                    if not workspace:
                        logger.warning(f"Workspace not found for connector {connector.id}")
                        continue

                    logger.info(f"Syncing Fathom sessions for workspace: {workspace.name}")

                    # Run the optimized batch ingestion (data storage only, no AI)
                    result = run_async_task(
                        fathom_batch_ingestion_service.ingest_sessions(
                            db=db,
                            workspace_id=str(workspace.id),
                            limit=50,
                            days_back=1,
                            min_duration_seconds=0
                        )
                    )

                    # Extract counts from result
                    total_checked = result.get("total_checked", 0)
                    new_added = result.get("new_added", 0)

                    # Only create sync history record if new data was found
                    if new_added > 0:
                        sync_record = create_sync_record(
                            db=db,
                            workspace_id=str(workspace.id),
                            source_type="fathom",
                            source_name="Fathom",
                            connector_id=str(connector.id),
                        )
                        finalize_sync_record(
                            db=db,
                            sync_record=sync_record,
                            status="success",
                            items_processed=total_checked,
                            items_new=new_added,
                        )
                        logger.info(f"✅ Checked {total_checked} Fathom sessions, added {new_added} new for {workspace.name}")
                    else:
                        logger.info(f"ℹ️ Checked {total_checked} Fathom sessions, no new data for {workspace.name}")

                    total_ingested += new_added
                    successful_workspaces += 1

                except Exception as e:
                    failed_workspaces += 1
                    logger.error(f"❌ Error syncing Fathom sessions for workspace {connector.workspace_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Create a failed sync record for errors
                    try:
                        error_record = create_sync_record(
                            db=db,
                            workspace_id=str(workspace.id),
                            source_type="fathom",
                            source_name="Fathom",
                            connector_id=str(connector.id),
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
                f"✅ Fathom periodic sync complete. "
                f"Total sessions: {total_ingested}, "
                f"Workspaces: {successful_workspaces} successful, {failed_workspaces} failed"
            )
            return {
                "status": "success",
                "total_ingested": total_ingested,
                "successful_workspaces": successful_workspaces,
                "failed_workspaces": failed_workspaces
            }

    except Exception as e:
        logger.error(f"❌ Fatal error in Fathom periodic sync: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=600)
    finally:
        # Always cleanup after task to free memory
        cleanup_after_task()

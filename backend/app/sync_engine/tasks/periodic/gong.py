"""
Periodic Gong sync task.

Syncs Gong calls from all active connectors every 15 minutes.
"""

import logging

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.scripts.ingest_gong_calls import ingest_gong_calls
from app.sync_engine.tasks.base import (
    engine,
    run_async_task,
    create_sync_record,
    finalize_sync_record,
    test_db_connection,
    get_active_connectors,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_gong_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,
)
def sync_gong_periodic(self):
    """
    Periodic task to sync Gong calls every 15 minutes.

    This task:
    - Runs every 15 minutes
    - Only syncs workspaces with active Gong connectors
    - Fetches latest Gong calls from the last 24 hours
    - Creates SyncHistory records for tracking
    - Extracts features with AI
    - Updates the database
    """
    try:
        logger.info("🚀 Starting periodic Gong sync task")

        with Session(engine) as db:
            # Test database connection first
            if not test_db_connection(db):
                logger.error("❌ Database connection failed! Cannot proceed with sync.")
                return {"status": "error", "reason": "database_connection_failed"}

            logger.info("✅ Database connection verified")

            # Use diagnostic function to log all connectors
            get_active_connectors(db, "gong")

            # Get all workspaces with active Gong connectors
            gong_connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.connector_type == "gong",
                    WorkspaceConnector.is_active == True
                )
            ).all()

            logger.info(f"Found {len(gong_connectors)} active Gong connectors to sync")

            if not gong_connectors:
                logger.info("No active Gong connectors found. Skipping Gong sync.")
                return {"status": "skipped", "reason": "no_active_connectors", "count": 0}

            total_ingested = 0
            successful_workspaces = 0
            failed_workspaces = 0

            for connector in gong_connectors:
                try:
                    workspace = db.query(Workspace).filter(
                        Workspace.id == connector.workspace_id
                    ).first()

                    if not workspace:
                        logger.warning(f"Workspace not found for connector {connector.id}")
                        continue

                    logger.info(f"Syncing Gong calls for workspace: {workspace.name}")

                    # Run the async ingestion function
                    result = run_async_task(
                        ingest_gong_calls(
                            workspace_id=str(workspace.id),
                            limit=50,
                            days_back=1,
                            fetch_transcripts=True,
                            extract_features=True
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
                            source_type="gong",
                            source_name="Gong",
                            connector_id=str(connector.id),
                        )
                        finalize_sync_record(
                            db=db,
                            sync_record=sync_record,
                            status="success",
                            items_processed=total_checked,
                            items_new=new_added,
                        )
                        logger.info(f"✅ Checked {total_checked} Gong calls, added {new_added} new for {workspace.name}")
                    else:
                        logger.info(f"ℹ️ Checked {total_checked} Gong calls, no new data for {workspace.name}")

                    total_ingested += new_added
                    successful_workspaces += 1

                except Exception as e:
                    failed_workspaces += 1
                    logger.error(f"❌ Error syncing Gong calls for workspace {connector.workspace_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Create a failed sync record for errors
                    try:
                        error_record = create_sync_record(
                            db=db,
                            workspace_id=str(workspace.id),
                            source_type="gong",
                            source_name="Gong",
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
                f"✅ Gong periodic sync complete. "
                f"Total calls: {total_ingested}, "
                f"Workspaces: {successful_workspaces} successful, {failed_workspaces} failed"
            )
            return {
                "status": "success",
                "total_ingested": total_ingested,
                "successful_workspaces": successful_workspaces,
                "failed_workspaces": failed_workspaces
            }

    except Exception as e:
        logger.error(f"❌ Fatal error in Gong periodic sync: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=600)

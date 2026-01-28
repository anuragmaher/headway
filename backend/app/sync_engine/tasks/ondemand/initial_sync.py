"""
Initial sync task - triggered after onboarding completion.

Fetches last 50 transcripts from each connected Gong/Fathom source.
This is a one-time task that runs when a new user completes onboarding
to provide them with immediate data to work with.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace_connector import WorkspaceConnector
from app.services.gong_ingestion_service import gong_ingestion_service
from app.services.fathom_batch_ingestion_service import fathom_batch_ingestion_service
from app.sync_engine.tasks.base import engine, run_async_task

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_workspace_initial",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=60,
)
def sync_workspace_initial(self, workspace_id: str):
    """
    Fetch initial transcripts from all connected Gong/Fathom sources.

    Called once after onboarding completion to provide new users with
    immediate data. Fetches the last 50 transcripts from each source.

    Args:
        workspace_id: UUID string of the workspace

    Returns:
        Dict with sync results for each source type
    """
    logger.info(f"🚀 Starting initial sync for workspace {workspace_id}")

    results = {"gong": [], "fathom": [], "total_new": 0}

    try:
        with Session(engine) as db:
            # Find all Gong connectors with credentials
            gong_connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.workspace_id == workspace_id,
                    WorkspaceConnector.connector_type == "gong",
                    WorkspaceConnector.credentials.isnot(None),
                    WorkspaceConnector.is_active == True,
                )
            ).all()

            # Find all Fathom connectors with credentials
            fathom_connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.workspace_id == workspace_id,
                    WorkspaceConnector.connector_type == "fathom",
                    WorkspaceConnector.credentials.isnot(None),
                    WorkspaceConnector.is_active == True,
                )
            ).all()

            if not gong_connectors and not fathom_connectors:
                logger.info(f"No active Gong/Fathom connectors for workspace {workspace_id}")
                return {"status": "skipped", "reason": "no_connectors"}

            # Sync each Gong connector (last 50 transcripts, 30 days back)
            for connector in gong_connectors:
                try:
                    logger.info(f"📞 Initial sync: Fetching Gong transcripts for workspace {workspace_id}")

                    result = run_async_task(
                        gong_ingestion_service.ingest_calls(
                            db=db,
                            workspace_id=workspace_id,
                            limit=10,
                            days_back=30,
                            fetch_transcripts=True,
                        )
                    )

                    new_added = result.get("new_added", 0)
                    results["gong"].append(result)
                    results["total_new"] += new_added

                    # Update connector sync status
                    connector.sync_status = "success"
                    connector.last_synced_at = datetime.now(timezone.utc)
                    db.commit()

                    logger.info(f"✅ Gong initial sync complete: {new_added} new calls")

                except Exception as e:
                    logger.error(f"❌ Initial sync Gong failed for workspace {workspace_id}: {e}")
                    connector.sync_status = "error"
                    db.commit()
                    results["gong"].append({"error": str(e)})

            # Sync each Fathom connector (last 50 transcripts, 30 days back)
            for connector in fathom_connectors:
                try:
                    logger.info(f"🎥 Initial sync: Fetching Fathom transcripts for workspace {workspace_id}")

                    result = run_async_task(
                        fathom_batch_ingestion_service.ingest_sessions(
                            db=db,
                            workspace_id=workspace_id,
                            limit=10,
                            days_back=30,
                        )
                    )

                    new_added = result.get("new_added", 0)
                    results["fathom"].append(result)
                    results["total_new"] += new_added

                    # Update connector sync status
                    connector.sync_status = "success"
                    connector.last_synced_at = datetime.now(timezone.utc)
                    db.commit()

                    logger.info(f"✅ Fathom initial sync complete: {new_added} new sessions")

                except Exception as e:
                    logger.error(f"❌ Initial sync Fathom failed for workspace {workspace_id}: {e}")
                    connector.sync_status = "error"
                    db.commit()
                    results["fathom"].append({"error": str(e)})

            logger.info(f"🎉 Initial sync complete for workspace {workspace_id}: {results['total_new']} total new transcripts")
            return results

    except Exception as e:
        logger.error(f"❌ Initial sync failed for workspace {workspace_id}: {e}")
        raise self.retry(exc=e, countdown=120)

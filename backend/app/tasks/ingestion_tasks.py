"""
Celery tasks for periodic ingestion of Gong calls and Fathom sessions
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.core.config import Settings
from app.scripts.ingest_gong_calls import ingest_gong_calls
from app.scripts.ingest_fathom_sessions import ingest_fathom_sessions
from app.models.workspace import Workspace

logger = logging.getLogger(__name__)
settings = Settings()

# Create database connection for tasks
engine = create_engine(settings.DATABASE_URL)


@celery_app.task(
    name="app.tasks.ingestion_tasks.ingest_gong_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,  # Retry after 5 minutes
)
def ingest_gong_periodic(self):
    """
    Periodic task to ingest Gong calls every 15 minutes

    This task:
    - Runs every 15 minutes
    - Fetches latest Gong calls from the last 24 hours
    - Extracts features with AI
    - Updates the database
    """
    try:
        logger.info("🚀 Starting periodic Gong ingestion task")

        with Session(engine) as db:
            # Get all workspaces
            workspaces = db.query(Workspace).all()

            if not workspaces:
                logger.warning("No workspaces found. Skipping Gong ingestion.")
                return {"status": "skipped", "reason": "no_workspaces"}

            total_ingested = 0

            for workspace in workspaces:
                try:
                    logger.info(f"Ingesting Gong calls for workspace: {workspace.name}")

                    # Run the async ingestion function
                    ingested_count = asyncio.run(
                        ingest_gong_calls(
                            workspace_id=str(workspace.id),
                            limit=50,  # Get last 50 calls
                            days_back=1,  # Last 24 hours
                            fetch_transcripts=True,
                            extract_features=True,
                            session=db
                        )
                    )

                    total_ingested += ingested_count
                    logger.info(f"✅ Ingested {ingested_count} Gong calls for {workspace.name}")

                except Exception as e:
                    logger.error(f"❌ Error ingesting Gong calls for workspace {workspace.name}: {e}")
                    # Continue with next workspace instead of failing
                    continue

            logger.info(f"✅ Gong periodic ingestion complete. Total ingested: {total_ingested}")
            return {"status": "success", "total_ingested": total_ingested}

    except Exception as e:
        logger.error(f"❌ Fatal error in Gong periodic ingestion: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=600)  # Retry after 10 minutes


@celery_app.task(
    name="app.tasks.ingestion_tasks.ingest_fathom_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,  # Retry after 5 minutes
)
def ingest_fathom_periodic(self):
    """
    Periodic task to ingest Fathom sessions every 15 minutes

    This task:
    - Runs every 15 minutes (staggered by 20 seconds after Gong)
    - Fetches latest Fathom sessions from the last 24 hours
    - Extracts features with AI
    - Updates the database
    """
    try:
        logger.info("🚀 Starting periodic Fathom ingestion task")

        with Session(engine) as db:
            # Get all workspaces
            workspaces = db.query(Workspace).all()

            if not workspaces:
                logger.warning("No workspaces found. Skipping Fathom ingestion.")
                return {"status": "skipped", "reason": "no_workspaces"}

            total_ingested = 0

            for workspace in workspaces:
                try:
                    logger.info(f"Ingesting Fathom sessions for workspace: {workspace.name}")

                    # Run the async ingestion function
                    ingested_count = asyncio.run(
                        ingest_fathom_sessions(
                            workspace_id=str(workspace.id),
                            limit=50,  # Get last 50 sessions
                            days_back=1,  # Last 24 hours
                            min_duration_seconds=0,
                            extract_features=True,
                            session=db
                        )
                    )

                    total_ingested += ingested_count
                    logger.info(f"✅ Ingested {ingested_count} Fathom sessions for {workspace.name}")

                except Exception as e:
                    logger.error(f"❌ Error ingesting Fathom sessions for workspace {workspace.name}: {e}")
                    # Continue with next workspace instead of failing
                    continue

            logger.info(f"✅ Fathom periodic ingestion complete. Total ingested: {total_ingested}")
            return {"status": "success", "total_ingested": total_ingested}

    except Exception as e:
        logger.error(f"❌ Fatal error in Fathom periodic ingestion: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=600)  # Retry after 10 minutes


@celery_app.task(name="app.tasks.ingestion_tasks.health_check")
def health_check():
    """
    Health check task to verify Celery is working
    """
    logger.info("✅ Celery health check: OK")
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

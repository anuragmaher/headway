"""
Celery tasks for periodic ingestion of Gong calls, Fathom sessions, and Gmail threads
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
from app.models.gmail import GmailAccounts
from app.services.gmail_ingestion_service import gmail_ingestion_service

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


@celery_app.task(
    name="app.tasks.ingestion_tasks.ingest_gmail_threads",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=60,  # Retry after 1 minute
)
def ingest_gmail_threads(self, gmail_account_id: str, max_threads: int = 5):
    """
    Task to ingest Gmail threads from selected labels for a specific account
    
    This task:
    - Fetches last N threads from each selected label
    - Stores them in the database for AI processing
    - Updates sync status on the Gmail account
    
    Args:
        gmail_account_id: The Gmail account ID to ingest threads for
        max_threads: Maximum threads to fetch per label (default: 5)
    """
    try:
        logger.info(f"🚀 Starting Gmail thread ingestion for account {gmail_account_id}")
        
        with Session(engine) as db:
            result = gmail_ingestion_service.ingest_threads_for_account(
                gmail_account_id=gmail_account_id,
                db=db,
                max_threads=max_threads
            )
            
            if result["status"] == "error":
                logger.error(f"❌ Gmail ingestion failed: {result.get('error')}")
                raise Exception(result.get("error", "Unknown error"))
            
            logger.info(f"✅ Gmail ingestion complete. Threads ingested: {result['count']}")
            return result
            
    except Exception as e:
        logger.error(f"❌ Error in Gmail thread ingestion: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=120)


@celery_app.task(
    name="app.tasks.ingestion_tasks.ingest_gmail_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,  # Retry after 5 minutes
)
def ingest_gmail_periodic(self):
    """
    Periodic task to ingest Gmail threads for all accounts with selected labels
    
    This task:
    - Runs periodically (e.g., every 15 minutes)
    - Fetches latest Gmail threads from selected labels for all accounts
    - Updates the database with new threads
    """
    try:
        logger.info("🚀 Starting periodic Gmail ingestion task")
        
        with Session(engine) as db:
            # Get all Gmail accounts with selected labels
            gmail_accounts = db.query(GmailAccounts).filter(
                GmailAccounts.workspace_id.isnot(None)
            ).all()
            
            if not gmail_accounts:
                logger.warning("No Gmail accounts found. Skipping Gmail ingestion.")
                return {"status": "skipped", "reason": "no_accounts"}
            
            total_ingested = 0
            
            for account in gmail_accounts:
                try:
                    logger.info(f"Ingesting Gmail threads for account: {account.gmail_email}")
                    
                    result = gmail_ingestion_service.ingest_threads_for_account(
                        gmail_account_id=str(account.id),
                        db=db,
                        max_threads=5
                    )
                    
                    total_ingested += result.get("count", 0)
                    logger.info(f"✅ Ingested {result.get('count', 0)} threads for {account.gmail_email}")
                    
                except Exception as e:
                    logger.error(f"❌ Error ingesting Gmail threads for {account.gmail_email}: {e}")
                    continue
            
            logger.info(f"✅ Gmail periodic ingestion complete. Total ingested: {total_ingested}")
            return {"status": "success", "total_ingested": total_ingested}
            
    except Exception as e:
        logger.error(f"❌ Fatal error in Gmail periodic ingestion: {e}")
        raise self.retry(exc=e, countdown=600)

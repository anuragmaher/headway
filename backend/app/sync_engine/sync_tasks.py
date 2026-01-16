"""
Sync Engine - Celery tasks for periodic synchronization of all data sources

This module provides periodic sync tasks that:
1. Check for active connections before syncing
2. Only sync data sources that are actually connected
3. Handle errors gracefully and continue with other workspaces
4. Log comprehensive sync status
"""

import asyncio
import sys
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.tasks.celery_app import celery_app
from app.core.config import Settings
from app.scripts.ingest_gong_calls import ingest_gong_calls
from app.scripts.ingest_fathom_sessions import ingest_fathom_sessions
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.models.integration import Integration
from app.models.gmail import GmailAccounts
from app.services.gmail_ingestion_service import gmail_ingestion_service
from app.services.message_ingestion_service import message_ingestion_service

logger = logging.getLogger(__name__)
settings = Settings()

# Create database connection for tasks
engine = create_engine(settings.DATABASE_URL)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_slack_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,  # Retry after 5 minutes
)
def sync_slack_periodic(self):
    """
    Periodic task to sync Slack messages every 15 minutes
    
    This task:
    - Runs every 15 minutes
    - Only syncs active Slack integrations
    - Fetches messages from selected channels
    - Updates the database
    """
    try:
        logger.info("🚀 Starting periodic Slack sync task")

        with Session(engine) as db:
            # Get all active Slack integrations
            integrations = db.query(Integration).filter(
                and_(
                    Integration.provider == "slack",
                    Integration.is_active == True
                )
            ).all()

            if not integrations:
                logger.info("No active Slack integrations found. Skipping Slack sync.")
                return {"status": "skipped", "reason": "no_active_integrations", "count": 0}

            total_synced = 0
            successful_workspaces = 0
            failed_workspaces = 0

            for integration in integrations:
                try:
                    workspace = db.query(Workspace).filter(
                        Workspace.id == integration.workspace_id
                    ).first()
                    
                    if not workspace:
                        logger.warning(f"Workspace not found for integration {integration.id}")
                        continue

                    logger.info(f"Syncing Slack for workspace: {workspace.name} (Integration: {integration.external_team_name})")

                    # Sync messages from this integration
                    # Use get_event_loop() to handle existing event loops (Windows solo pool compatibility)
                    loop = None
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_closed():
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    try:
                        messages_count = loop.run_until_complete(
                            message_ingestion_service.ingest_slack_messages(
                                integration_id=str(integration.id),
                                db=db,
                                hours_back=24  # Last 24 hours
                            )
                        )
                    finally:
                        # Clean up event loop if we created a new one
                        if loop and not loop.is_closed():
                            try:
                                # Only close if we created it (not the default loop)
                                current_loop = asyncio.get_event_loop()
                                if current_loop is loop and sys.platform == "win32":
                                    # On Windows with solo pool, don't close the default loop
                                    pass
                            except RuntimeError:
                                pass

                    total_synced += messages_count
                    successful_workspaces += 1
                    logger.info(f"✅ Synced {messages_count} Slack messages for {workspace.name}")

                except Exception as e:
                    failed_workspaces += 1
                    logger.error(f"❌ Error syncing Slack for integration {integration.id}: {e}")
                    # Continue with next integration instead of failing
                    continue

            logger.info(
                f"✅ Slack periodic sync complete. "
                f"Total messages: {total_synced}, "
                f"Workspaces: {successful_workspaces} successful, {failed_workspaces} failed"
            )
            return {
                "status": "success",
                "total_messages": total_synced,
                "successful_workspaces": successful_workspaces,
                "failed_workspaces": failed_workspaces
            }

    except Exception as e:
        logger.error(f"❌ Fatal error in Slack periodic sync: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=600)  # Retry after 10 minutes


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_gong_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,  # Retry after 5 minutes
)
def sync_gong_periodic(self):
    """
    Periodic task to sync Gong calls every 15 minutes
    
    This task:
    - Runs every 15 minutes
    - Only syncs workspaces with active Gong connectors
    - Fetches latest Gong calls from the last 24 hours
    - Extracts features with AI
    - Updates the database
    """
    try:
        logger.info("🚀 Starting periodic Gong sync task")

        with Session(engine) as db:
            # Get all workspaces with active Gong connectors
            gong_connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.connector_type == "gong",
                    WorkspaceConnector.is_active == True
                )
            ).all()

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
                    # Use get_event_loop() to handle existing event loops (Windows solo pool compatibility)
                    loop = None
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_closed():
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    try:
                        ingested_count = loop.run_until_complete(
                            ingest_gong_calls(
                                workspace_id=str(workspace.id),
                                limit=50,  # Get last 50 calls
                                days_back=1,  # Last 24 hours
                                fetch_transcripts=True,
                                extract_features=True
                            )
                        )
                    finally:
                        # Clean up event loop if we created a new one
                        if loop and not loop.is_closed():
                            try:
                                current_loop = asyncio.get_event_loop()
                                if current_loop is loop and sys.platform == "win32":
                                    # On Windows with solo pool, don't close the default loop
                                    pass
                            except RuntimeError:
                                pass

                    total_ingested += ingested_count
                    successful_workspaces += 1
                    logger.info(f"✅ Synced {ingested_count} Gong calls for {workspace.name}")

                except Exception as e:
                    failed_workspaces += 1
                    logger.error(f"❌ Error syncing Gong calls for workspace {connector.workspace_id}: {e}")
                    # Continue with next connector instead of failing
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
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=600)  # Retry after 10 minutes


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_fathom_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,  # Retry after 5 minutes
)
def sync_fathom_periodic(self):
    """
    Periodic task to sync Fathom sessions every 15 minutes
    
    This task:
    - Runs every 15 minutes (staggered by 20 seconds after Gong)
    - Only syncs workspaces with active Fathom connectors
    - Fetches latest Fathom sessions from the last 24 hours
    - Extracts features with AI
    - Updates the database
    """
    try:
        logger.info("🚀 Starting periodic Fathom sync task")

        with Session(engine) as db:
            # Get all workspaces with active Fathom connectors
            fathom_connectors = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.connector_type == "fathom",
                    WorkspaceConnector.is_active == True
                )
            ).all()

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

                    # Run the async ingestion function
                    # Use get_event_loop() to handle existing event loops (Windows solo pool compatibility)
                    loop = None
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_closed():
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    try:
                        ingested_count = loop.run_until_complete(
                            ingest_fathom_sessions(
                                workspace_id=str(workspace.id),
                                limit=50,  # Get last 50 sessions
                                days_back=1,  # Last 24 hours
                                min_duration_seconds=0,
                                extract_features=True
                            )
                        )
                    finally:
                        # Clean up event loop if we created a new one
                        if loop and not loop.is_closed():
                            try:
                                current_loop = asyncio.get_event_loop()
                                if current_loop is loop and sys.platform == "win32":
                                    # On Windows with solo pool, don't close the default loop
                                    pass
                            except RuntimeError:
                                pass

                    total_ingested += ingested_count
                    successful_workspaces += 1
                    logger.info(f"✅ Synced {ingested_count} Fathom sessions for {workspace.name}")

                except Exception as e:
                    failed_workspaces += 1
                    logger.error(f"❌ Error syncing Fathom sessions for workspace {connector.workspace_id}: {e}")
                    # Continue with next connector instead of failing
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
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=600)  # Retry after 10 minutes


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_gmail_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,  # Retry after 5 minutes
)
def sync_gmail_periodic(self):
    """
    Periodic task to sync Gmail threads every 15 minutes
    
    This task:
    - Runs periodically (e.g., every 15 minutes)
    - Only syncs active Gmail accounts with selected labels
    - Fetches latest Gmail threads from selected labels
    - Updates the database with new threads
    """
    try:
        logger.info("🚀 Starting periodic Gmail sync task")
        
        with Session(engine) as db:
            # Get all Gmail accounts with workspace_id (active accounts)
            gmail_accounts = db.query(GmailAccounts).filter(
                GmailAccounts.workspace_id.isnot(None)
            ).all()
            
            if not gmail_accounts:
                logger.info("No Gmail accounts found. Skipping Gmail sync.")
                return {"status": "skipped", "reason": "no_accounts", "count": 0}
            
            total_ingested = 0
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
                    
                    result = gmail_ingestion_service.ingest_threads_for_account(
                        gmail_account_id=str(account.id),
                        db=db,
                        max_threads=5
                    )
                    
                    if result.get("status") == "error":
                        failed_accounts += 1
                        logger.error(f"❌ Gmail sync failed for {account.gmail_email}: {result.get('error')}")
                        continue
                    
                    ingested_count = result.get("count", 0)
                    total_ingested += ingested_count
                    successful_accounts += 1
                    logger.info(f"✅ Synced {ingested_count} Gmail threads for {account.gmail_email}")
                    
                except Exception as e:
                    failed_accounts += 1
                    logger.error(f"❌ Error syncing Gmail threads for {account.gmail_email}: {e}")
                    continue
            
            logger.info(
                f"✅ Gmail periodic sync complete. "
                f"Total threads: {total_ingested}, "
                f"Accounts: {successful_accounts} successful, {failed_accounts} failed"
            )
            return {
                "status": "success",
                "total_ingested": total_ingested,
                "successful_accounts": successful_accounts,
                "failed_accounts": failed_accounts
            }
            
    except Exception as e:
        logger.error(f"❌ Fatal error in Gmail periodic sync: {e}")
        raise self.retry(exc=e, countdown=600)


@celery_app.task(name="app.sync_engine.sync_tasks.health_check")
def health_check():
    """
    Health check task to verify Celery sync engine is working
    """
    logger.info("✅ Celery sync engine health check: OK")
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "sync_engine"
    }

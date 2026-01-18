"""
Base utilities for sync tasks.

Provides shared functionality used by all periodic and on-demand sync tasks:
- Database engine and session management
- Async task runner for Celery
- SyncHistory record creation and finalization
- Memory cleanup utilities
"""

import asyncio
import gc
import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Optional, List, Dict, Generator
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, text

from app.models.sync_history import SyncHistory

logger = logging.getLogger(__name__)

# Use the same database engine from the core database module
# This ensures consistent connection pooling and settings
from app.core.database import engine


def get_db_session() -> Session:
    """
    Create a new database session for Celery tasks.

    Returns:
        SQLAlchemy Session
    """
    return Session(engine)


@contextmanager
def task_db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions in Celery tasks.

    Ensures proper cleanup of database sessions and connections,
    which is critical for memory management in long-running workers.

    Usage:
        with task_db_session() as db:
            # do work
            db.commit()

    Yields:
        SQLAlchemy Session
    """
    session = Session(engine)
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def cleanup_after_task() -> None:
    """
    Cleanup function to call at the end of each task.

    Forces garbage collection to free memory, which is especially
    important for tasks that process large amounts of data.
    """
    # Clear any lingering references
    gc.collect()
    logger.debug("Task cleanup: garbage collection completed")


def run_async_task(coro) -> Any:
    """
    Safely run an async coroutine from a sync context (Celery task).

    Handles event loop creation/reuse across different platforms:
    - Windows: Uses solo pool, needs careful event loop management
    - Linux/Mac: Standard asyncio event loop handling

    Args:
        coro: Async coroutine to run

    Returns:
        Result from the coroutine
    """
    try:
        # Try to get existing event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                raise RuntimeError("Event loop is closed")
        except RuntimeError:
            # No event loop exists, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Run the coroutine
        if loop.is_running():
            # If loop is already running (e.g., in nested async context),
            # create a new loop in a thread-safe way
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)

    except Exception as e:
        logger.error(f"Error running async task: {e}")
        raise


def test_db_connection(db: Session) -> bool:
    """
    Test database connection is working.

    Args:
        db: Database session

    Returns:
        True if connection works, False otherwise
    """
    try:
        result = db.execute(text("SELECT 1")).fetchone()
        return result is not None
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


def get_active_integrations(db: Session, provider: str) -> List[Dict]:
    """
    Get all active integrations for a given provider.

    This is a diagnostic function to help debug why integrations aren't found.

    Args:
        db: Database session
        provider: Provider name (slack, gmail, etc.)

    Returns:
        List of integration dicts with id, workspace_id, is_active
    """
    from app.models.integration import Integration

    # First, let's see ALL integrations for this provider
    all_integrations = db.query(Integration).filter(
        Integration.provider == provider
    ).all()

    logger.info(f"📊 All {provider} integrations in database: {len(all_integrations)}")
    for i in all_integrations:
        logger.info(f"   - ID: {i.id}, workspace_id: {i.workspace_id}, is_active: {i.is_active}, team: {i.external_team_name}")

    # Now get only active ones
    active_integrations = db.query(Integration).filter(
        and_(
            Integration.provider == provider,
            Integration.is_active == True
        )
    ).all()

    logger.info(f"📊 Active {provider} integrations: {len(active_integrations)}")

    return [{
        'id': str(i.id),
        'workspace_id': str(i.workspace_id),
        'is_active': i.is_active,
        'external_team_name': i.external_team_name,
    } for i in active_integrations]


def get_active_connectors(db: Session, connector_type: str) -> List[Dict]:
    """
    Get all active connectors for a given type.

    This is a diagnostic function to help debug why connectors aren't found.

    Args:
        db: Database session
        connector_type: Connector type (gong, fathom, etc.)

    Returns:
        List of connector dicts with id, workspace_id, is_active
    """
    from app.models.workspace_connector import WorkspaceConnector

    # First, let's see ALL connectors of this type
    all_connectors = db.query(WorkspaceConnector).filter(
        WorkspaceConnector.connector_type == connector_type
    ).all()

    logger.info(f"📊 All {connector_type} connectors in database: {len(all_connectors)}")
    for c in all_connectors:
        logger.info(f"   - ID: {c.id}, workspace_id: {c.workspace_id}, is_active: {c.is_active}")

    # Now get only active ones
    active_connectors = db.query(WorkspaceConnector).filter(
        and_(
            WorkspaceConnector.connector_type == connector_type,
            WorkspaceConnector.is_active == True
        )
    ).all()

    logger.info(f"📊 Active {connector_type} connectors: {len(active_connectors)}")

    return [{
        'id': str(c.id),
        'workspace_id': str(c.workspace_id),
        'is_active': c.is_active,
    } for c in active_connectors]


def get_active_gmail_accounts(db: Session) -> List[Dict]:
    """
    Get all active Gmail accounts.

    This is a diagnostic function to help debug why accounts aren't found.

    Args:
        db: Database session

    Returns:
        List of account dicts with id, workspace_id, email
    """
    from app.models.gmail import GmailAccounts

    # First, let's see ALL Gmail accounts
    all_accounts = db.query(GmailAccounts).all()

    logger.info(f"📊 All Gmail accounts in database: {len(all_accounts)}")
    for a in all_accounts:
        has_tokens = bool(a.access_token and a.refresh_token)
        logger.info(f"   - ID: {a.id}, workspace_id: {a.workspace_id}, email: {a.gmail_email}, has_tokens: {has_tokens}")

    # Now get only ones with workspace_id and tokens
    active_accounts = db.query(GmailAccounts).filter(
        and_(
            GmailAccounts.workspace_id.isnot(None),
            GmailAccounts.access_token.isnot(None),
            GmailAccounts.refresh_token.isnot(None)
        )
    ).all()

    logger.info(f"📊 Active Gmail accounts (with workspace and tokens): {len(active_accounts)}")

    return [{
        'id': str(a.id),
        'workspace_id': str(a.workspace_id) if a.workspace_id else None,
        'gmail_email': a.gmail_email,
    } for a in active_accounts]


def create_sync_record(
    db: Session,
    workspace_id: str,
    source_type: str,
    source_name: str,
    integration_id: Optional[str] = None,
    gmail_account_id: Optional[str] = None,
    connector_id: Optional[str] = None,
    initial_status: str = "in_progress",
) -> SyncHistory:
    """
    Create a SyncHistory record for sync tasks.

    This ensures both periodic and on-demand syncs are tracked consistently.
    Creates record with status set to initial_status (default: in_progress).

    Args:
        db: Database session
        workspace_id: Workspace UUID
        source_type: Source type (gmail, slack, gong, fathom)
        source_name: Display name for the source
        integration_id: Optional integration UUID
        gmail_account_id: Optional Gmail account UUID
        connector_id: Optional connector UUID
        initial_status: Initial status (default: in_progress)

    Returns:
        Created SyncHistory record
    """
    try:
        logger.info(f"📝 Creating SyncHistory for workspace={workspace_id}, source={source_type}")

        sync_record = SyncHistory(
            workspace_id=UUID(workspace_id),
            sync_type="source",
            source_type=source_type,
            source_name=source_name,
            status=initial_status,  # Set status directly to in_progress
            started_at=datetime.now(timezone.utc),  # Set started_at immediately
            items_processed=0,
            items_new=0,
        )

        # Set optional foreign keys
        if integration_id:
            sync_record.integration_id = UUID(integration_id)
        if gmail_account_id:
            sync_record.gmail_account_id = UUID(gmail_account_id)
        if connector_id:
            sync_record.connector_id = UUID(connector_id)

        db.add(sync_record)
        db.flush()  # Flush to get the ID
        db.commit()
        db.refresh(sync_record)

        logger.info(f"📝 Created SyncHistory record: id={sync_record.id}, source={source_type}, name={source_name}, status={initial_status}")

        return sync_record

    except Exception as e:
        logger.error(f"❌ Failed to create SyncHistory record: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise


def finalize_sync_record(
    db: Session,
    sync_record: SyncHistory,
    status: str,
    items_processed: int = 0,
    items_new: int = 0,
    error_message: Optional[str] = None
) -> None:
    """
    Finalize a SyncHistory record after sync completes.

    Args:
        db: Database session
        sync_record: The SyncHistory record to update
        status: Final status (success, failed)
        items_processed: Number of items processed
        items_new: Number of new items
        error_message: Error message if failed
    """
    try:
        sync_record.status = status
        sync_record.items_processed = items_processed
        sync_record.items_new = items_new
        sync_record.completed_at = datetime.now(timezone.utc)

        if error_message:
            sync_record.error_message = error_message

        db.flush()
        db.commit()
        logger.info(f"✅ Finalized SyncHistory: id={sync_record.id}, status={status}, processed={items_processed}")

    except Exception as e:
        logger.error(f"❌ Failed to finalize SyncHistory record: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise


def update_sync_record(
    db: Session,
    sync_id: str,
    status: str,
    items_processed: int = 0,
    items_new: int = 0,
    error_message: Optional[str] = None
) -> None:
    """
    Update sync history record by ID.

    Used by on-demand tasks that receive sync_id from the API.

    Args:
        db: Database session
        sync_id: UUID of the sync record
        status: New status
        items_processed: Number of items processed
        items_new: Number of new items
        error_message: Error message if failed
    """
    try:
        record = db.query(SyncHistory).filter(SyncHistory.id == UUID(sync_id)).first()
        if record:
            record.status = status
            record.items_processed = items_processed
            record.items_new = items_new
            if error_message:
                record.error_message = error_message
            if status in ("success", "failed"):
                record.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"📝 Updated SyncHistory: id={sync_id}, status={status}")
    except Exception as e:
        logger.error(f"Failed to update sync record {sync_id}: {e}")
        db.rollback()

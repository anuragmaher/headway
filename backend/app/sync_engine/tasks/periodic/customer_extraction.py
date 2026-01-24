"""
Periodic Customer Extraction Task.

Extracts customer information from messages and creates/links Customer records.
Runs periodically to process messages that don't have customer_id set.
"""

import logging

from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.models.workspace import Workspace
from app.services.customer_extraction_service import customer_extraction_service
from app.sync_engine.tasks.base import (
    engine,
    test_db_connection,
    cleanup_after_task,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.extract_customers_periodic",
    bind=True,
    retry_kwargs={"max_retries": 3},
    default_retry_delay=300,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def extract_customers_periodic(self, batch_size: int = 200):
    """
    Periodic task to extract customers from messages.

    This task:
    - Finds messages without customer_id
    - Extracts customer info from email/name fields
    - Creates or links existing Customer records
    - Updates message.customer_id

    Args:
        batch_size: Number of messages to process per workspace
    """
    try:
        logger.info("🚀 Starting periodic customer extraction task")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            # Get all active workspaces
            workspaces = db.query(Workspace).filter(
                Workspace.is_active == True
            ).all()

            logger.info(f"Found {len(workspaces)} active workspaces")

            total_processed = 0
            total_linked = 0
            total_errors = 0

            for workspace in workspaces:
                try:
                    stats = customer_extraction_service.process_messages_for_customers(
                        db=db,
                        workspace_id=workspace.id,
                        batch_size=batch_size,
                    )

                    total_processed += stats.get("processed", 0)
                    total_linked += stats.get("linked", 0)
                    total_errors += stats.get("errors", 0)

                except Exception as e:
                    logger.error(f"Error extracting customers for workspace {workspace.id}: {e}")
                    total_errors += 1
                    continue

            logger.info(
                f"✅ Customer extraction complete: "
                f"{total_linked}/{total_processed} linked, {total_errors} errors"
            )

            return {
                "status": "success",
                "total_processed": total_processed,
                "total_linked": total_linked,
                "total_errors": total_errors,
            }

    except Exception as e:
        logger.error(f"❌ Fatal error in customer extraction: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=600)
    finally:
        cleanup_after_task()


@celery_app.task(
    name="app.sync_engine.sync_tasks.extract_customers_for_workspace",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=60,
)
def extract_customers_for_workspace(self, workspace_id: str, batch_size: int = 500):
    """
    Extract customers for a specific workspace.

    Args:
        workspace_id: Workspace UUID as string
        batch_size: Number of messages to process
    """
    try:
        logger.info(f"🚀 Starting customer extraction for workspace {workspace_id}")

        from uuid import UUID

        with Session(engine) as db:
            if not test_db_connection(db):
                return {"status": "error", "reason": "database_connection_failed"}

            stats = customer_extraction_service.process_messages_for_customers(
                db=db,
                workspace_id=UUID(workspace_id),
                batch_size=batch_size,
            )

            logger.info(
                f"✅ Customer extraction for workspace {workspace_id}: "
                f"{stats['linked']}/{stats['processed']} linked"
            )

            return {
                "status": "success",
                "workspace_id": workspace_id,
                **stats
            }

    except Exception as e:
        logger.error(f"❌ Error in customer extraction for workspace {workspace_id}: {e}")
        raise self.retry(exc=e, countdown=120)
    finally:
        cleanup_after_task()

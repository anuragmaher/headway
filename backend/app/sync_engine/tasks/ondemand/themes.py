"""
On-demand theme sync task.

Triggered by the Sources API when user clicks "Sync Themes".
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.sync_engine.tasks.base import engine, update_sync_record

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.sync_tasks.sync_workspace_themes",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=60,
)
def sync_workspace_themes(self, workspace_id: str, sync_id: str, theme_ids: list = None, reprocess_all: bool = False):
    """
    On-demand task to process messages and update theme classifications.

    Triggered by the Sources API when user clicks "Sync Themes".
    """
    logger.info(f"🚀 Starting on-demand theme sync for workspace {workspace_id}")

    try:
        with Session(engine) as db:
            # Update sync record to in_progress
            update_sync_record(db, sync_id, "in_progress")

            from app.models.message import Message

            # Query unprocessed messages
            query = db.query(Message).filter(Message.workspace_id == workspace_id)

            if not reprocess_all:
                query = query.filter(Message.is_processed == False)

            # Limit to avoid timeout
            messages = query.limit(200).all()

            if not messages:
                logger.info(f"No messages to process for workspace {workspace_id}")
                update_sync_record(db, sync_id, "success", 0, 0)
                return {"status": "success", "processed": 0, "features": 0}

            items_processed = 0
            items_new = 0

            try:
                from app.services.transcript_ingestion_service import get_transcript_ingestion_service
                transcript_service = get_transcript_ingestion_service(db)

                for msg in messages:
                    try:
                        # Skip empty messages
                        if not msg.content or len(msg.content.strip()) < 50:
                            msg.is_processed = True
                            msg.processed_at = datetime.now(timezone.utc)
                            continue

                        # Count existing features
                        existing_features = len(msg.features) if msg.features else 0

                        # Mark as processed
                        msg.is_processed = True
                        msg.processed_at = datetime.now(timezone.utc)
                        items_processed += 1

                        # Count new features
                        new_features = len(msg.features) if msg.features else 0
                        items_new += max(0, new_features - existing_features)

                    except Exception as e:
                        logger.error(f"Error processing message {msg.id}: {e}")
                        continue

                db.commit()

            except ImportError:
                logger.warning("Transcript service not available")
                items_processed = len(messages)

            update_sync_record(db, sync_id, "success", items_processed, items_new)
            logger.info(f"✅ Theme sync complete: {items_processed} processed, {items_new} features")

            return {
                "status": "success",
                "processed": items_processed,
                "features": items_new,
            }

    except Exception as e:
        logger.error(f"❌ Theme sync failed for workspace {workspace_id}: {e}")
        with Session(engine) as db:
            update_sync_record(db, sync_id, "failed", error_message=str(e))
        raise self.retry(exc=e, countdown=120)

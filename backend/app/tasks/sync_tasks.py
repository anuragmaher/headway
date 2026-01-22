"""
Celery tasks for data source synchronization
"""
import logging
from uuid import UUID
from datetime import datetime, timezone
from celery import shared_task

from app.core.database import SessionLocal
from app.services.connector_service import ConnectorService
from app.models.sync_history import SyncHistory, SyncType, SyncStatus, TriggerType
from app.schemas.connector import SyncStatus as ConnectorSyncStatus

logger = logging.getLogger(__name__)


@shared_task(name="tasks.trigger_connector_sync")
def trigger_connector_sync(connector_id: str, full_sync: bool = False):
    """
    Trigger a sync for a specific connector.
    Routes to the appropriate sync handler based on connector type.
    """
    db = SessionLocal()
    try:
        service = ConnectorService(db)
        connector = service.get_connector(UUID(connector_id))

        if not connector:
            logger.error(f"Connector {connector_id} not found")
            return {"status": "error", "message": "Connector not found"}

        if not connector.is_active:
            logger.warning(f"Connector {connector_id} is inactive")
            return {"status": "skipped", "message": "Connector is inactive"}

        # Create sync history record
        sync_history = SyncHistory(
            workspace_id=connector.workspace_id,
            sync_type=SyncType.SOURCE.value,
            source_type=connector.connector_type,
            source_name=connector.name or connector.external_name,
            connector_id=connector.id,
            status=SyncStatus.IN_PROGRESS.value,
            trigger_type=TriggerType.MANUAL.value
        )
        db.add(sync_history)
        db.commit()

        # Route to appropriate sync handler
        try:
            if connector.connector_type == "slack":
                result = sync_slack_connector(connector, full_sync, db)
            elif connector.connector_type == "gmail":
                result = sync_gmail_connector(connector, full_sync, db)
            elif connector.connector_type == "gong":
                result = sync_gong_connector(connector, full_sync, db)
            elif connector.connector_type == "fathom":
                result = sync_fathom_connector(connector, full_sync, db)
            else:
                raise ValueError(f"Unknown connector type: {connector.connector_type}")

            # Update sync history on success
            sync_history.mark_success(
                processed=result.get("processed", 0),
                new=result.get("new", 0),
                updated=result.get("updated", 0)
            )
            sync_history.synced_item_ids = result.get("synced_ids", [])

            # Update connector status
            service.update_sync_status(UUID(connector_id), ConnectorSyncStatus.SUCCESS)

            db.commit()
            return {"status": "success", **result}

        except Exception as e:
            logger.exception(f"Sync failed for connector {connector_id}")
            sync_history.mark_failed(str(e))
            service.update_sync_status(UUID(connector_id), ConnectorSyncStatus.FAILED, str(e))
            db.commit()
            return {"status": "error", "message": str(e)}

    finally:
        db.close()


def sync_slack_connector(connector, full_sync: bool, db) -> dict:
    """Sync messages from Slack connector"""
    from app.services.slack_sync_service import SlackSyncService

    service = SlackSyncService(db)
    return service.sync_messages(connector, full_sync=full_sync)


def sync_gmail_connector(connector, full_sync: bool, db) -> dict:
    """Sync messages from Gmail connector"""
    from app.services.gmail_sync_service import GmailSyncService

    service = GmailSyncService(db)
    return service.sync_messages(connector, full_sync=full_sync)


def sync_gong_connector(connector, full_sync: bool, db) -> dict:
    """Sync calls from Gong connector"""
    from app.services.gong_sync_service import GongSyncService

    service = GongSyncService(db)
    return service.sync_calls(connector, full_sync=full_sync)


def sync_fathom_connector(connector, full_sync: bool, db) -> dict:
    """Sync sessions from Fathom connector"""
    from app.services.fathom_sync_service import FathomSyncService

    service = FathomSyncService(db)
    return service.sync_sessions(connector, full_sync=full_sync)


@shared_task(name="tasks.periodic_sync_all_connectors")
def periodic_sync_all_connectors():
    """
    Periodic task to sync all active connectors.
    Should be scheduled via Celery Beat.
    """
    db = SessionLocal()
    try:
        from app.models.workspace_connector import WorkspaceConnector

        active_connectors = db.query(WorkspaceConnector).filter(
            WorkspaceConnector.is_active == True
        ).all()

        results = []
        for connector in active_connectors:
            try:
                # Trigger async sync for each connector
                trigger_connector_sync.delay(str(connector.id), False)
                results.append({
                    "connector_id": str(connector.id),
                    "status": "triggered"
                })
            except Exception as e:
                logger.error(f"Failed to trigger sync for {connector.id}: {e}")
                results.append({
                    "connector_id": str(connector.id),
                    "status": "error",
                    "message": str(e)
                })

        return {
            "total": len(active_connectors),
            "results": results
        }

    finally:
        db.close()


@shared_task(name="tasks.process_unprocessed_messages")
def process_unprocessed_messages(workspace_id: str, batch_size: int = 100):
    """
    Process unprocessed messages through AI pipeline.
    """
    db = SessionLocal()
    try:
        from app.services.message_service import MessageService
        from app.services.ai_processing_service import AIProcessingService

        message_service = MessageService(db)
        ai_service = AIProcessingService(db)

        messages = message_service.list_unprocessed_messages(
            UUID(workspace_id),
            limit=batch_size
        )

        processed = 0
        for message in messages:
            try:
                ai_service.process_message(message)
                message_service.mark_processed(message.id)
                processed += 1
            except Exception as e:
                logger.error(f"Failed to process message {message.id}: {e}")

        db.commit()
        return {"processed": processed, "total": len(messages)}

    finally:
        db.close()

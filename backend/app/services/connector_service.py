"""
Unified Connector Service for managing workspace data source connections.
Handles Slack, Gmail, Gong, Fathom, and other connector types.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.workspace_connector import WorkspaceConnector
from app.models.connector_label import ConnectorLabel
from app.schemas.connector import (
    ConnectorCreate, ConnectorUpdate, ConnectorResponse,
    ConnectorLabelCreate, ConnectorType, SyncStatus
)


class ConnectorService:
    """Service for managing workspace connectors"""

    def __init__(self, db: Session):
        self.db = db

    # === CRUD Operations ===

    def create_connector(
        self,
        workspace_id: UUID,
        data: ConnectorCreate,
        user_id: Optional[UUID] = None
    ) -> WorkspaceConnector:
        """Create a new connector"""
        connector = WorkspaceConnector(
            workspace_id=workspace_id,
            user_id=user_id,
            connector_type=data.connector_type.value,
            name=data.name,
            access_token=data.access_token,
            refresh_token=data.refresh_token,
            token_expires_at=data.token_expires_at,
            credentials=data.credentials,
            external_id=data.external_id,
            external_name=data.external_name,
            config=data.config or {},
            is_active=True,
            sync_status=SyncStatus.PENDING.value
        )
        self.db.add(connector)
        self.db.commit()
        self.db.refresh(connector)
        return connector

    def get_connector(self, connector_id: UUID) -> Optional[WorkspaceConnector]:
        """Get a connector by ID"""
        return self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.id == connector_id
        ).first()

    def get_connector_by_external_id(
        self,
        workspace_id: UUID,
        connector_type: str,
        external_id: str
    ) -> Optional[WorkspaceConnector]:
        """Get a connector by workspace, type, and external ID"""
        return self.db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == workspace_id,
                WorkspaceConnector.connector_type == connector_type,
                WorkspaceConnector.external_id == external_id
            )
        ).first()

    def list_connectors(
        self,
        workspace_id: UUID,
        connector_type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[WorkspaceConnector]:
        """List connectors for a workspace"""
        query = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace_id
        )

        if connector_type:
            query = query.filter(WorkspaceConnector.connector_type == connector_type)

        if is_active is not None:
            query = query.filter(WorkspaceConnector.is_active == is_active)

        return query.order_by(WorkspaceConnector.created_at.desc()).all()

    def update_connector(
        self,
        connector_id: UUID,
        data: ConnectorUpdate
    ) -> Optional[WorkspaceConnector]:
        """Update a connector"""
        connector = self.get_connector(connector_id)
        if not connector:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(connector, field, value)

        connector.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(connector)
        return connector

    def delete_connector(self, connector_id: UUID) -> bool:
        """Delete a connector"""
        connector = self.get_connector(connector_id)
        if not connector:
            return False

        self.db.delete(connector)
        self.db.commit()
        return True

    def deactivate_connector(self, connector_id: UUID) -> Optional[WorkspaceConnector]:
        """Soft delete by deactivating a connector"""
        connector = self.get_connector(connector_id)
        if not connector:
            return None

        connector.is_active = False
        connector.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(connector)
        return connector

    # === Token Management ===

    def update_tokens(
        self,
        connector_id: UUID,
        access_token: str,
        refresh_token: Optional[str] = None,
        expires_at: Optional[datetime] = None
    ) -> Optional[WorkspaceConnector]:
        """Update OAuth tokens for a connector"""
        connector = self.get_connector(connector_id)
        if not connector:
            return None

        connector.access_token = access_token
        if refresh_token:
            connector.refresh_token = refresh_token
        if expires_at:
            connector.token_expires_at = expires_at

        connector.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(connector)
        return connector

    def is_token_expired(self, connector: WorkspaceConnector) -> bool:
        """Check if connector token is expired"""
        if not connector.token_expires_at:
            return False
        return connector.token_expires_at < datetime.now(timezone.utc)

    # === Sync Status Management ===

    def update_sync_status(
        self,
        connector_id: UUID,
        status: SyncStatus,
        error_message: Optional[str] = None
    ) -> Optional[WorkspaceConnector]:
        """Update connector sync status"""
        connector = self.get_connector(connector_id)
        if not connector:
            return None

        connector.sync_status = status.value
        connector.sync_error = error_message

        if status == SyncStatus.SUCCESS:
            connector.last_synced_at = datetime.now(timezone.utc)
            connector.sync_error = None

        connector.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(connector)
        return connector

    # === Label Management ===

    def add_label(
        self,
        connector_id: UUID,
        label_id: str,
        label_name: Optional[str] = None,
        is_enabled: bool = False
    ) -> ConnectorLabel:
        """Add a label to a connector"""
        label = ConnectorLabel(
            connector_id=connector_id,
            label_id=label_id,
            label_name=label_name,
            is_enabled=is_enabled
        )
        self.db.add(label)
        self.db.commit()
        self.db.refresh(label)
        return label

    def get_labels(self, connector_id: UUID) -> List[ConnectorLabel]:
        """Get all labels for a connector"""
        return self.db.query(ConnectorLabel).filter(
            ConnectorLabel.connector_id == connector_id
        ).all()

    def get_enabled_labels(self, connector_id: UUID) -> List[ConnectorLabel]:
        """Get enabled labels for a connector"""
        return self.db.query(ConnectorLabel).filter(
            and_(
                ConnectorLabel.connector_id == connector_id,
                ConnectorLabel.is_enabled == True
            )
        ).all()

    def update_label(
        self,
        label_id: UUID,
        is_enabled: bool
    ) -> Optional[ConnectorLabel]:
        """Update a label's enabled status"""
        label = self.db.query(ConnectorLabel).filter(
            ConnectorLabel.id == label_id
        ).first()

        if not label:
            return None

        label.is_enabled = is_enabled
        self.db.commit()
        self.db.refresh(label)
        return label

    def sync_labels(
        self,
        connector_id: UUID,
        labels: List[Dict[str, Any]]
    ) -> List[ConnectorLabel]:
        """Sync labels from source (add new, update existing)"""
        existing_labels = {l.label_id: l for l in self.get_labels(connector_id)}
        result = []

        for label_data in labels:
            label_id = label_data.get("id")
            label_name = label_data.get("name")

            if label_id in existing_labels:
                # Update existing
                existing = existing_labels[label_id]
                if existing.label_name != label_name:
                    existing.label_name = label_name
                    self.db.commit()
                result.append(existing)
            else:
                # Create new
                new_label = self.add_label(
                    connector_id=connector_id,
                    label_id=label_id,
                    label_name=label_name,
                    is_enabled=False
                )
                result.append(new_label)

        return result

    def enable_labels(
        self,
        connector_id: UUID,
        label_ids: List[str]
    ) -> List[ConnectorLabel]:
        """Enable specific labels by their source IDs"""
        labels = self.db.query(ConnectorLabel).filter(
            and_(
                ConnectorLabel.connector_id == connector_id,
                ConnectorLabel.label_id.in_(label_ids)
            )
        ).all()

        for label in labels:
            label.is_enabled = True

        # Disable labels not in the list
        self.db.query(ConnectorLabel).filter(
            and_(
                ConnectorLabel.connector_id == connector_id,
                ~ConnectorLabel.label_id.in_(label_ids)
            )
        ).update({"is_enabled": False}, synchronize_session=False)

        self.db.commit()
        return labels

    # === Config Management ===

    def update_config(
        self,
        connector_id: UUID,
        config: Dict[str, Any],
        merge: bool = True
    ) -> Optional[WorkspaceConnector]:
        """Update connector configuration"""
        connector = self.get_connector(connector_id)
        if not connector:
            return None

        if merge and connector.config:
            connector.config = {**connector.config, **config}
        else:
            connector.config = config

        connector.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(connector)
        return connector

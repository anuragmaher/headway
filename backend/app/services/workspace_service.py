"""
Workspace management service for connector operations
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from uuid import UUID
import logging
from typing import List, Optional, Union

from app.models.workspace_connector import WorkspaceConnector, ConnectorType
from app.models.workspace import Workspace
from app.schemas.workspace_connector import (
    WorkspaceConnectorResponse,
    GongConnectorCreate,
    FathomConnectorCreate,
    WorkspaceConnectorUpdate
)

logger = logging.getLogger(__name__)


class WorkspaceService:
    """Service class for workspace operations"""

    def __init__(self, db: Session):
        self.db = db

    def save_connector(
        self,
        workspace_id: UUID,
        connector_data: Union[GongConnectorCreate, FathomConnectorCreate]
    ) -> WorkspaceConnectorResponse:
        """
        Save or update a workspace connector.

        Args:
            workspace_id: UUID of the workspace
            connector_data: Connector creation data (Gong or Fathom)

        Returns:
            WorkspaceConnectorResponse with masked credentials

        Raises:
            HTTPException: If workspace doesn't exist or validation fails
        """
        # Verify workspace exists
        workspace = self.db.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        # Check if connector of this type already exists
        existing_connector = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace_id,
            WorkspaceConnector.connector_type == connector_data.connector_type
        ).first()

        try:
            if existing_connector:
                # Update existing connector
                logger.info(f"Updating connector {existing_connector.id} for workspace {workspace_id}")

                if connector_data.connector_type == "gong":
                    existing_connector.credentials = {
                        "access_key": connector_data.gong_access_key,
                        "secret_key": connector_data.gong_secret_key
                    }
                elif connector_data.connector_type == "fathom":
                    existing_connector.credentials = {
                        "api_token": connector_data.fathom_api_token
                    }

                existing_connector.is_active = True
                self.db.commit()
                self.db.refresh(existing_connector)

                response = WorkspaceConnectorResponse.from_orm(existing_connector)
            else:
                # Create new connector
                logger.info(f"Creating new {connector_data.connector_type} connector for workspace {workspace_id}")

                # Prepare credentials based on type
                credentials = {}
                if connector_data.connector_type == "gong":
                    credentials = {
                        "access_key": connector_data.gong_access_key,
                        "secret_key": connector_data.gong_secret_key
                    }
                elif connector_data.connector_type == "fathom":
                    credentials = {
                        "api_token": connector_data.fathom_api_token
                    }

                new_connector = WorkspaceConnector(
                    workspace_id=workspace_id,
                    connector_type=connector_data.connector_type,
                    credentials=credentials,
                    is_active=True
                )

                self.db.add(new_connector)
                self.db.commit()
                self.db.refresh(new_connector)

                response = WorkspaceConnectorResponse.from_orm(new_connector)

            # Mask credentials before returning
            return response.mask_credentials()

        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database error creating connector: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to save connector. Please verify your data."
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Unexpected error saving connector: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

    def get_connectors(self, workspace_id: UUID) -> List[WorkspaceConnectorResponse]:
        """
        Get all connectors for a workspace.

        Args:
            workspace_id: UUID of the workspace

        Returns:
            List of WorkspaceConnectorResponse with masked credentials

        Raises:
            HTTPException: If workspace doesn't exist
        """
        # Verify workspace exists
        workspace = self.db.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        connectors = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace_id
        ).all()

        return [
            WorkspaceConnectorResponse.from_orm(c).mask_credentials()
            for c in connectors
        ]

    def get_connector_by_type(
        self,
        workspace_id: UUID,
        connector_type: str
    ) -> Optional[WorkspaceConnector]:
        """
        Get a specific connector by type (used by ingestion scripts).

        Args:
            workspace_id: UUID of the workspace
            connector_type: Type of connector ('gong' or 'fathom')

        Returns:
            WorkspaceConnector with full credentials, or None if not found

        Note: This method returns full credentials (not masked) for use by ingestion scripts
        """
        return self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace_id,
            WorkspaceConnector.connector_type == connector_type,
            WorkspaceConnector.is_active == True
        ).first()

    def update_connector(
        self,
        workspace_id: UUID,
        connector_id: UUID,
        connector_data: WorkspaceConnectorUpdate
    ) -> WorkspaceConnectorResponse:
        """
        Update a specific connector's credentials.

        Args:
            workspace_id: UUID of the workspace
            connector_id: UUID of the connector
            connector_data: Update data with optional credentials

        Returns:
            Updated WorkspaceConnectorResponse with masked credentials

        Raises:
            HTTPException: If connector not found or validation fails
        """
        connector = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.id == connector_id,
            WorkspaceConnector.workspace_id == workspace_id
        ).first()

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connector not found"
            )

        try:
            # Update credentials from request
            updated_creds = connector.credentials or {}

            if connector_data.gong_access_key is not None:
                updated_creds["access_key"] = connector_data.gong_access_key
            if connector_data.gong_secret_key is not None:
                updated_creds["secret_key"] = connector_data.gong_secret_key
            if connector_data.fathom_api_token is not None:
                updated_creds["api_token"] = connector_data.fathom_api_token

            connector.credentials = updated_creds
            self.db.commit()
            self.db.refresh(connector)

            response = WorkspaceConnectorResponse.from_orm(connector)
            return response.mask_credentials()

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating connector: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update connector"
            )

    def delete_connector(
        self,
        workspace_id: UUID,
        connector_id: UUID
    ) -> dict:
        """
        Delete a connector from a workspace.

        Args:
            workspace_id: UUID of the workspace
            connector_id: UUID of the connector

        Returns:
            Success message

        Raises:
            HTTPException: If connector not found
        """
        connector = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.id == connector_id,
            WorkspaceConnector.workspace_id == workspace_id
        ).first()

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connector not found"
            )

        try:
            logger.info(f"Deleting connector {connector_id} from workspace {workspace_id}")
            self.db.delete(connector)
            self.db.commit()

            return {"message": "Connector deleted successfully"}

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting connector: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete connector"
            )

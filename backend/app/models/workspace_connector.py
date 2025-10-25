from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from typing import Dict, Any, Optional

from app.core.database import Base


class ConnectorType(str, enum.Enum):
    """Supported connector types"""
    GONG = "gong"
    FATHOM = "fathom"


class WorkspaceConnector(Base):
    """Workspace connector credentials - generic table for any connector type"""

    __tablename__ = "workspace_connectors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    connector_type = Column(String, nullable=False)  # 'gong', 'fathom', etc.

    # Generic credentials storage as JSONB
    # For Gong: {"access_key": "...", "secret_key": "..."}
    # For Fathom: {"api_token": "..."}
    credentials = Column(JSONB, nullable=False)

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="connectors")

    def __repr__(self) -> str:
        return f"<WorkspaceConnector(id={self.id}, workspace_id={self.workspace_id}, type='{self.connector_type}')>"

    def get_credential(self, key: str) -> Optional[str]:
        """Get a specific credential value by key"""
        return self.credentials.get(key) if self.credentials else None

    def set_credentials(self, creds: Dict[str, Any]) -> None:
        """Set credentials from a dictionary"""
        self.credentials = creds

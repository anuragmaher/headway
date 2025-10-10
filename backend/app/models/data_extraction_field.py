from sqlalchemy import Column, String, DateTime, ForeignKey, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class DataExtractionField(Base):
    """
    Data extraction field definitions for a workspace.

    This table stores the schema/configuration for what data points
    should be extracted from messages in a workspace.
    """

    __tablename__ = "data_extraction_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign keys
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)

    # Field definition
    field_name = Column(String, nullable=False)  # e.g., "Customer Name", "MRR"
    field_type = Column(String, nullable=False)  # 'customer_name', 'mrr', 'urgency', 'product', 'custom'
    data_type = Column(String, nullable=False)  # 'string', 'number', 'boolean', 'date', 'array'
    description = Column(String, nullable=True)  # Description of what this field represents

    # Metadata
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    workspace = relationship("Workspace")

    # Indexes for fast querying
    __table_args__ = (
        Index('idx_data_extraction_fields_workspace', 'workspace_id'),
        Index('idx_data_extraction_fields_workspace_active', 'workspace_id', 'is_active'),
    )

    def __repr__(self) -> str:
        return f"<DataExtractionField(field_name={self.field_name}, field_type={self.field_type}, data_type={self.data_type})>"

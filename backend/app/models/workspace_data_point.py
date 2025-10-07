from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class WorkspaceDataPoint(Base):
    """
    Aggregated data points for analytics and fast querying.

    This table stores extracted data points from features for efficient
    aggregation and analysis across a workspace.
    """

    __tablename__ = "workspace_data_points"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign keys
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    feature_id = Column(UUID(as_uuid=True), ForeignKey("features.id"), nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False)

    # Data point identification
    data_point_key = Column(String, nullable=False)  # e.g., "mrr", "urgency_score", "pain_level"
    data_point_category = Column(String, nullable=False)  # e.g., "business_metrics", "structured_metrics", "entities"

    # Values (only one will be populated based on data type)
    numeric_value = Column(Float, nullable=True)  # For numbers that can be aggregated
    integer_value = Column(Integer, nullable=True)  # For counts, scores, etc.
    text_value = Column(String, nullable=True)  # For strings like customer names, statuses

    # Metadata
    author = Column(String, nullable=True)  # Who provided this data point
    extracted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    workspace = relationship("Workspace")
    feature = relationship("Feature")
    message = relationship("Message")

    # Indexes for fast querying
    __table_args__ = (
        Index('idx_workspace_data_points_workspace_key', 'workspace_id', 'data_point_key'),
        Index('idx_workspace_data_points_category', 'workspace_id', 'data_point_category'),
        Index('idx_workspace_data_points_feature', 'feature_id'),
        Index('idx_workspace_data_points_numeric', 'workspace_id', 'data_point_key', 'numeric_value'),
    )

    def __repr__(self) -> str:
        value = self.numeric_value or self.integer_value or self.text_value
        return f"<WorkspaceDataPoint(key={self.data_point_key}, value={value})>"
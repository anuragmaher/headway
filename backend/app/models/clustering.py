from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class ClusteringRun(Base):
    """Tracks clustering analysis runs for workspaces"""

    __tablename__ = "clustering_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)

    # Run metadata
    run_name = Column(String, nullable=False)  # e.g., "Initial Discovery Run - Oct 2025"
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="running")  # running, completed, failed

    # Analysis parameters
    messages_analyzed = Column(Integer, nullable=False, default=0)
    clusters_discovered = Column(Integer, nullable=False, default=0)
    confidence_threshold = Column(Float, nullable=False, default=0.7)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="clustering_runs")

    def __repr__(self) -> str:
        return f"<ClusteringRun(id={self.id}, name='{self.run_name}', status='{self.status}')>"


class DiscoveredCluster(Base):
    """Stores discovered feature clusters from AI analysis (stub for backward compatibility)"""

    __tablename__ = "discovered_clusters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    clustering_run_id = Column(UUID(as_uuid=True), ForeignKey("clustering_runs.id"), nullable=True)

    # Cluster metadata
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    representative_text = Column(Text, nullable=True)
    keywords = Column(Text, nullable=True)  # JSON array stored as text

    # Analysis data
    message_count = Column(Integer, nullable=False, default=0)
    confidence_score = Column(Float, nullable=False, default=0.0)
    status = Column(String, nullable=False, default="pending")  # pending, approved, rejected

    # Theme assignment
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<DiscoveredCluster(id={self.id}, name='{self.name}')>"


class ClassificationSignal(Base):
    """Stores classification signals from messages (stub for backward compatibility)"""

    __tablename__ = "classification_signals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False)
    cluster_id = Column(UUID(as_uuid=True), ForeignKey("discovered_clusters.id"), nullable=True)

    # Classification data
    signal_type = Column(String, nullable=False)  # feature_request, bug_report, etc.
    signal_text = Column(Text, nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<ClassificationSignal(id={self.id}, type='{self.signal_type}')>"
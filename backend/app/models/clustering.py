from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
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
    discovered_clusters = relationship("DiscoveredCluster", back_populates="clustering_run", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ClusteringRun(id={self.id}, name='{self.run_name}', status='{self.status}')>"


class DiscoveredCluster(Base):
    """Clusters discovered by LLM analysis with customer approval status"""

    __tablename__ = "discovered_clusters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    clustering_run_id = Column(UUID(as_uuid=True), ForeignKey("clustering_runs.id"), nullable=False)

    # Cluster details
    cluster_name = Column(String, nullable=False)  # e.g., "Email Security Features"
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)  # Core Features, Integrations, UI/UX, etc.
    theme = Column(String, nullable=False)  # Security, Productivity, etc.

    # Analysis results
    confidence_score = Column(Float, nullable=False)  # 0.0 to 1.0
    message_count = Column(Integer, nullable=False)  # Number of messages in this cluster
    business_impact = Column(Text, nullable=True)
    example_messages = Column(JSONB, nullable=True)  # Sample message IDs and snippets

    # Customer approval workflow
    approval_status = Column(String, nullable=False, default="pending")  # pending, approved, rejected, modified
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    customer_feedback = Column(Text, nullable=True)  # Notes from customer during approval

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    clustering_run = relationship("ClusteringRun", back_populates="discovered_clusters")
    approved_by_user = relationship("User", foreign_keys=[approved_by])
    classification_signals = relationship("ClassificationSignal", back_populates="source_cluster", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<DiscoveredCluster(id={self.id}, name='{self.cluster_name}', status='{self.approval_status}')>"


class ClassificationSignal(Base):
    """Learned signals for fast classification, derived from approved clusters"""

    __tablename__ = "classification_signals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    source_cluster_id = Column(UUID(as_uuid=True), ForeignKey("discovered_clusters.id"), nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)

    # Signal details
    signal_type = Column(String, nullable=False)  # keyword, pattern, semantic, business_rule
    signal_name = Column(String, nullable=False)  # Human readable name

    # Signal configuration
    keywords = Column(JSONB, nullable=True)  # List of keywords for keyword-based signals
    patterns = Column(JSONB, nullable=True)  # Regex patterns for pattern-based signals
    semantic_threshold = Column(Float, nullable=True)  # For semantic similarity signals
    business_rules = Column(JSONB, nullable=True)  # Complex business logic rules

    # Classification output
    target_category = Column(String, nullable=False)  # What this signal classifies to
    target_theme = Column(String, nullable=False)
    priority_weight = Column(Float, nullable=False, default=1.0)  # Weight in classification decision

    # Performance tracking
    precision = Column(Float, nullable=True)  # Tracking performance over time
    recall = Column(Float, nullable=True)
    usage_count = Column(Integer, nullable=False, default=0)  # How often this signal fires

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    source_cluster = relationship("DiscoveredCluster", back_populates="classification_signals")
    workspace = relationship("Workspace", back_populates="classification_signals")

    def __repr__(self) -> str:
        return f"<ClassificationSignal(id={self.id}, name='{self.signal_name}', type='{self.signal_type}')>"
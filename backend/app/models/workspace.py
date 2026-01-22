from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Workspace(Base):
    """Workspace model representing a team/organization context"""

    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Company relationship
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    company = relationship("Company", back_populates="workspaces")
    users = relationship("User", back_populates="workspace", foreign_keys="User.workspace_id")
    themes = relationship("Theme", back_populates="workspace", cascade="all, delete-orphan")
    sub_themes = relationship("SubTheme", back_populates="workspace", cascade="all, delete-orphan")
    customer_asks = relationship("CustomerAsk", back_populates="workspace", cascade="all, delete-orphan")
    workspace_connectors = relationship("WorkspaceConnector", back_populates="workspace", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="workspace", cascade="all, delete-orphan")
    ai_insights = relationship("AIInsight", back_populates="workspace", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="workspace", cascade="all, delete-orphan")
    competitors = relationship("Competitor", back_populates="workspace", cascade="all, delete-orphan")
    sync_history = relationship("SyncHistory", back_populates="workspace", cascade="all, delete-orphan")
    onboarding_progress = relationship("OnboardingProgress", back_populates="workspace", uselist=False, cascade="all, delete-orphan")

    # AI pipeline tables (kept)
    normalized_events = relationship("NormalizedEvent", back_populates="workspace", cascade="all, delete-orphan")
    event_chunks = relationship("EventChunk", back_populates="workspace", cascade="all, delete-orphan")
    extracted_facts = relationship("ExtractedFact", back_populates="workspace", cascade="all, delete-orphan")
    aggregation_runs = relationship("AggregationRun", back_populates="workspace", cascade="all, delete-orphan")
    clustering_runs = relationship("ClusteringRun", back_populates="workspace", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Workspace(id={self.id}, name='{self.name}')>"

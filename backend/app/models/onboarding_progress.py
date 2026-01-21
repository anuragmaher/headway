"""
OnboardingProgress model for storing wizard progress per workspace.
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class OnboardingProgress(Base):
    """
    Stores onboarding wizard progress per workspace.
    Allows users to resume onboarding if interrupted.
    """

    __tablename__ = "onboarding_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    # Current step (0-3)
    current_step = Column(Integer, default=0, nullable=False)

    # Note: Company data is stored directly in the companies table, not here

    # Step 2: Taxonomy generation
    taxonomy_url = Column(String(500), nullable=True)
    taxonomy_data = Column(JSONB, nullable=True)
    selected_themes = Column(JSONB, nullable=True)

    # Step 3: Connected data sources
    connected_sources = Column(JSONB, nullable=True)

    # Step 4: Selected competitors
    selected_competitors = Column(JSONB, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationship
    workspace = relationship("Workspace", back_populates="onboarding_progress")

    def __repr__(self) -> str:
        return f"<OnboardingProgress(id={self.id}, workspace_id={self.workspace_id}, step={self.current_step})>"

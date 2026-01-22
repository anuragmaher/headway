"""
OnboardingProgress model for storing wizard progress per workspace.
Simplified to only track current step - data is stored in proper tables.
"""

from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class OnboardingProgress(Base):
    """
    Stores onboarding wizard step progress per workspace.

    Note: Simplified model - data is now stored in proper tables:
    - Company data → companies table
    - Selected themes/sub_themes → themes & sub_themes tables
    - Connected sources → workspace_connectors table
    - Selected competitors → competitors table
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

    # Current step (0-4)
    current_step = Column(Integer, default=0, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationship
    workspace = relationship("Workspace", back_populates="onboarding_progress")

    def __repr__(self) -> str:
        return f"<OnboardingProgress(id={self.id}, workspace_id={self.workspace_id}, step={self.current_step})>"

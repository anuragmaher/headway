from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Company(Base):
    """Company model for organization management"""

    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    size = Column(String, nullable=True)  # Team size from onboarding (e.g., "1-10", "11-50")
    domain = Column(String, nullable=True, index=True)  # company.com - extracted from email
    industry = Column(String, nullable=True)  # Industry from onboarding
    website = Column(String, nullable=True)  # Company website from onboarding

    # Company settings
    is_active = Column(Boolean, default=True, nullable=False)
    subscription_plan = Column(String, default="free", nullable=False)  # "free", "pro", "enterprise"
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
    workspaces = relationship("Workspace", back_populates="company")
    
    def __repr__(self) -> str:
        return f"<Company(id={self.id}, name='{self.name}', size='{self.size}')>"
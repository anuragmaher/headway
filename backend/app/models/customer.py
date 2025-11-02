from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Customer(Base):
    """
    Customer/Company model for storing account information from CRM systems.

    This consolidates customer data from various sources (HubSpot, Salesforce, etc.)
    and allows efficient querying and slicing of messages by customer attributes.
    """

    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Basic Information
    name = Column(String, nullable=False, index=True)
    domain = Column(String, nullable=True, index=True)  # Primary domain/website
    industry = Column(String, nullable=True, index=True)  # For slicing by industry

    # Contact Information
    website = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    contact_name = Column(String, nullable=True)  # Primary contact person name
    contact_email = Column(String, nullable=True, index=True)  # Primary contact email

    # Additional customer context
    use_cases = Column(Text, nullable=True)  # Customer use cases and how they use the product

    # CRM Integration
    external_system = Column(String, nullable=True)  # "hubspot", "salesforce", etc.
    external_id = Column(String, nullable=True, index=True)  # CRM object ID

    # Business Metrics (for slicing/filtering)
    mrr = Column(Float, nullable=True)  # Monthly Recurring Revenue
    arr = Column(Float, nullable=True)  # Annual Recurring Revenue
    deal_stage = Column(String, nullable=True, index=True)  # Current deal stage
    deal_amount = Column(Float, nullable=True)  # Current deal value
    deal_close_date = Column(DateTime(timezone=True), nullable=True)
    deal_probability = Column(Float, nullable=True)  # 0.0 to 1.0

    # Additional metadata
    customer_metadata = Column(JSONB, nullable=True)  # Store all CRM fields

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Workspace relationship
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)  # Last message/call

    # Relationships
    workspace = relationship("Workspace", back_populates="customers")
    messages = relationship("Message", back_populates="customer")

    # Indexes for common queries
    __table_args__ = (
        Index('idx_customers_workspace', 'workspace_id'),
        Index('idx_customers_workspace_industry', 'workspace_id', 'industry'),
        Index('idx_customers_workspace_stage', 'workspace_id', 'deal_stage'),
        Index('idx_customers_external', 'external_system', 'external_id'),
        Index('idx_customers_domain', 'domain'),
    )

    def __repr__(self) -> str:
        return f"<Customer(id={self.id}, name='{self.name}', domain='{self.domain}')>"

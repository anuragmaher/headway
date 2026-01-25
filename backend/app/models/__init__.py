"""
Database models for HeadwayHQ

All SQLAlchemy models are imported here to ensure they are registered
with the Base metadata for Alembic migrations.
"""

# Core models
from app.models.company import Company
from app.models.user import User
from app.models.workspace import Workspace

# Theme hierarchy
from app.models.theme import Theme
from app.models.sub_theme import SubTheme
from app.models.customer_ask import CustomerAsk

# Data sources
from app.models.workspace_connector import WorkspaceConnector
from app.models.connector_label import ConnectorLabel
from app.models.message import Message
from app.models.message_customer_ask import MessageCustomerAsk

# AI insights
from app.models.ai_insight import AIInsight

# CRM
from app.models.customer import Customer
from app.models.competitor import Competitor

# Progress tracking
from app.models.onboarding_progress import OnboardingProgress
from app.models.sync_history import SyncHistory

# AI pipeline (kept)
from app.models.normalized_event import NormalizedEvent, EventChunk
from app.models.extracted_fact import ExtractedFact, AggregationRun
from app.models.clustering import ClusteringRun

# Transcript classifications
from app.models.transcript_classification import TranscriptClassification

__all__ = [
    # Core
    "Company",
    "User",
    "Workspace",
    # Theme hierarchy
    "Theme",
    "SubTheme",
    "CustomerAsk",
    # Data sources
    "WorkspaceConnector",
    "ConnectorLabel",
    "Message",
    "MessageCustomerAsk",
    # AI insights
    "AIInsight",
    # CRM
    "Customer",
    "Competitor",
    # Progress tracking
    "OnboardingProgress",
    "SyncHistory",
    # AI pipeline
    "NormalizedEvent",
    "EventChunk",
    "ExtractedFact",
    "AggregationRun",
    "ClusteringRun",
    # Transcript classifications
    "TranscriptClassification",
]

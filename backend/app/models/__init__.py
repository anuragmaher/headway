"""
Database models for HeadwayHQ

All SQLAlchemy models are imported here to ensure they are registered
with the Base metadata for Alembic migrations.
"""

from app.models.user import User
from app.models.company import Company
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.models.theme import Theme
from app.models.feature import Feature
from app.models.integration import Integration
from app.models.message import Message, feature_messages
from app.models.customer import Customer
from app.models.clustering import ClusteringRun, DiscoveredCluster, ClassificationSignal
from app.models.workspace_data_point import WorkspaceDataPoint
from app.models.data_extraction_field import DataExtractionField
from app.models.gmail import GmailAccounts, GmailLabels, GmailThread
from app.models.competitor import Competitor
from app.models.sync_history import SyncHistory
from app.models.normalized_event import NormalizedEvent, EventChunk
from app.models.extracted_fact import ExtractedFact, AggregationRun

__all__ = [
    "User",
    "Company",
    "Workspace",
    "WorkspaceConnector",
    "Theme",
    "Feature",
    "Integration",
    "Message",
    "feature_messages",
    "Customer",
    "ClusteringRun",
    "DiscoveredCluster",
    "ClassificationSignal",
    "WorkspaceDataPoint",
    "DataExtractionField",
    "GmailAccounts",
    "GmailLabels",
    "GmailThread",
    "Competitor",
    "SyncHistory",
    "NormalizedEvent",
    "EventChunk",
    "ExtractedFact",
    "AggregationRun",
]
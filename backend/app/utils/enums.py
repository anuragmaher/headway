"""
Enums and constants for HeadwayHQ backend
"""

from enum import Enum


class UserRole(str, Enum):
    """User role enumeration"""
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"


class ThemePreference(str, Enum):
    """Theme preference enumeration"""
    LIGHT = "light"
    DARK = "dark"


class FeatureStatus(str, Enum):
    """Feature status enumeration"""
    NEW = "new"
    UNDER_REVIEW = "under-review"
    PLANNED = "planned"
    IN_PROGRESS = "in-progress"
    SHIPPED = "shipped"
    REJECTED = "rejected"


class FeatureUrgency(str, Enum):
    """Feature urgency enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IntegrationType(str, Enum):
    """Integration type enumeration"""
    SLACK = "slack"
    GMAIL = "gmail"
    EMAIL = "email"


class MessageSource(str, Enum):
    """Message source enumeration"""
    SLACK = "slack"
    EMAIL = "email"
    GMAIL = "gmail"


class SyncStatus(str, Enum):
    """Sync status enumeration"""
    PENDING = "pending"
    SYNCING = "syncing"
    SUCCESS = "success"
    ERROR = "error"


# Default theme configurations
DEFAULT_THEMES = [
    {
        "name": "Design",
        "description": "UI/UX design and visual improvements",
        "color": "#E91E63",  # Pink
        "icon": "PaletteIcon",
        "sort_order": 1,
        "is_default": True
    },
    {
        "name": "Analytics", 
        "description": "Data analysis, reporting, and metrics",
        "color": "#FF9800",  # Orange
        "icon": "AnalyticsIcon",
        "sort_order": 2,
        "is_default": True
    },
    {
        "name": "Integrations",
        "description": "Third-party integrations and APIs",
        "color": "#9C27B0",  # Purple
        "icon": "IntegrationInstructionsIcon",
        "sort_order": 3,
        "is_default": True
    },
    {
        "name": "Security",
        "description": "Security features and authentication",
        "color": "#F44336",  # Red
        "icon": "SecurityIcon",
        "sort_order": 4,
        "is_default": True
    },
    {
        "name": "Mobile",
        "description": "Mobile app features and improvements",
        "color": "#4CAF50",  # Green
        "icon": "PhoneIphoneIcon",
        "sort_order": 5,
        "is_default": True
    }
]
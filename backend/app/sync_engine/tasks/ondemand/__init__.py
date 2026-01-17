"""
On-demand sync tasks triggered by the Sources API.

These tasks are triggered when a user clicks "Sync All Sources" or "Sync Themes".
"""

from app.sync_engine.tasks.ondemand.gmail import sync_workspace_gmail
from app.sync_engine.tasks.ondemand.slack import sync_workspace_slack
from app.sync_engine.tasks.ondemand.gong import sync_workspace_gong
from app.sync_engine.tasks.ondemand.fathom import sync_workspace_fathom
from app.sync_engine.tasks.ondemand.themes import sync_workspace_themes

__all__ = [
    "sync_workspace_gmail",
    "sync_workspace_slack",
    "sync_workspace_gong",
    "sync_workspace_fathom",
    "sync_workspace_themes",
]

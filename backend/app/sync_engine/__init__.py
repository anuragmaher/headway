"""
Sync Engine - Centralized data synchronization from all connected data sources.

This module handles periodic and on-demand synchronization of data from:
- Slack integrations
- Gmail accounts
- Gong connectors
- Fathom connectors

All sync tasks check for active connections before attempting to sync.
Only workspaces with active data sources will be synced.

Module Structure:
- tasks/base.py: Shared utilities (async runner, sync record helpers)
- tasks/periodic/: Celery Beat scheduled tasks (run every 15 minutes)
- tasks/ondemand/: API-triggered tasks (Sync All Sources, Sync Themes)
"""

# Import tasks module for Celery discovery
from app.sync_engine import tasks

# Re-export all tasks for backward compatibility
from app.sync_engine.tasks import (
    # Periodic tasks
    health_check,
    sync_slack_periodic,
    sync_gmail_periodic,
    sync_gong_periodic,
    sync_fathom_periodic,
    # On-demand tasks
    sync_workspace_gmail,
    sync_workspace_slack,
    sync_workspace_gong,
    sync_workspace_fathom,
    sync_workspace_themes,
)

__all__ = [
    "tasks",
    # Periodic tasks
    "health_check",
    "sync_slack_periodic",
    "sync_gmail_periodic",
    "sync_gong_periodic",
    "sync_fathom_periodic",
    # On-demand tasks
    "sync_workspace_gmail",
    "sync_workspace_slack",
    "sync_workspace_gong",
    "sync_workspace_fathom",
    "sync_workspace_themes",
]

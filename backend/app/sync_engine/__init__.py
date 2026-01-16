"""
Sync Engine - Centralized data synchronization from all connected data sources

This module handles periodic synchronization of data from:
- Slack integrations
- Gmail accounts
- Gong connectors
- Fathom connectors

All sync tasks check for active connections before attempting to sync.
Only workspaces with active data sources will be synced.
"""

# Import tasks for Celery discovery
from app.sync_engine import sync_tasks

__all__ = ["sync_tasks"]

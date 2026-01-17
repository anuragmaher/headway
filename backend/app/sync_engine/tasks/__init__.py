"""
Sync Engine Tasks - All Celery tasks for data synchronization.

This module provides:
- Periodic tasks: Run on Celery Beat schedule (every 15 minutes)
- On-demand tasks: Triggered by API calls (Sync All Sources, Sync Themes)

Task naming convention:
- All tasks use the legacy name "app.sync_engine.sync_tasks.<task_name>"
- This maintains backward compatibility with existing Celery Beat schedule
"""

# Base utilities
from app.sync_engine.tasks.base import (
    engine,
    run_async_task,
    create_sync_record,
    finalize_sync_record,
    update_sync_record,
)

# Periodic tasks
from app.sync_engine.tasks.periodic import (
    health_check,
    sync_slack_periodic,
    sync_gmail_periodic,
    sync_gong_periodic,
    sync_fathom_periodic,
)

# On-demand tasks
from app.sync_engine.tasks.ondemand import (
    sync_workspace_gmail,
    sync_workspace_slack,
    sync_workspace_gong,
    sync_workspace_fathom,
    sync_workspace_themes,
)

__all__ = [
    # Base utilities
    "engine",
    "run_async_task",
    "create_sync_record",
    "finalize_sync_record",
    "update_sync_record",
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

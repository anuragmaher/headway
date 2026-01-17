"""
Periodic sync tasks that run on Celery Beat schedule.

These tasks automatically sync data sources at regular intervals.
"""

from app.sync_engine.tasks.periodic.health import health_check
from app.sync_engine.tasks.periodic.slack import sync_slack_periodic
from app.sync_engine.tasks.periodic.gmail import sync_gmail_periodic
from app.sync_engine.tasks.periodic.gong import sync_gong_periodic
from app.sync_engine.tasks.periodic.fathom import sync_fathom_periodic

__all__ = [
    "health_check",
    "sync_slack_periodic",
    "sync_gmail_periodic",
    "sync_gong_periodic",
    "sync_fathom_periodic",
]

# Sync Engine

The Sync Engine is responsible for periodically synchronizing data from all connected data sources.

## Overview

The sync engine runs Celery tasks that:
1. **Check for active connections** - Only syncs data sources that are actually connected and active
2. **Handle errors gracefully** - Continues with other workspaces if one fails
3. **Log comprehensive status** - Provides detailed logging for monitoring
4. **Run at regular intervals** - All syncs run every 15 minutes, staggered to avoid conflicts

## Data Sources

### Slack
- **Task**: `sync_slack_periodic`
- **Schedule**: Every 15 minutes (at :00)
- **Checks**: Only active Slack integrations (`Integration.is_active == True`)
- **Syncs**: Messages from selected channels in the last 24 hours

### Gong
- **Task**: `sync_gong_periodic`
- **Schedule**: Every 15 minutes (at :20, staggered)
- **Checks**: Only active Gong connectors (`WorkspaceConnector.is_active == True` and `connector_type == 'gong'`)
- **Syncs**: Last 50 calls from the last 24 hours

### Fathom
- **Task**: `sync_fathom_periodic`
- **Schedule**: Every 15 minutes (at :40, staggered)
- **Checks**: Only active Fathom connectors (`WorkspaceConnector.is_active == True` and `connector_type == 'fathom'`)
- **Syncs**: Last 50 sessions from the last 24 hours

### Gmail
- **Task**: `sync_gmail_periodic`
- **Schedule**: Every 15 minutes (at :60, staggered)
- **Checks**: Only Gmail accounts with workspace_id (active accounts)
- **Syncs**: Last 5 threads from selected labels

## Architecture

```
sync_engine/
├── __init__.py          # Module initialization
├── sync_tasks.py        # Celery task definitions
└── README.md           # This file
```

## Key Features

### Active Connection Checking
All sync tasks verify that data sources are active before attempting to sync:
- **Slack**: Checks `Integration.is_active == True` and `provider == 'slack'`
- **Gong/Fathom**: Checks `WorkspaceConnector.is_active == True` and correct `connector_type`
- **Gmail**: Checks that account has `workspace_id` (indicating it's connected)

### Error Handling
- Individual workspace/account failures don't stop the entire sync
- Errors are logged with detailed information
- Failed syncs are retried with exponential backoff
- Sync status is tracked in the database

### Staggered Execution
Tasks are staggered to avoid:
- Database connection pool exhaustion
- API rate limiting
- Resource contention

## Configuration

Sync schedules are configured in `app/tasks/celery_app.py`:

```python
celery_app.conf.beat_schedule = {
    "sync-slack-messages": {
        "task": "app.sync_engine.sync_tasks.sync_slack_periodic",
        "schedule": schedule(run_every=900),  # 15 minutes
    },
    # ... other tasks
}
```

## Monitoring

Each sync task returns a status object:
```python
{
    "status": "success" | "skipped",
    "total_messages": int,  # or total_ingested, etc.
    "successful_workspaces": int,
    "failed_workspaces": int
}
```

## Health Check

The `health_check` task verifies that the Celery sync engine is operational:
```python
{
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "service": "sync_engine"
}
```

## Migration from Old System

The old `app/tasks/ingestion_tasks.py` has been replaced by this sync engine. The new system:
- ✅ Only syncs active connections
- ✅ Includes Slack sync (was missing)
- ✅ Better error handling and logging
- ✅ More organized code structure

## Testing

To test sync tasks manually:
```python
from app.sync_engine.sync_tasks import sync_slack_periodic, sync_gong_periodic

# Run sync tasks
result = sync_slack_periodic()
print(result)
```

## Troubleshooting

### Syncs not running?
1. Check Celery Beat is running: `celery -A app.tasks.celery_app beat --loglevel=info`
2. Check Celery Worker is running: `celery -A app.tasks.celery_app worker --loglevel=info`
3. Verify Redis connection
4. Check logs for errors

### No data being synced?
1. Verify data sources are active (`is_active == True`)
2. Check workspace_id is set correctly
3. Verify credentials are valid
4. Check API rate limits

### High failure rate?
1. Check API credentials are valid
2. Verify network connectivity
3. Check database connection pool
4. Review error logs for patterns

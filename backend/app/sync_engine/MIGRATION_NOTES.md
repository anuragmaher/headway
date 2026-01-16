# Migration Notes: Old ingestion_tasks.py → New sync_engine

## What Changed

### Old System (`app/tasks/ingestion_tasks.py`)
- ❌ Synced ALL workspaces regardless of active connections
- ❌ Missing Slack sync task
- ❌ Less organized structure
- ❌ No filtering by `is_active` status

### New System (`app/sync_engine/sync_tasks.py`)
- ✅ Only syncs workspaces with **active** connections
- ✅ Includes Slack sync task
- ✅ Better organized in dedicated folder
- ✅ Comprehensive error handling
- ✅ Detailed logging and status reporting

## Task Name Changes

| Old Task Name | New Task Name |
|--------------|---------------|
| `app.tasks.ingestion_tasks.ingest_gong_periodic` | `app.sync_engine.sync_tasks.sync_gong_periodic` |
| `app.tasks.ingestion_tasks.ingest_fathom_periodic` | `app.sync_engine.sync_tasks.sync_fathom_periodic` |
| `app.tasks.ingestion_tasks.ingest_gmail_periodic` | `app.sync_engine.sync_tasks.sync_gmail_periodic` |
| N/A (missing) | `app.sync_engine.sync_tasks.sync_slack_periodic` |

## Schedule Changes

All tasks still run every 15 minutes, but with better staggering:
- Slack: :00 (0 seconds)
- Gong: :20 (20 seconds)
- Fathom: :40 (40 seconds)
- Gmail: :60 (60 seconds / 1 minute)

## Active Connection Filtering

### Before
```python
# Old: Synced ALL workspaces
workspaces = db.query(Workspace).all()
for workspace in workspaces:
    # Sync regardless of active connections
```

### After
```python
# New: Only syncs active connectors
gong_connectors = db.query(WorkspaceConnector).filter(
    and_(
        WorkspaceConnector.connector_type == "gong",
        WorkspaceConnector.is_active == True
    )
).all()
# Only syncs workspaces with active connectors
```

## Backward Compatibility

The old `app/tasks/ingestion_tasks.py` file is kept for reference but is **not used** by Celery Beat anymore. If you have any manual scripts that reference it, update them to use the new sync_engine.

## Testing

After migration, verify:
1. ✅ Celery Beat is using new task names
2. ✅ Only active connections are being synced
3. ✅ Slack sync is running
4. ✅ Error handling works correctly
5. ✅ Logs show proper filtering

## Rollback

If you need to rollback, update `app/tasks/celery_app.py`:
```python
include=[
    "app.tasks.ingestion_tasks"  # Old system
]
```

And update `beat_schedule` to use old task names.

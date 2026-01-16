# Celery Worker and Beat Fixes

## Issues Fixed

### 1. **Scheduler Configuration Mismatch**
   - **Problem**: Procfile was using `DatabaseScheduler` but `celery_app.py` was using `beat_schedule` (in-memory scheduler). These are incompatible.
   - **Fix**: Updated Procfile to use the default scheduler (removed `--scheduler` flag) to match the `beat_schedule` configuration in `celery_app.py`.

### 2. **asyncio.run() Compatibility Issues**
   - **Problem**: Using `asyncio.run()` in Celery tasks can cause issues on Windows with the solo pool, especially if an event loop already exists.
   - **Fix**: Replaced all `asyncio.run()` calls with `get_event_loop()` / `run_until_complete()` pattern that handles existing event loops gracefully:
     ```python
     try:
         loop = asyncio.get_event_loop()
         if loop.is_closed():
             loop = asyncio.new_event_loop()
             asyncio.set_event_loop(loop)
     except RuntimeError:
         loop = asyncio.new_event_loop()
         asyncio.set_event_loop(loop)
     
     result = loop.run_until_complete(async_function())
     ```

### 3. **Task Auto-Discovery**
   - **Problem**: Tasks might not be properly discovered by Celery.
   - **Fix**: Added `celery_app.autodiscover_tasks(['app.sync_engine'], force=True)` to ensure tasks are properly registered.

## How to Start Celery Services

### For Local Development (Windows):

**Terminal 1 - Celery Worker:**
```powershell
cd backend
celery -A app.tasks.celery_app worker --loglevel=info --queues=ingestion,default
```

**Terminal 2 - Celery Beat:**
```powershell
cd backend
celery -A app.tasks.celery_app beat --loglevel=info
```

### For Production (Railway):
The Procfile is configured correctly and will start both services automatically.

## Verification

To verify tasks are registered correctly:
```python
from app.tasks.celery_app import celery_app
print([task for task in celery_app.tasks.keys() if 'sync' in task])
```

Expected output should include:
- `app.sync_engine.sync_tasks.sync_slack_periodic`
- `app.sync_engine.sync_tasks.sync_gong_periodic`
- `app.sync_engine.sync_tasks.sync_fathom_periodic`
- `app.sync_engine.sync_tasks.sync_gmail_periodic`
- `app.sync_engine.sync_tasks.health_check`

## Troubleshooting

### Tasks not running?
1. Check Redis is running: `redis-cli ping` (should return `PONG`)
2. Check worker logs for errors
3. Check beat logs to see if tasks are being scheduled
4. Verify `REDIS_URL` environment variable is set correctly

### Event loop errors?
- The new asyncio handling should prevent these, but if you still see errors, check that you're using the updated `sync_tasks.py`

### Beat not scheduling tasks?
- Ensure you're using the default scheduler (no `--scheduler` flag)
- Check that `beat_schedule` in `celery_app.py` matches the task names exactly

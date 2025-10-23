# Scheduled Ingestion - Quick Start Guide

## TL;DR - 3 Steps to Deploy on Railway

### Step 1: Add Services to Railway Dashboard

Go to your Railway project dashboard:

```
Project → Create Service → Deploy from GitHub
```

Create **3 services** from the same repo:

1. **web** - API server (Procfile: `web`)
2. **worker** - Task processor (Procfile: `worker`)
3. **beat** - Scheduler (Procfile: `beat` - EXACTLY 1 REPLICA!)

### Step 2: Configure Environment Variables

In Railway Dashboard → Environment:

```
REDIS_URL=redis://your-redis-host:port
DATABASE_URL=postgresql://...
GONG_ACCESS_KEY=...
GONG_SECRET_KEY=...
FATHOM_API_TOKEN=...
FATHOM_PROJECT_ID=...
```

### Step 3: Deploy

```bash
git add .
git commit -m "Add scheduled ingestion"
git push origin main
```

Railway will auto-deploy all services.

## What It Does

**Every 15 minutes:**

```
:00 → Gong ingestion starts
      • Fetches last 50 Gong calls
      • Extracts AI features
      • Saves to database

:00:20 → Fathom ingestion starts (20s later to avoid conflicts)
         • Fetches last 50 Fathom sessions
         • Extracts transcripts
         • Extracts AI features
         • Saves to database
```

## Files Created

✅ `app/tasks/celery_app.py` - Celery configuration + scheduler
✅ `app/tasks/ingestion_tasks.py` - Periodic ingestion functions
✅ `Procfile` - Railway process definitions
✅ `RAILWAY_SETUP.md` - Detailed setup guide

## Monitor Ingestion

In Railway Dashboard:

1. **View logs**: Services → Logs
   - `worker` logs show ingestion progress
   - `beat` logs show schedule triggers

2. **Check status**:
   ```bash
   railway logs -s worker --tail 50
   ```

3. **Example successful logs**:
   ```
   ✅ Gong periodic ingestion complete. Total ingested: 15
   ✅ Fathom periodic ingestion complete. Total ingested: 8
   ```

## Customize Schedule

Edit `app/tasks/celery_app.py` line 36-51:

```python
# Change from 900 seconds to:
schedule(run_every=300),  # 5 minutes
schedule(run_every=1800), # 30 minutes
schedule(run_every=3600), # 1 hour
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tasks not running | Check beat service: `railway logs -s beat` |
| Redis error | Verify REDIS_URL in Railway environment |
| Worker stuck | Restart: Railway Dashboard → worker → Restart |
| Beat running multiple times ⚠️ | Ensure beat has EXACTLY 1 replica! |

## Cost

- Beat service (always on, low CPU): ~$7/month
- Worker service (2-3 replicas): ~$15-30/month
- Redis (included): ~$5-10/month
- **Total**: ~$25-50/month

## Next: Add Monitoring

Optional - add health endpoint to FastAPI:

```python
@app.get("/health/celery")
async def celery_health():
    from app.tasks.celery_app import celery_app
    active = celery_app.control.inspect().active()
    return {"status": "healthy" if active else "degraded"}
```

## Questions?

See `RAILWAY_SETUP.md` for detailed setup and troubleshooting.

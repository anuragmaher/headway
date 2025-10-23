# Railway Deployment Guide - Scheduled Ingestion

This guide explains how to set up Gong and Fathom ingestion on Railway with Celery Beat scheduler running every 15 minutes.

## Architecture

```
Railway Project
├── Web Service (FastAPI)
│   └── Handles API requests
├── Worker Service (Celery Worker)
│   └── Processes ingestion tasks
├── Beat Service (Celery Beat)
│   └── Triggers scheduled jobs every 15 minutes
└── Redis (Shared)
    └── Task queue and result backend
```

## Setup Steps

### 1. Create Services in Railway

You need to create 3 services in your Railway project:

#### Service 1: Web API
- **Name**: `api` (or `web`)
- **Build**: Railway will auto-detect from Dockerfile or Procfile
- **Start Command**: `web` (from Procfile)
- **Port**: `3000` (or Railway will auto-assign)

#### Service 2: Celery Worker
- **Name**: `worker`
- **Build**: Same repo
- **Start Command**: `worker` (from Procfile)
- **No Public URL needed**

#### Service 3: Celery Beat
- **Name**: `beat`
- **Build**: Same repo
- **Start Command**: `beat` (from Procfile)
- **No Public URL needed** (only 1 instance!)

#### Service 4: Redis (Optional if not using Railway Redis)
- Railway Redis already included in plan

### 2. Environment Variables

Make sure these are set in Railway environment:

```
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis (for Celery)
REDIS_URL=redis://localhost:6379/0
# OR if using Railway Redis Plugin:
REDIS_URL=redis://default:PASSWORD@HOSTNAME:PORT

# Gong API
GONG_ACCESS_KEY=your-key
GONG_SECRET_KEY=your-secret

# Fathom API
FATHOM_API_TOKEN=your-token
FATHOM_PROJECT_ID=your-project-id

# Other configs
ENVIRONMENT=production
JWT_SECRET_KEY=your-secret
...
```

### 3. Create the Services via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link <PROJECT_ID>

# Create services from Procfile
railway service create web
railway service create worker
railway service create beat
```

Or **use Railway Dashboard**:
1. Go to your project
2. Click "Create Service"
3. Select "Deploy from GitHub"
4. Configure each service with the appropriate Procfile process type

### 4. Configure Service Replicas

In Railway Dashboard:

**Web Service:**
- Replicas: 1+ (auto-scale as needed)
- Resources: Standard tier

**Worker Service:**
- Replicas: 2-3 (processes ingestion tasks)
- Resources: Standard tier

**Beat Service:**
- Replicas: **EXACTLY 1** ⚠️ (CRITICAL - only one scheduler!)
- Resources: Standard tier

### 5. Link Redis Plugin

1. Go to your Railway project
2. Click "Plugins"
3. Add "Redis" plugin
4. Railway will automatically inject `REDIS_URL` to all services

### 6. Deploy

Push to your connected GitHub branch:

```bash
git add .
git commit -m "Add Celery scheduler for ingestion"
git push origin main
```

Railway will automatically:
1. Build the Docker image
2. Deploy all services with the new Procfile
3. Start the web, worker, and beat services

## Monitoring

### View Logs

```bash
# Worker logs
railway logs -s worker

# Beat scheduler logs
railway logs -s beat

# API logs
railway logs -s web
```

Or use **Railway Dashboard → Services → Logs**

### Monitor Tasks

Check Celery task status:

```bash
# SSH into worker
railway shell -s worker

# Inside the container:
python -c "from app.tasks.celery_app import celery_app; print(celery_app.control.inspect().active())"
```

### Health Check Endpoint

Add to your FastAPI app (`app/main.py`):

```python
@app.get("/health/celery")
async def celery_health():
    """Check Celery worker health"""
    from app.tasks.celery_app import celery_app

    active = celery_app.control.inspect().active()
    stats = celery_app.control.inspect().stats()

    return {
        "status": "healthy" if active and stats else "degraded",
        "workers": len(active) if active else 0,
        "active_tasks": sum(len(v) for v in active.values()) if active else 0
    }
```

## Schedule Details

### Current Schedule

```
Gong:   Every 15 minutes (starts at :00)
        - Fetches last 50 calls from 24h window
        - Extracts AI features
        - Matches to themes

Fathom: Every 15 minutes (starts at :00 + 20s)
        - Fetches last 50 sessions from 24h window
        - Extracts transcripts with AI
        - Extracts AI features
```

### Customizing Schedule

Edit `app/tasks/celery_app.py`:

```python
celery_app.conf.beat_schedule = {
    "ingest-gong-calls": {
        "schedule": schedule(run_every=900),  # 900 = 15 min
        # Change to:
        # schedule(run_every=300),  # 5 minutes
        # schedule(run_every=1800), # 30 minutes
        # schedule(run_every=3600), # 1 hour
    },
    ...
}
```

## Troubleshooting

### Tasks not running?

1. **Beat service down**:
   - Check `railway logs -s beat`
   - Verify only 1 replica of beat is running

2. **Worker not processing tasks**:
   - Check `railway logs -s worker`
   - Verify Redis connection: `railway ssh -s worker` then `redis-cli ping`

3. **Redis connection error**:
   - Verify `REDIS_URL` is set correctly
   - Test: `curl -v redis://host:port`

4. **Tasks stuck**:
   ```bash
   # Clear all tasks
   railway ssh -s worker
   python -c "from app.tasks.celery_app import celery_app; celery_app.control.purge()"
   ```

### Viewing Task Logs

In worker service logs, you'll see:

```
✅ Gong periodic ingestion complete. Total ingested: 15
✅ Fathom periodic ingestion complete. Total ingested: 8
```

## Scaling

As you grow:

1. **Increase worker replicas** for faster processing
   - 2-3 for small volume
   - 5+ for high volume

2. **Increase beat scheduler** to none (always 1!)

3. **Monitor** ingestion delays with:
   ```python
   @app.get("/api/ingestion/stats")
   async def ingestion_stats():
       """Show last ingestion stats"""
       from app.models.message import Message
       from sqlalchemy import func

       last_gong = db.query(func.max(Message.created_at)).filter(
           Message.source == "gong"
       ).scalar()

       last_fathom = db.query(func.max(Message.created_at)).filter(
           Message.source == "fathom"
       ).scalar()

       return {
           "last_gong_ingestion": last_gong,
           "last_fathom_ingestion": last_fathom
       }
   ```

## Cost Considerations

- **Beat Service**: Very low CPU (1 replica, always on) - ~$7/month
- **Worker Service**: Medium CPU (2-3 replicas) - ~$15-30/month
- **Redis**: Included in Railway standard tier - ~$5-10/month

Total additional cost: ~$25-50/month for scheduled ingestion

## Next Steps

1. Add database migration for Celery beat schedule (optional)
2. Implement monitoring/alerting for failed tasks
3. Add retry logic for failed ingestions
4. Set up logs aggregation (e.g., Sentry, Datadog)

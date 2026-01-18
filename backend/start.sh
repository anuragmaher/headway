#!/bin/bash
set -e

# Use Railway's PORT env var, default to 8000 if not set
PORT=${PORT:-8000}

# Determine which service to run based on RAILWAY_SERVICE environment variable
# Set RAILWAY_SERVICE=worker for Celery worker
# Set RAILWAY_SERVICE=beat for Celery beat
# Default: run web server

SERVICE=${RAILWAY_SERVICE:-web}

case $SERVICE in
    worker)
        echo "🔧 Starting Celery worker..."
        exec celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
        ;;
    beat)
        echo "⏰ Starting Celery beat scheduler..."
        exec celery -A app.tasks.celery_app beat --loglevel=info
        ;;
    all)
        echo "🚀 Starting all services (web + worker + beat)..."
        # Start Celery worker in background
        celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2 &
        # Start Celery beat in background
        celery -A app.tasks.celery_app beat --loglevel=info &
        # Start uvicorn in foreground
        exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
        ;;
    *)
        echo "🚀 Starting uvicorn on port $PORT"
        exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
        ;;
esac

#!/bin/bash
set -e

# Default values
SERVICE_TYPE=${SERVICE_TYPE:-web}
PORT=${PORT:-8000}

case "$SERVICE_TYPE" in
  web)
    echo "🚀 Starting FastAPI web server on port $PORT"
    exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
    ;;
  worker)
    echo "👷 Starting Celery worker"
    exec celery -A app.tasks.celery_app worker --loglevel=info --queues=ingestion,default
    ;;
  beat)
    echo "⏰ Starting Celery beat scheduler"
    exec celery -A app.tasks.celery_app beat --loglevel=info
    ;;
  *)
    echo "❌ Unknown SERVICE_TYPE: $SERVICE_TYPE"
    echo "Valid options: web, worker, beat"
    exit 1
    ;;
esac

#!/bin/bash
set -e

# Use Railway's PORT env var, default to 8000 if not set
PORT=${PORT:-8000}

echo "🚀 Starting uvicorn on port $PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"

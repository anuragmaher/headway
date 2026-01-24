# HeadwayHQ Backend

FastAPI backend for the HeadwayHQ product intelligence platform.

## Tech Stack

- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Primary database
- **SQLAlchemy** - ORM and database toolkit
- **Alembic** - Database migrations
- **Celery** - Background task processing
- **Redis** - Task queue and caching
- **Anthropic Claude** - AI feature extraction
- **JWT** - Authentication tokens

## Project Structure

```
app/
├── api/v1/           # API route definitions
├── core/             # Core configuration
│   ├── config.py     # Settings and configuration
│   └── database.py   # Database connection
├── models/           # SQLAlchemy models
├── schemas/          # Pydantic schemas
├── services/         # Business logic layer
├── repositories/     # Database access layer
├── tasks/            # Celery background tasks
└── utils/            # Utility functions
```

## Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Run development server
uvicorn app.main:app --reload

# Run Celery worker (separate terminal)
celery -A app.tasks.celery_app worker --loglevel=info

# Run Celery Beat scheduler (separate terminal)
celery -A app.tasks.celery_app beat --loglevel=info
```

## Database Setup

```bash
# Create database
createdb headway_db

# Initialize Alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial migration"

# Apply migration
alembic upgrade head
```

## Environment Variables

Required variables in `.env`:

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/headway_db
JWT_SECRET_KEY=your-super-secret-jwt-key
ANTHROPIC_API_KEY=your-anthropic-api-key
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
REDIS_URL=redis://localhost:6379/0
```

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## Architecture

### Clean Architecture Layers

1. **API Layer** (`api/`) - HTTP endpoints
2. **Service Layer** (`services/`) - Business logic
3. **Repository Layer** (`repositories/`) - Data access
4. **Model Layer** (`models/`) - Database entities

### Key Features

- 🔐 **JWT Authentication** - Secure token-based auth
- 🤖 **AI Integration** - Claude API for feature extraction
- 📨 **Slack Integration** - OAuth and message fetching
- ⚡ **Background Tasks** - Celery for async processing
- 🗄️ **PostgreSQL** - Robust relational database
- 📊 **Auto-generated API Docs** - Swagger/ReDoc

## Coding Standards

Follow Python conventions:
- **Classes**: PascalCase (`UserService`)
- **Functions**: snake_case (`get_user_by_id`)
- **Constants**: UPPER_SNAKE_CASE (`DATABASE_URL`)
- **Type hints**: Use everywhere
- **Docstrings**: Document all public functions

---

## AI Pipeline & Observability

### Langfuse OpenTelemetry Tracing

All AI/LLM calls are traced to Langfuse for observability. Tracing is initialized automatically for both:
- **FastAPI** (via `app/core/langfuse_tracing.py` at startup)
- **Celery workers** (via worker signals in `app/tasks/celery_app.py`)

**Required Environment Variables:**
```bash
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

**What's Traced:**
- All OpenAI API calls (tier1 classification, tier2 extraction, AI insights)
- Token usage and latency
- Full prompt/completion content (for debugging)

### Tier-1 Classification Improvements

Located in `app/sync_engine/tasks/ai_pipeline/tier1_classification.py`:

| Feature | Description |
|---------|-------------|
| **Tier-2 Trigger Inside Loop** | `extract_features.delay()` triggers after each batch with relevant items, ensuring progress even if task times out |
| **Soft Timeout Handling** | Catches `SoftTimeLimitExceeded`, gracefully exits, and re-queues remaining work |
| **Per-Run Item Limit** | `MAX_ITEMS_PER_RUN = 50` - task self-requeues after 50 items to prevent long-running tasks |
| **Skip Oversized Messages** | `MAX_MESSAGE_LENGTH = 50000` (50KB) - skips and marks as completed with error |

### Parallel Chunk Processing

Located in `app/services/tiered_ai_service.py`:

For long messages (>1500 chars) that get chunked:
- **Before**: Chunks processed sequentially (5 chunks × 500ms = 2.5s)
- **After**: Chunks processed in parallel via `asyncio.run()` (5 chunks = 500ms)
- **Speedup**: ~5x for multi-chunk messages

Falls back to sequential processing if already in an async context.

### Message Fetching Limits

All sources have a unified limit of **60 messages** per sync:

| Source | Periodic | On-Demand |
|--------|----------|-----------|
| Slack | 60 | 60 |
| Gmail | 60 | 60 |
| Gong | 60 | 60 |
| Fathom | 60 | 60 |

### Deployment

```bash
# Install dependencies (includes OpenTelemetry packages)
pip install -r requirements.txt

# Restart Celery workers to pick up tracing initialization
celery -A app.tasks.celery_app worker --loglevel=info
```

### Expected Behavior

1. **Faster Processing** - Parallel chunk classification (5x speedup for long messages)
2. **Graceful Timeouts** - Soft timeouts handled without SIGKILL
3. **Progress Preserved** - Messages progress to Tier-2 even if task times out
4. **No Blocking** - Oversized messages skipped instead of blocking pipeline
5. **Full Observability** - All AI calls visible in Langfuse traces
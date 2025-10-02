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
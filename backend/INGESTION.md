# HeadwayHQ - Data Ingestion Guide

This document describes the process for ingesting messages, transcripts, and call data from external sources (Gong, Fathom, etc.) into HeadwayHQ.

## Architecture Overview

The ingestion system is built on a **generic connector pattern** that allows ingesting data from multiple sources without code changes. Each source (Gong, Fathom, etc.) has:

1. **Workspace Connector** - Stores credentials and connection details
2. **Ingestion Service** - Fetches and processes data from the source
3. **Transcript Ingestion Service** - Handles AI extraction and feature matching
4. **Generic Orchestrator** - Coordinates ingestion across multiple connectors

## Setup Steps

### 1. **Create/Configure Connector for Workspace**

Before ingesting, ensure the workspace has a configured connector with credentials.

**Via API:**
```bash
POST /api/v1/workspaces/{workspace_id}/connectors
{
  "connector_type": "gong",
  "gong_access_key": "your_access_key",
  "gong_secret_key": "your_secret_key"
}
```

Or for Fathom:
```bash
POST /api/v1/workspaces/{workspace_id}/connectors
{
  "connector_type": "fathom",
  "fathom_api_token": "your_api_token"
}
```

**What happens:**
- Connector is saved to `workspace_connectors` table
- Credentials stored in JSONB `credentials` column
- Encrypted at rest (if using encryption)

### 2. **Create Themes for Feature Categorization**

Themes are required for AI feature extraction. Features are matched against workspace themes, so create at least one theme:

**Via API:**
```bash
POST /api/v1/workspaces/{workspace_id}/themes
{
  "name": "AI Features",
  "description": "AI-powered features and capabilities",
  "color": "#6366F1",
  "icon": "sparkles"
}
```

**Or via SQL:**
```sql
INSERT INTO themes (id, workspace_id, name, description, color, icon, sort_order, is_default, created_at)
VALUES (uuid_generate_v4(), 'workspace_id', 'AI Features', 'AI-powered features', '#6366F1', 'sparkles', 1, false, NOW());
```

### 3. **Run Ingestion**

Use the generic ingestion orchestrator to ingest from all or specific connectors:

#### **Ingest from all configured connectors:**
```bash
python -m app.scripts.ingest_from_connectors --workspace-id <workspace_uuid>
```

#### **Ingest from specific connector type:**
```bash
python -m app.scripts.ingest_from_connectors --workspace-id <workspace_uuid> --connector-type gong
python -m app.scripts.ingest_from_connectors --workspace-id <workspace_uuid> --connector-type fathom
```

#### **With custom limits and date range:**
```bash
python -m app.scripts.ingest_from_connectors \
  --workspace-id <workspace_uuid> \
  --limit 50 \
  --days-back 30 \
  --verbose
```

#### **Direct source ingestion (standalone):**
```bash
# Gong ingestion
python -m app.scripts.ingest_gong_calls --workspace-id <workspace_uuid> --limit 10

# Fathom ingestion
python -m app.scripts.ingest_fathom_sessions --workspace-id <workspace_uuid> --limit 10
```

## What Happens During Ingestion

### Step 1: Data Fetch
- Orchestrator reads configured connectors from database
- For each connector, extracts credentials from JSONB column
- Calls appropriate ingestion handler (Gong, Fathom, etc.)

### Step 2: Source API Calls
- **Gong**: Fetches calls from `v2/calls/extensive` API with date range filter
- **Fathom**: Fetches sessions from `/external/v1/meetings` API
- Only most recent calls/sessions are fetched (sorted by date)

### Step 3: Transcript Extraction
- For each call/session, fetch full transcript from source
- Gong transcripts: Fetched via `v2/calls/transcript` API
- Fathom transcripts: Included with session data

### Step 4: Theme Relevance Check
- AI checks if transcript is relevant to workspace themes
- Calculates relevance confidence score
- Skips if not relevant

### Step 5: Feature Extraction
- AI (Claude/GPT) analyzes transcript
- Extracts:
  - **Feature Requests**: New features customer wants
  - **Bug Reports**: Technical issues reported
  - **Pain Points**: Workflow frustrations
  - **Sentiment**: Overall tone (positive/neutral/negative)
- Stores extracted features in `features` table

### Step 6: Theme Matching
- Each extracted feature is matched against workspace themes
- Only features matching a theme are saved
- Features without matching theme are skipped (logged)

### Step 7: Database Storage
- **Messages Table**:
  - `id` - Unique message ID
  - `workspace_id` - Which workspace this belongs to
  - `source` - Source system (gong, fathom, slack, etc.)
  - `external_id` - ID from source system
  - `title` - Transcript title or message subject
  - `metadata` - Source-specific data (JSONB)
  - `created_at` - When message was created

- **Features Table**:
  - `id` - Unique feature ID
  - `message_id` - Which message this was extracted from
  - `theme_id` - Which theme this belongs to
  - `title` - Feature title
  - `description` - Feature details
  - `type` - Type (feature_request, bug_report, pain_point)
  - `urgency` - Priority level
  - `sentiment_score` - AI confidence

## Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host/db

# AI/LLM
ANTHROPIC_API_KEY=sk-...          # Claude API
OPENAI_API_KEY=sk-...              # GPT-4o for extraction

# Gong (if using Gong)
GONG_ACCESS_KEY=...
GONG_SECRET_KEY=...

# Fathom (if using Fathom)
FATHOM_API_TOKEN=...
FATHOM_PROJECT_ID=...              # Optional, can be passed via CLI
```

### Database Requirements
- `workspace_connectors` table with JSONB `credentials` column
- `themes` table with icon and sort_order columns
- `messages` table for storing ingested messages
- `features` table for storing extracted features

## Troubleshooting

### No Messages Ingested
1. Check connector is configured and active: `SELECT * FROM workspace_connectors WHERE workspace_id = '...' AND is_active = true`
2. Verify credentials are correct and have API access
3. Check date range - data might be older than `--days-back` parameter

### Features Not Being Saved
1. Verify workspace has themes: `SELECT * FROM themes WHERE workspace_id = '...'`
2. If no themes, create one before re-running ingestion
3. Check logs for "no matching theme found" messages
4. AI may not be extracting features if content isn't relevant

### API Errors
- **Gong 401**: Access key/secret expired or invalid
- **Gong 429**: Rate limited - try again later
- **Fathom 401**: API token expired or invalid
- **Fathom 404**: Session/project not found

## File Structure

```
backend/app/
├── scripts/
│   ├── ingest_gong_calls.py              # Gong ingestion handler
│   ├── ingest_fathom_sessions.py         # Fathom ingestion handler
│   └── ingest_from_connectors.py         # Generic orchestrator
├── services/
│   ├── gong_ingestion_service.py         # Gong API client
│   ├── fathom_ingestion_service.py       # Fathom API client
│   ├── transcript_ingestion_service.py   # AI extraction & storage
│   └── workspace_service.py              # Connector management
└── models/
    ├── workspace_connector.py            # Connector model (JSONB credentials)
    ├── message.py                        # Ingested message model
    └── feature.py                        # Extracted feature model
```

## Performance Notes

- **Transcript Processing**: ~2-5 seconds per transcript (API calls + AI)
- **Batch Size**: Default limit of 10 records, adjust with `--limit` parameter
- **AI Extraction**: Uses GPT-4o by default, can timeout on very long transcripts
- **Memory**: Scales linearly with batch size

## Advanced Usage

### Running Scheduled Ingestion

```python
# Add to Celery beat schedule
from celery.schedules import crontab

app.conf.beat_schedule = {
    'ingest-gong-hourly': {
        'task': 'app.tasks.ingest_gong_task',
        'schedule': crontab(minute=0),  # Every hour
        'args': (WORKSPACE_ID,)
    }
}
```

### Custom Ingestion Logic

To add a new source (e.g., Slack, HubSpot):

1. Create `app/scripts/ingest_source_name.py`
2. Implement `async def ingest_source_name(workspace_id, credentials, ...)`
3. Register in `ingest_from_connectors.py`:
   ```python
   def _get_source_handler(self):
       from app.scripts.ingest_source_name import ingest_source_name
       return ingest_source_name
   ```
4. Add to `_ingest_from_connector()` conditional logic

## Testing

```bash
# Test Gong connector
python -m app.scripts.ingest_gong_calls \
  --workspace-id <uuid> \
  --limit 5 \
  --verbose

# Test Fathom connector
python -m app.scripts.ingest_fathom_sessions \
  --workspace-id <uuid> \
  --limit 5 \
  --verbose

# Test generic orchestrator
python -m app.scripts.ingest_from_connectors \
  --workspace-id <uuid> \
  --limit 5 \
  --verbose
```

## Summary

The ingestion pipeline:
1. Read workspace connectors from database
2. Extract credentials from JSONB column
3. Fetch data from source APIs
4. Extract transcripts/messages
5. Check relevance to workspace themes
6. Run AI feature extraction
7. Match features to themes
8. Store in database

This architecture allows adding new sources without modifying core ingestion logic, just by adding a new handler and registering it in the orchestrator.

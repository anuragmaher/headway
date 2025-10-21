# Fathom Session Ingestion

This document describes how Fathom session ingestion works in HeadwayHQ. Session recordings from Fathom are automatically processed through AI extraction to identify features, pain points, and user frustration signals.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [How It Works](#how-it-works)
4. [Running Ingestion](#running-ingestion)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Fathom session ingestion enables HeadwayHQ to:

- **Capture user behavior** from Fathom session recordings
- **Extract transcripts** from sessions (if available)
- **Identify frustration signals** (rage clicks, error clicks, dead clicks)
- **Extract features and insights** using AI analysis
- **Intelligently match** duplicate feature requests
- **Organize by theme** (AI Features, Integrations, etc.)

### Key Characteristics

- **Source-agnostic processing**: Uses the same `TranscriptIngestionService` as Gong
- **Intelligent duplicate detection**: Semantic matching prevents duplicate features
- **Theme-based organization**: Features are automatically categorized
- **User frustration tracking**: Captures frustration signals from session behavior
- **Batch processing**: Can ingest many sessions efficiently

### Architecture

The ingestion pipeline follows this flow:

```
STAGE 1: FETCH FATHOM SESSIONS
  ↓ (Fathom API /rest/v1/projects/{projectId}/videos)
STAGE 2: EXTRACT SESSION METADATA
  ↓ (Parse URL, user info, frustration signals)
STAGE 3: FETCH TRANSCRIPT (if available)
  ↓ (Get session recording transcript or events)
STAGE 4: SAVE MESSAGE TO DATABASE
  ↓ (Create Message record with metadata)
STAGE 5: AI FEATURE EXTRACTION (GPT-4o-mini)
  ↓ (Extract features, pain points from transcript + metadata)
STAGE 6: INTELLIGENT FEATURE MATCHING
  ↓ (Semantic duplicate detection using LLM)
STAGE 7: FINALIZE MESSAGE
  ↓ (Mark as processed, commit changes)
```

---

## Setup

### 1. Get Fathom API Credentials

1. Log in to your [Fathom Dashboard](https://app.fathom.com)
2. Go to **Settings** → **API**
3. Create a new API token or copy your existing token
4. Note your **Project ID** (visible in the URL when viewing a project)

### 2. Add to Environment Variables

Create a `.env` file in the backend directory with:

```bash
# Fathom Integration
FATHOM_API_TOKEN=your_api_token_here
FATHOM_PROJECT_ID=your_project_id_here
FATHOM_API_BASE_URL=https://api.fathom.com  # Optional, default shown
```

### 3. Verify OpenAI API Key

Ensure you also have the OpenAI API key for AI extraction:

```bash
OPENAI_API_KEY=sk-proj-...
```

---

## How It Works

### Fathom Session Ingestion Service

**File**: `app/services/fathom_ingestion_service.py`

The `FathomIngestionService` handles all Fathom API interactions:

```python
fathom_service = get_fathom_ingestion_service(api_token)

# Fetch sessions from Fathom
sessions = fathom_service.fetch_sessions(
    project_id="your_project_id",
    from_date=datetime(2025, 10, 14),
    to_date=datetime(2025, 10, 21),
    limit=50,
    min_duration_seconds=10
)

# Get session transcript
transcript = fathom_service.fetch_session_transcript(session_id)

# Get interaction events
events = fathom_service.fetch_session_events(session_id)

# Extract key features
features = fathom_service.extract_session_features(session_data)
```

### Key Methods

#### `fetch_sessions(project_id, from_date, to_date, limit, min_duration_seconds)`

Fetches session recordings from Fathom API.

**Returns:**
```python
[
    {
        "id": "sess_123abc",
        "title": "User testing signup flow",
        "visitor_email": "user@example.com",
        "visitor_name": "John Doe",
        "page_url": "https://app.example.com/signup",
        "duration": 245,  # seconds
        "created_at": "2025-10-20T14:30:00Z",
        "device_type": "desktop",
        "browser": "Chrome",
        "os": "macOS",
        "rage_clicks": 3,
        "error_clicks": 1,
        "dead_clicks": 0,
        "frustrated_gestures": 2,
        "share_url": "https://www.fathom.com/share/...",
        "tags": ["signup", "user-testing"],
        "metadata": {...}
    }
]
```

#### `fetch_session_transcript(session_id)`

Fetches AI-generated or human-created transcript for a session.

**Returns:**
```python
"John: Hi, I'm trying to sign up for the product...
Support: Great! Let me walk you through the process...
John: OK, but I don't see where to enter my company name..."
```

**Note**: If Fathom doesn't provide transcripts via API, this would need to use speech-to-text on the recording.

#### `fetch_session_events(session_id)`

Fetches user interaction events (clicks, scrolls, form inputs, etc.).

**Returns:**
```python
[
    {
        "id": "evt_1",
        "type": "click",
        "target": "button.signup",
        "timestamp": 1.23,
        "text": "Sign Up"
    },
    {
        "id": "evt_2",
        "type": "rage_click",
        "target": "input.email",
        "timestamp": 5.67
    }
]
```

#### `extract_session_features(session_data)`

Extracts key features and metadata from session object.

**Returns:**
```python
{
    "session_id": "sess_123abc",
    "recording_url": "https://www.fathom.com/share/...",
    "user_email": "user@example.com",
    "user_name": "John Doe",
    "page_url": "https://app.example.com/signup",
    "duration_seconds": 245,
    "recording_date": "2025-10-20T14:30:00Z",
    "device_type": "desktop",
    "browser": "Chrome",
    "os": "macOS",
    "rage_clicks": 3,
    "error_clicks": 1,
    "dead_clicks": 0,
    "frustrated_gestures": 2,
    "metadata": {...},
    "tags": ["signup", "user-testing"],
    "session_attributes": {...}
}
```

### Transcript Ingestion Service

**File**: `app/services/transcript_ingestion_service.py`

Once session data is fetched, `TranscriptIngestionService` handles the rest:

```python
from app.services.transcript_ingestion_service import get_transcript_ingestion_service

transcript_service = get_transcript_ingestion_service(db)

message_id = transcript_service.ingest_transcript(
    workspace_id="workspace-uuid",
    external_id="session_id",
    transcript_text="...",
    source="fathom",
    metadata={...},
    channel_name="Fathom Sessions",
    author_name="John Doe",
    author_email="user@example.com",
    extract_features=True
)
```

This service is **completely source-agnostic** and handles:
1. AI feature extraction (GPT-4o-mini)
2. Intelligent duplicate detection
3. Theme validation
4. Feature-message relationships
5. Database updates

---

## Running Ingestion

### Command Line

```bash
# Basic usage
python -m app.scripts.ingest_fathom_sessions \
  --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874

# With all options
python -m app.scripts.ingest_fathom_sessions \
  --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 \
  --project-id proj_abc123 \
  --limit 50 \
  --days-back 30 \
  --min-duration 10 \
  --verbose

# Skip AI extraction (faster, just fetch sessions)
python -m app.scripts.ingest_fathom_sessions \
  --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 \
  --no-extract-features
```

### Command Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--workspace-id` | string (UUID) | **required** | Target workspace |
| `--project-id` | string | from env var | Fathom project ID |
| `--limit` | integer | 10 | Max sessions to fetch |
| `--days-back` | integer | 7 | Historical date range |
| `--min-duration` | integer | 0 | Minimum session length (seconds) |
| `--no-extract-features` | flag | false | Skip AI extraction |
| `--verbose` / `-v` | flag | false | Enable debug logging |

### Environment Variables

```bash
# Required
FATHOM_API_TOKEN=your_token

# Optional (can pass via --project-id)
FATHOM_PROJECT_ID=your_project_id

# Optional
FATHOM_API_BASE_URL=https://api.fathom.com
OPENAI_API_KEY=sk-proj-...
```

---

## Data Flow

### 1. Session Fetching

```
FathomIngestionService.fetch_sessions()
  ↓
Fathom API: GET /rest/v1/projects/{projectId}/videos
  ↓
Returns: List of session objects
```

### 2. Transcript Extraction

```
FathomIngestionService.fetch_session_transcript(session_id)
  ↓
Fathom API: GET /rest/v1/videos/{sessionId}/transcript
  ↓
Returns: Transcript text or None
```

### 3. Message Storage

```
TranscriptIngestionService.ingest_transcript()
  ↓
Create Message record:
  - source="fathom"
  - external_id=session_id
  - content=transcript_text
  - message_metadata={session info, frustration signals}
  ↓
Database: INSERT into messages
```

### 4. AI Extraction

```
AIExtractionService.extract_insights()
  ↓
OpenAI API: GPT-4o-mini analyzes transcript
  ↓
Returns:
  {
    "feature_requests": [
      {
        "title": "...",
        "description": "...",
        "urgency": "high",
        "theme": "..."
      }
    ],
    "pain_points": [...],
    "sentiment": {...}
  }
```

### 5. Duplicate Matching

For each extracted feature:

```
AIFeatureMatchingService.find_matching_feature()
  ↓
1. Validate theme assignment (threshold: 0.8)
2. Get existing features in theme
3. LLM semantic matching (threshold: 0.7)
  ↓
Decision:
  - If match found: Link message to existing feature
  - If new: Create new feature record
```

---

## Database Schema

### Message Model

```python
class Message(Base):
    id: UUID
    external_id: String = "sess_abc123"  # Fathom session ID
    content: Text = "transcript text"
    source: String = "fathom"
    channel_name: String = "Fathom Sessions"

    # Author info (from Fathom)
    author_name: String  # visitor_name
    author_email: String  # visitor_email

    # Processing
    is_processed: Boolean
    processed_at: DateTime
    ai_insights: JSONB  # AI extraction results

    message_metadata: JSONB
    {
        "session_id": "sess_abc123",
        "title": "User testing signup",
        "recording_url": "https://...",
        "duration_seconds": 245,
        "page_url": "https://app.example.com/signup",
        "device_type": "desktop",
        "browser": "Chrome",
        "os": "macOS",
        "rage_clicks": 3,
        "error_clicks": 1,
        "dead_clicks": 0,
        "frustrated_gestures": 2,
        "events_count": 47,
        "has_transcript": true,
        "tags": ["signup", "user-testing"],
        "raw_session_data": {...}
    }

    # Relationships
    features: Many-to-Many via feature_messages
    workspace_id: FK
    integration_id: FK
    sent_at: DateTime
```

### Feature Model

```python
class Feature(Base):
    id: UUID
    name: String  # "Add company field to signup"
    description: Text
    urgency: String  # low, medium, high, critical
    status: String  # new, under-review, planned, shipped
    mention_count: Integer  # Number of linked messages
    theme_id: FK (to Theme)
    workspace_id: FK

    first_mentioned: DateTime
    last_mentioned: DateTime

    # Relationships
    messages: Many-to-Many via feature_messages
    theme: Relationship to Theme
```

### Feature-Message Association

```python
feature_messages = Table(
    'feature_messages',
    Base.metadata,
    Column('feature_id', UUID, ForeignKey('features.id'), primary_key=True),
    Column('message_id', UUID, ForeignKey('messages.id'), primary_key=True),
    Column('created_at', DateTime, server_default=func.now())
)
```

---

## Example Output

### Console Log Output

```
2025-10-20 18:45:12 - INFO - Starting Fathom session ingestion
2025-10-20 18:45:12 - INFO - Workspace ID: 647ab033-6d10-4a35-9ace-0399052ec874
2025-10-20 18:45:12 - INFO - Project ID: proj_abc123
2025-10-20 18:45:12 - INFO - Limit: 50 sessions
2025-10-20 18:45:12 - INFO - Looking back: 30 days
2025-10-20 18:45:12 - INFO - Minimum duration: 10 seconds

2025-10-20 18:45:13 - INFO - Starting Fathom session ingestion for workspace: Acme Inc
2025-10-20 18:45:13 - INFO - Created integration with ID: 9a2b1c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p

2025-10-20 18:45:14 - INFO - Fetching up to 50 sessions from last 30 days
2025-10-20 18:45:18 - INFO - Successfully fetched 35 sessions from Fathom

2025-10-20 18:45:19 - INFO - Extracting features from fathom sess_1a2b3c4d
2025-10-20 18:45:31 - INFO - Extracted 2 features, 1 pain point from session

2025-10-20 18:45:32 - INFO -   ✓ Theme validated: 'Add company field' → 'UX/Onboarding' (confidence: 0.92)
2025-10-20 18:45:35 - INFO -   ✓ Matched to existing: 'Company field on signup' (confidence: 0.85) - Same feature, different wording

2025-10-20 18:45:36 - INFO - Ingested session: User testing signup (ID: sess_1a2b3c4d)
2025-10-20 18:45:37 - INFO - Extracting features from fathom sess_2e3f4g5h
2025-10-20 18:45:48 - INFO - Extracted 1 feature, 0 pain points from session

2025-10-20 18:45:49 - INFO -   ✓ Theme validated: 'Bulk export users' → 'Data Management' (confidence: 0.88)
2025-10-20 18:45:52 - INFO -   ✓ Created new: 'Bulk export users' (confidence it's unique: 0.95)

2025-10-20 18:45:53 - INFO - Ingested session: Testing export feature (ID: sess_2e3f4g5h)

[... more sessions ...]

2025-10-20 19:02:14 - INFO - Successfully ingested 35 sessions to database
2025-10-20 19:02:14 - INFO - ✅ Successfully ingested 35 sessions from Fathom!
```

### Database Results

**Messages Table**
```
ID                                | external_id  | source | title                      | author_name | duration | features_count
1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n  | sess_1a2b...  | fathom | User testing signup       | John Doe    | 245      | 1
2e3f4g5h-6i7j-8k9l-0m1n-2o3p4q5r  | sess_2e3f...  | fathom | Testing export feature    | Jane Smith  | 189      | 1
```

**Features Table**
```
ID                                | name                    | mentions | urgency  | theme          | first_mentioned | last_mentioned
a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4  | Company field on signup | 3        | high     | UX/Onboarding  | 2025-10-15      | 2025-10-20
b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5  | Bulk export users       | 1        | medium   | Data Management| 2025-10-20      | 2025-10-20
```

---

## Troubleshooting

### Common Issues

#### 1. "Fathom API token not found"

**Solution**: Ensure `FATHOM_API_TOKEN` is set in `.env` file

```bash
echo "FATHOM_API_TOKEN=your_token_here" >> .env
```

#### 2. "Fathom project ID not found"

**Solution**: Provide via CLI or environment variable

```bash
# Via CLI
python -m app.scripts.ingest_fathom_sessions \
  --workspace-id <uuid> \
  --project-id proj_abc123

# Or via environment
echo "FATHOM_PROJECT_ID=proj_abc123" >> .env
```

#### 3. "No sessions found in the specified date range"

**Causes**:
- No sessions recorded in the date range
- Date range too narrow
- Project ID incorrect

**Solution**:
- Check Fathom dashboard for sessions
- Increase `--days-back` value
- Verify project ID is correct

#### 4. "OpenAI API key not found"

**Solution**: Ensure `OPENAI_API_KEY` is set for AI extraction

```bash
echo "OPENAI_API_KEY=sk-proj-..." >> .env
```

#### 5. AI extraction is very slow

**Causes**:
- Large transcripts being analyzed
- High API latency
- Rate limiting

**Solutions**:
- Use `--min-duration` to filter sessions
- Skip extraction with `--no-extract-features`
- Reduce `--limit` for smaller batches
- Run during off-peak hours

#### 6. Duplicate features not being detected

**Causes**:
- LLM confidence threshold too high
- Features semantically different
- Themes not matching

**Solutions**:
- Review `AIFeatureMatchingService` confidence thresholds
- Ensure features are assigned correct themes
- Check AI insights in database to see extraction results

---

## Performance Metrics

### Typical Processing Times

| Activity | Duration | Notes |
|----------|----------|-------|
| Fetch 50 sessions | 5-10s | API call only |
| Fetch transcripts | 30-60s | Per session: 1-2s each |
| AI extraction per session | 10-15s | GPT-4o-mini with temperature 0.3 |
| Feature matching per feature | 3-5s | LLM semantic comparison |
| **Total for 50 sessions** | **5-15 minutes** | Depends on transcript length |

### API Costs (OpenAI)

- Feature extraction per session: $0.001-0.003
- Feature matching per feature: $0.0005-0.001
- 50 sessions with 100 total features: ~$0.20-0.40

---

## Best Practices

1. **Start small**: Use `--limit 10` to test before large runs
2. **Filter by duration**: Use `--min-duration 30` to skip short sessions
3. **Run regularly**: Schedule daily or weekly ingestions
4. **Monitor logs**: Check for errors and performance metrics
5. **Verify transcripts**: Ensure transcripts are accurate before relying on them
6. **Review features**: Spot-check extracted features for accuracy

---

## Related Documentation

- [Gong Ingestion](./GONG_INGESTION_README.md)
- [Transcript Ingestion Service](../app/services/transcript_ingestion_service.py)
- [AI Extraction Service](../app/services/ai_extraction_service.py)
- [Fathom API Documentation](https://api.fathom.com)

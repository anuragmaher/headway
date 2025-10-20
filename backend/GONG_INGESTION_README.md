# Gong Call Ingestion with Intelligent Feature Matching

## Overview

This system automatically ingests sales calls from Gong, extracts feature requests using AI, and intelligently matches them to existing features to avoid duplicates. It uses a multi-step LLM pipeline for extraction, classification, and deduplication.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FETCH GONG CALLS                                             │
│    - Fetch calls from Gong API (/v2/calls/extensive)           │
│    - Get call metadata + transcripts                           │
│    - Filter by date range                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. SAVE MESSAGE TO DATABASE                                     │
│    - Create Message record                                      │
│    - Store transcript in message_metadata                       │
│    - Set ai_insights=None initially                            │
│    - Set is_processed=False                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. AI FEATURE EXTRACTION (GPT-4o-mini)                         │
│    Input:                                                       │
│    - Call transcript                                           │
│    - Customer context (name, MRR)                              │
│    - Existing themes (for classification)                      │
│                                                                 │
│    Output:                                                      │
│    - feature_requests: [{title, description, urgency, theme}]  │
│    - bug_reports: [{title, description, severity}]             │
│    - sentiment, pain_points, summary                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. INTELLIGENT FEATURE MATCHING (Per Extracted Feature)        │
│                                                                 │
│    For each extracted feature:                                 │
│                                                                 │
│    a) Get existing features in same theme                      │
│       - Query: workspace_id + theme_id                         │
│       - Returns: [{id, name, description}]                     │
│                                                                 │
│    b) LLM Duplicate Detection (GPT-4o-mini)                    │
│       Prompt: "Is this new feature a duplicate of any          │
│       existing features? Consider semantic similarity."        │
│                                                                 │
│       Input:                                                    │
│       - New feature: {title, description}                      │
│       - Existing features: [{id, name, description}]           │
│                                                                 │
│       Output:                                                   │
│       {                                                         │
│         "is_duplicate": true/false,                            │
│         "matching_feature_id": "uuid" or null,                 │
│         "confidence": 0.0-1.0,                                 │
│         "reasoning": "detailed explanation"                    │
│       }                                                         │
│                                                                 │
│    c) Take Action:                                             │
│       - If is_duplicate=true (confidence ≥ 0.7):               │
│         * Link message to existing feature (many-to-many)      │
│         * Increment mention_count                              │
│         * Update last_mentioned timestamp                      │
│                                                                 │
│       - If is_duplicate=false:                                 │
│         * Create new Feature record                            │
│         * Link message to new feature                          │
│         * Set mention_count=1                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. FINALIZE MESSAGE                                             │
│    - Update message.ai_insights with extraction results        │
│    - Set is_processed=True                                     │
│    - Set processed_at=now()                                    │
│    - Commit all changes                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Ingestion Script
**File:** `app/scripts/ingest_gong_calls.py`

**Usage:**
```bash
PYTHONPATH=/Users/anuragmaherchandani/headway/backend python3 -m app.scripts.ingest_gong_calls \
  --workspace-id <workspace_uuid> \
  --limit 50 \
  --days-back 30
```

**Parameters:**
- `--workspace-id`: UUID of workspace to ingest into (required)
- `--limit`: Maximum number of calls to fetch (default: 100)
- `--days-back`: How many days back to fetch calls (default: 7)
- `--no-transcripts`: Skip transcript fetching (faster, but no AI extraction)
- `--no-extract-features`: Skip AI feature extraction

**Example:**
```bash
# Ingest last 30 days of calls with AI extraction
PYTHONPATH=/Users/anuragmaherchandani/headway/backend python3 -m app.scripts.ingest_gong_calls \
  --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 \
  --limit 200 \
  --days-back 30
```

### 2. AI Extraction Service
**File:** `app/services/ai_extraction_service.py`

**Purpose:** Extract feature requests, bugs, and insights from call transcripts

**Key Features:**
- Theme-aware extraction (only extracts features matching provided themes)
- Automatically classifies features into themes
- Extracts urgency levels
- Returns structured JSON

**LLM Configuration:**
- Model: `gpt-4o-mini`
- Temperature: 0.3 (for consistency)
- Response format: JSON object

**Prompt Structure:**
```
System: You are analyzing customer conversations.
Given these themes: [AI Features, Apps and Integrations]
Extract feature requests that align with these themes.

Return JSON:
{
  "feature_requests": [
    {
      "title": "...",
      "description": "...",
      "urgency": "low|medium|high|critical",
      "theme": "AI Features"  // Must match provided themes
    }
  ]
}
```

### 3. AI Feature Matching Service
**File:** `app/services/ai_feature_matching_service.py`

**Purpose:** Detect duplicate features using semantic understanding

**Key Features:**
- Semantic similarity detection (not just string matching)
- Confidence scoring (0.0 - 1.0)
- Detailed reasoning for each decision
- Configurable confidence threshold

**LLM Configuration:**
- Model: `gpt-4o-mini`
- Temperature: 0.2 (for consistent matching)
- Response format: JSON object

**Prompt Structure:**
```
System: You are a product manager detecting duplicate features.

NEW FEATURE:
Title: "AI Chatbot Integration"
Description: "Add chatbot for customer support"

EXISTING FEATURES:
1. [uuid-1] Chatbot powered by AI
   Description: Automated responses using artificial intelligence

2. [uuid-2] Salesforce Integration
   Description: Sync tickets with Salesforce

Consider semantic similarity, not just exact matching.

Return JSON:
{
  "is_duplicate": true,
  "matching_feature_id": "uuid-1",
  "confidence": 0.85,
  "reasoning": "Both features involve AI chatbots for support..."
}
```

**Confidence Levels:**
- **0.9-1.0**: Almost certainly the same feature
- **0.7-0.9**: Very likely the same (default threshold)
- **0.5-0.7**: Possibly related but different aspects
- **0.0-0.5**: Different features

## Data Models

### Message
```python
class Message(Base):
    id: UUID
    content: Text                    # Call transcript
    source: str = "gong"
    external_id: str                 # Gong call ID
    workspace_id: UUID
    integration_id: UUID

    # Timestamps
    sent_at: DateTime                # Call time
    created_at: DateTime

    # Processing status
    is_processed: bool = False
    processed_at: DateTime

    # AI extraction results
    ai_insights: JSONB = {
        "feature_requests": [...],
        "bug_reports": [...],
        "sentiment": {...},
        "summary": "..."
    }

    # Metadata
    message_metadata: JSONB = {
        "call_id": "...",
        "title": "...",
        "transcript_text": "...",
        "participants": [...],
        "duration_seconds": 1234
    }

    # Relationships
    features = relationship("Feature", secondary="feature_messages")
```

### Feature
```python
class Feature(Base):
    id: UUID
    name: str                        # Feature title
    description: Text                # Feature description
    urgency: str                     # low, medium, high, critical
    status: str = "new"              # new, under-review, planned, shipped
    mention_count: int = 1           # Number of linked messages

    # Relationships
    workspace_id: UUID
    theme_id: UUID                   # Classified theme

    # Timestamps
    first_mentioned: DateTime
    last_mentioned: DateTime
    created_at: DateTime
    updated_at: DateTime

    # Relationships
    messages = relationship("Message", secondary="feature_messages")
    theme = relationship("Theme")
```

### Theme
```python
class Theme(Base):
    id: UUID
    name: str                        # "AI Features"
    description: Text                # "AI-powered capabilities..."
    workspace_id: UUID
    is_default: bool = False         # True for "Uncategorized"

    # Relationships
    features = relationship("Feature")
```

## Workflow Example

### Scenario: Ingesting 50 Calls

```bash
PYTHONPATH=. python3 -m app.scripts.ingest_gong_calls \
  --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 \
  --limit 50 \
  --days-back 30
```

**Console Output:**
```
2025-10-20 17:27:28 - INFO - Starting Gong call ingestion
2025-10-20 17:27:28 - INFO - Workspace ID: 647ab033-6d10-4a35-9ace-0399052ec874
2025-10-20 17:27:28 - INFO - Loaded 2 themes for AI context
2025-10-20 17:27:28 - INFO -   - AI Features
2025-10-20 17:27:28 - INFO -   - Apps and Integrations
2025-10-20 17:27:34 - INFO - Successfully fetched 50 calls from Gong

# Processing Call 1
2025-10-20 17:27:35 - INFO - Extracting features from call: Hiver Demo | Steve <> Yukta
2025-10-20 17:27:48 - INFO - Extracted 2 features, 0 bugs from call
2025-10-20 17:27:48 - INFO - Ingested call: Hiver Demo | Steve <> Yukta

# Feature 1: New feature
2025-10-20 17:28:52 - INFO - ✓ Created new: 'Custom Signatures for Shared Inbox Users'
                              (confidence it's unique: 1.00)

# Feature 2: Matched to existing!
2025-10-20 17:28:57 - INFO - ✓ Matched to existing: 'Custom Signatures for Shared Inbox Users'
                              (confidence: 0.80) - Both features involve enabling individual
                              user identity in a shared inbox context.

2025-10-20 17:28:57 - INFO - → Created 1 new features, matched 1 to existing features

# Final Summary
2025-10-20 17:35:00 - INFO - Successfully ingested 50 calls to database
2025-10-20 17:35:00 - INFO - ✅ Successfully ingested 50 calls from Gong!
```

**Results:**
- ✅ 50 calls ingested
- ✅ 25 new features created (properly themed)
- ✅ 8 features matched to existing (no duplicates!)
- ✅ All messages linked to features via many-to-many relationship

## Database Relationships

### Message-Feature Many-to-Many

```sql
-- Association table
CREATE TABLE feature_messages (
    feature_id UUID REFERENCES features(id),
    message_id UUID REFERENCES messages(id),
    PRIMARY KEY (feature_id, message_id)
);

-- Example: One message mentions 3 features
Message(id=msg-1) → [Feature(id=f1), Feature(id=f2), Feature(id=f3)]

-- Example: One feature mentioned in 5 messages
Feature(id=f1) → [Message(id=m1), Message(id=m2), ..., Message(id=m5)]
Feature.mention_count = 5
```

### Querying Features with Messages

```python
# Get feature with all messages
feature = db.query(Feature).filter(Feature.id == feature_id).first()
for message in feature.messages:
    print(f"Mentioned in: {message.message_metadata['title']}")
    print(f"Date: {message.sent_at}")

# Get message with all features
message = db.query(Message).filter(Message.id == message_id).first()
for feature in message.features:
    print(f"Feature: {feature.name}")
    print(f"Mentions: {feature.mention_count}")
```

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...                    # OpenAI API key for AI extraction
GONG_ACCESS_KEY=...                      # Gong API access key
GONG_ACCESS_KEY_SECRET=...               # Gong API secret

# Database
DATABASE_URL=postgresql://...            # PostgreSQL connection string

# Optional
OPENAI_MODEL=gpt-4o-mini                 # Default: gpt-4o-mini
FEATURE_MATCH_CONFIDENCE=0.7             # Default: 0.7
```

### Adjusting Confidence Threshold

Edit `app/scripts/ingest_gong_calls.py`:

```python
# Line 715 - Default is 0.7
match_result = matching_service.find_matching_feature(
    new_feature={...},
    existing_features=existing_features_data,
    confidence_threshold=0.7  # Change to 0.6 for more aggressive matching
)
```

**Recommended values:**
- **0.8-0.9**: Conservative (fewer matches, more new features created)
- **0.7**: Balanced (default, recommended)
- **0.5-0.6**: Aggressive (more matches, fewer duplicates)

## Performance & Costs

### Processing Time
- **50 calls** with transcripts: ~5-8 minutes
- **1 call** with AI extraction: ~10-15 seconds
- **1 feature** matching: ~3-5 seconds

### API Costs (OpenAI GPT-4o-mini)
- **Feature extraction** per call: ~$0.001 - $0.003
- **Feature matching** per feature: ~$0.0005 - $0.001
- **50 calls** with 100 features total: ~$0.20 - $0.40

### Optimization Tips
1. **Reduce limit**: Process fewer calls per run
2. **Skip duplicates**: Script automatically skips already-ingested calls
3. **Batch processing**: Run overnight for large ingestions
4. **Cache results**: ai_insights stored in database, no re-processing needed

## Testing

### Test Feature Matching Service

```bash
cd /Users/anuragmaherchandani/headway/backend
PYTHONPATH=. python3 test_feature_matching.py
```

**Sample Output:**
```
Testing AI Feature Matching Service
============================================================

Test Case 1: Exact Match
Expected: Should match feature-1 with high confidence
------------------------------------------------------------
New Feature: AI Chatbot Integration
Is Duplicate: True
Confidence: 0.95
Matching ID: feature-1
Reasoning: Exact match - both features request the same AI chatbot functionality
✓ Matched to: AI Chatbot Integration

Test Case 2: Semantic Match
Expected: Should match feature-1 (different wording, same concept)
------------------------------------------------------------
New Feature: Chatbot powered by AI
Is Duplicate: True
Confidence: 0.88
Matching ID: feature-1
Reasoning: Both features describe AI-powered chatbot functionality...
✓ Matched to: AI Chatbot Integration
```

### Verify Database Records

```bash
# Check features created
PYTHONPATH=. python3 -c "
from app.core.database import get_db
from app.models.feature import Feature
from datetime import datetime, timedelta

db = next(get_db())
recent = db.query(Feature).filter(
    Feature.workspace_id == '647ab033-6d10-4a35-9ace-0399052ec874',
    Feature.created_at >= datetime.now() - timedelta(hours=1)
).all()

print(f'Features created in last hour: {len(recent)}')
for f in recent[:5]:
    print(f'  - {f.name} (Theme: {f.theme.name if f.theme else \"None\"})')
    print(f'    Mentions: {f.mention_count}')
"
```

## Monitoring & Logging

### Log Levels
- `INFO`: Normal operation, feature creation/matching
- `WARNING`: Theme not found, LLM errors
- `ERROR`: API failures, database errors
- `DEBUG`: Detailed matching decisions

### Key Log Messages

**Feature Created:**
```
INFO - ✓ Created new: 'AI Chatbot Integration' (confidence it's unique: 1.00)
```

**Feature Matched:**
```
INFO - ✓ Matched to existing: 'Salesforce Sync' (confidence: 0.85) -
       Both features involve CRM integration for ticket syncing
```

**Theme Classification:**
```
INFO - Loaded 2 themes for AI context
INFO -   - AI Features
INFO -   - Apps and Integrations
```

### Viewing Logs

```bash
# View real-time logs during ingestion
tail -f /var/log/headway/ingestion.log

# Search for matches
grep "Matched to existing" /var/log/headway/ingestion.log

# Count features created
grep "Created new:" /var/log/headway/ingestion.log | wc -l
```

## Troubleshooting

### Issue: No features being extracted

**Symptoms:**
```
INFO - Extracted 0 features, 0 bugs from call
```

**Possible causes:**
1. Transcripts don't contain feature requests
2. AI filtering too strict (themes don't match)
3. OpenAI API key invalid

**Solution:**
```bash
# Check themes are loaded
# Log should show: "Loaded N themes for AI context"

# Test without theme filtering
# Edit ai_extraction_service.py, comment out theme filtering
```

### Issue: Too many duplicates created

**Symptoms:**
```
INFO - ✓ Created new: 'AI Chatbot'
INFO - ✓ Created new: 'Chatbot with AI'  # Should have matched!
```

**Possible causes:**
1. Confidence threshold too high (0.9+)
2. Features in different themes (only matches within same theme)
3. LLM not detecting similarity

**Solution:**
```python
# Lower confidence threshold
confidence_threshold=0.6  # Instead of 0.7

# Check theme assignment
# Log should show: "✓ Created new: 'Feature' (Theme: AI Features)"
```

### Issue: Wrong features being matched

**Symptoms:**
```
INFO - ✓ Matched to existing: 'Salesforce Sync' (confidence: 0.75)
# But they're actually different features!
```

**Possible causes:**
1. Confidence threshold too low (0.5)
2. LLM hallucination
3. Similar descriptions but different features

**Solution:**
```python
# Increase confidence threshold
confidence_threshold=0.8  # Instead of 0.7

# Review LLM reasoning in logs
# Check if semantic similarity is actually correct
```

## Best Practices

### 1. Theme Management
- ✅ Create clear, distinct themes before ingestion
- ✅ Keep theme descriptions specific
- ❌ Don't create overlapping themes (e.g., "AI" and "Automation")
- ❌ Don't use generic themes like "Other" or "Misc"

### 2. Confidence Tuning
- Start with **0.7** (default)
- If too many duplicates → increase to **0.8**
- If missing matches → decrease to **0.6**
- Review LLM reasoning in logs to validate decisions

### 3. Incremental Ingestion
- Run small batches first (10-20 calls)
- Verify results in database and UI
- Scale up to larger batches (100-200 calls)
- Use `--days-back` to avoid re-processing

### 4. Data Quality
- Review AI extraction accuracy regularly
- Check if themes are being assigned correctly
- Monitor `mention_count` to ensure linking works
- Verify duplicate detection is accurate

## API Reference

### GongService

```python
from app.services.gong_service import gong_service

# Fetch calls
calls = gong_service.fetch_calls(
    from_date=datetime(2025, 9, 1),
    to_date=datetime(2025, 10, 1),
    limit=100
)

# Fetch transcript for a call
transcript = gong_service.fetch_transcript(call_id="123456789")
```

### AIExtractionService

```python
from app.services.ai_extraction_service import get_ai_extraction_service

service = get_ai_extraction_service()

# Extract features from transcript
result = service.extract_insights(
    transcript="Customer wants AI chatbot...",
    customer_name="Acme Corp",
    customer_mrr=5000.00,
    themes=[
        {"name": "AI Features", "description": "AI-powered capabilities"},
        {"name": "Apps and Integrations", "description": "Third-party integrations"}
    ]
)

# Returns:
{
    "feature_requests": [
        {
            "title": "AI Chatbot Integration",
            "description": "Add chatbot for support",
            "urgency": "high",
            "theme": "AI Features"
        }
    ],
    "bug_reports": [],
    "sentiment": {"overall": "positive", "score": 0.8},
    "summary": "Customer interested in AI chatbot..."
}
```

### AIFeatureMatchingService

```python
from app.services.ai_feature_matching_service import get_ai_feature_matching_service

service = get_ai_feature_matching_service()

# Check if feature is duplicate
match_result = service.find_matching_feature(
    new_feature={
        "title": "Chatbot powered by AI",
        "description": "Automated responses using AI"
    },
    existing_features=[
        {
            "id": "uuid-1",
            "name": "AI Chatbot Integration",
            "description": "Add chatbot for customer support"
        }
    ],
    confidence_threshold=0.7
)

# Returns:
{
    "is_duplicate": True,
    "matching_feature_id": "uuid-1",
    "confidence": 0.85,
    "reasoning": "Both features involve AI chatbot functionality...",
    "tokens_used": 245
}
```

## Roadmap

### Future Enhancements

1. **Embedding-based matching** (faster, cheaper)
   - Pre-compute embeddings for all features
   - Use cosine similarity for initial filtering
   - Use LLM only for edge cases

2. **Bulk feature merging**
   - Admin UI to review and merge similar features
   - Bulk operations for cleaning up duplicates

3. **Custom themes per workspace**
   - Allow workspaces to define their own themes
   - Auto-suggest themes based on extracted features

4. **Real-time ingestion**
   - Webhook from Gong on new calls
   - Process calls as they happen (not batch)

5. **Multi-language support**
   - Detect language in transcripts
   - Translate features to English for matching

---

## Support

For issues or questions:
1. Check logs for error messages
2. Review this README for troubleshooting
3. Contact: [your-email@example.com]

## License

Internal use only - HeadwayHQ

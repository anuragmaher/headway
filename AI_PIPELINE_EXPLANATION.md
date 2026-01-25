# AI Pipeline & Data Modeling Explanation

## Overview

HeadwayHQ uses a **tiered AI processing pipeline** to extract feature requests from customer conversations across multiple sources (Slack, Gmail, Gong, Fathom). The pipeline is **state-driven** and **event-driven**, processing messages through multiple stages with AI classification and extraction.

---

## Pipeline Flow

```
Message Ingestion
    ↓
Normalization (NormalizedEvent)
    ↓
Chunking (EventChunk for long messages)
    ↓
Tier-1 Classification (Score 0-10, filter if < 6)
    ↓
Tier-2 Extraction (Extract feature, assign theme/sub_theme)
    ↓
CustomerAsk Creation/Matching
    ↓
Message-CustomerAsk Linking (Many-to-Many)
    ↓
AI Insights Processing
```

---

## Data Models

### 1. **Message** (Source Data)
**Purpose:** Unified table storing raw messages from all sources

**Key Fields:**
- `id` (UUID) - Primary key
- `workspace_id` (UUID) - Which workspace owns this
- `connector_id` (UUID) - Which integration (Slack, Gmail, etc.)
- `source` (String) - 'slack', 'gmail', 'gong', 'fathom'
- `external_id` (String) - External system's message ID
- `content` (Text) - Raw message content
- `author_name`, `author_email` - Who sent it
- `channel_name`, `channel_id` - Where it came from
- `sent_at` (DateTime) - When it was sent

**Processing Flags:**
- `tier1_processed` (Boolean) - Has it been classified?
- `tier2_processed` (Boolean) - Has it been extracted?
- `feature_score` (Float 0-10) - Tier-1 relevance score

**Relationships:**
- Many-to-Many with `CustomerAsk` via `message_customer_asks` junction table
- One-to-Many with `AIInsight` (per-message insights)

---

### 2. **NormalizedEvent** (Pipeline Stage 1)
**Purpose:** Canonical representation of all source data for AI processing

**Key Fields:**
- `id` (UUID) - Primary key
- `workspace_id` (UUID)
- `source_type` (String) - 'slack', 'gmail', 'gong', 'fathom'
- `source_table` (String) - Always 'messages'
- `source_record_id` (UUID) - FK to `Message.id`
- `clean_text` (Text) - Normalized text content
- `event_timestamp` (DateTime)
- `event_metadata` (JSONB) - Actor info, title, channel, etc.

**Processing State:**
- `processing_stage` (String) - 'pending' → 'normalized' → 'chunked' → 'classified' → 'extracted' → 'completed'
- `is_chunked` (Boolean) - Was this split into chunks?
- `classification_confidence` (Float 0-1) - Tier-1 confidence
- `is_feature_relevant` (Boolean) - Did it pass Tier-1 filter?

**Relationships:**
- One-to-Many with `EventChunk` (if chunked)
- One-to-Many with `ExtractedFact` (audit trail)

---

### 3. **EventChunk** (Pipeline Stage 2 - Optional)
**Purpose:** Semantic chunks for messages > 1500 characters

**Key Fields:**
- `id` (UUID) - Primary key
- `normalized_event_id` (UUID) - FK to parent `NormalizedEvent`
- `chunk_text` (Text) - Chunk content
- `chunk_index` (Integer) - Chunk order
- `chunk_metadata` (JSONB) - Speaker info, timestamps

**Processing State:**
- Same stages as `NormalizedEvent` but independent processing
- Each chunk gets its own Tier-1 classification and Tier-2 extraction

**Why Chunking?**
- Long messages (call transcripts, email threads) may contain multiple feature requests
- Chunking allows extracting multiple `CustomerAsk` records from one message
- Each chunk is processed independently through the pipeline

---

### 4. **CustomerAsk** (Extracted Feature Request)
**Purpose:** Structured feature request extracted from messages

**Key Fields:**
- `id` (UUID) - Primary key
- `workspace_id` (UUID)
- `sub_theme_id` (UUID) - **Required** - Every CustomerAsk belongs to a SubTheme
- `name` (String) - Feature title
- `description` (Text) - Feature description
- `urgency` (String) - 'low', 'medium', 'high', 'critical'
- `status` (String) - 'new', 'under_review', 'planned', 'shipped'
- `mention_count` (Integer) - How many messages mention this
- `match_confidence` (Float) - AI confidence when created/matched
- `ai_metadata` (JSONB) - Problem statement, desired outcome, user persona, etc.

**Timestamps:**
- `first_mentioned_at` (DateTime)
- `last_mentioned_at` (DateTime)

**Relationships:**
- Many-to-One with `SubTheme` (required)
- Many-to-Many with `Message` via `message_customer_asks` junction table
- One-to-Many with `ExtractedFact` (audit trail)

**Deduplication Logic:**
- When extracting a new feature, AI matches against existing `CustomerAsk` records in the same `SubTheme`
- If match confidence >= 75%: Link message to existing `CustomerAsk` (increment `mention_count`)
- If match confidence < 75%: Create new `CustomerAsk`

---

### 5. **Theme & SubTheme** (Categorization)
**Purpose:** Hierarchical organization of feature requests

**Theme Model:**
- `id` (UUID)
- `workspace_id` (UUID)
- `name` (String) - e.g., "AI Features", "Analytics", "Security"
- `description` (String)
- `sort_order` (Integer)

**SubTheme Model:**
- `id` (UUID)
- `theme_id` (UUID) - FK to parent `Theme`
- `workspace_id` (UUID)
- `name` (String) - e.g., "Dashboard", "Reports", "Authentication"
- `description` (String)

**Hierarchy:**
```
Theme: "Analytics"
  ├── SubTheme: "Dashboard"
  ├── SubTheme: "Reports"
  └── SubTheme: "Metrics"
```

**Classification Rules:**
- Every `CustomerAsk` MUST belong to a `SubTheme`
- AI classifies features into themes using score-based matching
- Themes are workspace-specific (customizable per customer)

---

### 6. **MessageCustomerAsk** (Junction Table)
**Purpose:** Many-to-many relationship between Messages and CustomerAsks

**Key Fields:**
- `message_id` (UUID) - FK to `Message.id`
- `customer_ask_id` (UUID) - FK to `CustomerAsk.id`
- `is_primary` (Boolean) - First link for this message
- `extraction_confidence` (Float) - AI confidence for this link
- `match_reason` (String) - 'matched_existing' or 'created_new'
- `chunk_id` (UUID) - Optional, if link came from a chunk

**Why Many-to-Many?**
- One message (e.g., call transcript) can contain multiple feature requests
- Each feature request becomes a separate `CustomerAsk`
- The junction table tracks which messages mention which features
- Used by the Mentions Panel to show all messages for a `CustomerAsk`

---

### 7. **ExtractedFact** (Audit Trail)
**Purpose:** Immutable record of every AI extraction

**Key Fields:**
- `id` (UUID)
- `workspace_id` (UUID)
- `normalized_event_id` (UUID) - Source event
- `chunk_id` (UUID) - Optional, if from chunk
- `customer_ask_id` (UUID) - Which CustomerAsk this created/matched
- `feature_title`, `feature_description` - What was extracted
- `problem_statement`, `desired_outcome` - AI insights
- `extraction_confidence` (Float)
- `theme_id` (UUID) - Which theme it was classified into

**Purpose:**
- Debugging and audit trail
- Can be used to re-sync message links if needed
- Tracks all AI decisions for transparency

---

## Pipeline Stages (Detailed)

### Stage 1: Normalization
**Task:** `normalize_source_data`

**Process:**
1. Find `Message` records where `tier1_processed = False` AND no `NormalizedEvent` exists
2. Normalize text content (clean, remove noise)
3. Create `NormalizedEvent` with:
   - `clean_text` - Normalized content
   - `event_metadata` - Actor info, title, channel (JSONB)
   - `processing_stage = 'normalized'`
4. Trigger chunking stage

**Data Model:**
- `Message` → `NormalizedEvent` (one-to-one initially, but message can have multiple events if reprocessed)

---

### Stage 2: Chunking
**Task:** `chunk_normalized_events`

**Process:**
1. Find `NormalizedEvent` records with `processing_stage = 'normalized'`
2. If `clean_text` length > 1500 chars:
   - Split into semantic chunks (~1200 chars each, 200 char overlap)
   - Create `EventChunk` records (max 5 chunks per event)
   - Mark event as `is_chunked = True`
3. If length <= 1500 chars:
   - Mark as `is_chunked = False`, `processing_stage = 'chunked'`
4. Trigger Tier-1 classification

**Data Model:**
- `NormalizedEvent` → `EventChunk` (one-to-many, optional)

---

### Stage 3: Tier-1 Classification
**Task:** `classify_events`

**Purpose:** **THE ONLY FILTER POINT** - Cheap AI call to filter irrelevant content

**Process:**
1. Find `NormalizedEvent` and `EventChunk` records with `processing_stage = 'chunked'` or `'pending'`
2. For each item:
   - Call `TieredAIService.tier1_classify()` with text
   - Get score (0-10 scale)
   - If score >= 6.0:
     - Mark as `is_feature_relevant = True`
     - Set `processing_stage = 'classified'`
     - Update source `Message.tier1_processed = True`, `feature_score = score`
   - If score < 6.0:
     - Mark as `is_feature_relevant = False`
     - Set `processing_stage = 'completed'`
     - Update source `Message.tier1_processed = True`, `feature_score = score`
     - **STOP PROCESSING** (no Tier-2 extraction)

3. For chunked events: Aggregate chunk results to parent event
4. Trigger Tier-2 extraction if any items passed

**AI Model:** `gpt-4o-mini` (fast, cheap)
**Cost:** ~$0.001 per message

**Data Model:**
- `NormalizedEvent.feature_score` (0-10) stored
- `Message.feature_score` (0-10) stored
- Only items with score >= 6 proceed to Tier-2

---

### Stage 4: Tier-2 Extraction
**Task:** `extract_features`

**Purpose:** Extract structured feature data and assign themes

**Process:**
1. Find `NormalizedEvent` and `EventChunk` records with:
   - `processing_stage = 'classified'`
   - `is_feature_relevant = True`
   - `extracted_at IS NULL`

2. For each item:
   - **Step 1:** Call `TieredAIService.tier2_extract()` to extract:
     - Feature title and description
     - Problem statement, desired outcome
     - User persona, use case
     - Urgency hint, sentiment, keywords
   
   - **Step 2:** Validate feature title (filter invalid titles like "No Feature Found")
   
   - **Step 3:** Call `TieredAIService.classify_theme_by_score()` to assign:
     - `theme_id` and `sub_theme_id`
     - Theme and sub_theme confidence scores
   
   - **Step 4:** Get existing `CustomerAsk` records in the assigned `SubTheme`
   
   - **Step 5:** Match or create `CustomerAsk`:
     - Pre-AI check: Title similarity >= 90% → match immediately
     - AI matching: Call `TieredAIService.match_customer_ask()` with existing CustomerAsks
     - If match confidence >= 75%: Link to existing (increment `mention_count`)
     - If match confidence < 75%: Create new `CustomerAsk`
   
   - **Step 6:** Link message to CustomerAsk:
     - Create `MessageCustomerAsk` junction entry
     - Update `Message.tier2_processed = True`
     - Store `feature_score` on message
   
   - **Step 7:** Create `ExtractedFact` audit record
   
   - **Step 8:** Mark item as `processing_stage = 'extracted'`

3. Trigger AI Insights processing

**AI Model:** `gpt-4o-mini` (same model, multiple calls per item)
**Cost:** ~$0.01-0.02 per message (3-4 AI calls: extraction + theme + matching)

**Data Model:**
- `CustomerAsk` created or matched
- `MessageCustomerAsk` junction entry created
- `ExtractedFact` audit record created
- `Message.tier2_processed = True`

---

### Stage 5: AI Insights (Post-Processing)
**Task:** `process_pending_insights`

**Purpose:** Generate per-message insights for display in UI

**Process:**
1. Find `Message` records with `tier2_processed = True` but no `AIInsight`
2. For each message:
   - Get linked `CustomerAsk` records
   - Generate summary, sentiment, key topics
   - Create `AIInsight` record
3. Mark as complete

**Note:** This is separate from the main pipeline and runs after extraction completes.

---

## Key Design Decisions

### 1. **Tiered AI Approach**
- **Tier-1:** Fast, cheap classification (filter irrelevant content)
- **Tier-2:** Expensive extraction (only for relevant content)
- **Result:** ~80% cost reduction vs. running extraction on all messages

### 2. **State-Driven Pipeline**
- Each stage checks database state (`processing_stage` flags)
- No message queues or complex orchestration
- Idempotent: Safe to re-run tasks
- Self-healing: Tasks can recover from failures

### 3. **Many-to-Many Message-CustomerAsk**
- One message can link to multiple `CustomerAsk` records
- Enables extracting multiple features from call transcripts
- Junction table tracks all relationships

### 4. **Chunking for Long Messages**
- Messages > 1500 chars are split into chunks
- Each chunk processed independently
- Allows extracting multiple features from one message

### 5. **Theme Hierarchy**
- Two-level hierarchy: Theme → SubTheme
- Every `CustomerAsk` must belong to a `SubTheme`
- AI classifies into themes using score-based matching

### 6. **Deduplication Strategy**
- Pre-AI: Title similarity >= 90% → immediate match
- AI matching: Semantic similarity >= 75% → match existing
- Otherwise: Create new `CustomerAsk`
- Matching only within same `SubTheme` (prevents false matches)

---

## Data Flow Example

**Scenario:** Slack message requesting "Add dark mode toggle"

1. **Ingestion:** Message stored in `messages` table
   - `tier1_processed = False`
   - `tier2_processed = False`

2. **Normalization:** `NormalizedEvent` created
   - `clean_text = "Add dark mode toggle"`
   - `processing_stage = 'normalized'`

3. **Chunking:** No chunking needed (< 1500 chars)
   - `processing_stage = 'chunked'`

4. **Tier-1 Classification:** AI scores 8.5/10
   - `is_feature_relevant = True`
   - `processing_stage = 'classified'`
   - `Message.tier1_processed = True`, `feature_score = 8.5`

5. **Tier-2 Extraction:**
   - Extract: "Dark Mode Toggle" feature
   - Classify: Theme = "Design", SubTheme = "UI/UX"
   - Match: No existing CustomerAsk in "UI/UX" sub_theme
   - Create: New `CustomerAsk` with `name = "Dark Mode Toggle"`
   - Link: Create `MessageCustomerAsk` junction entry
   - `Message.tier2_processed = True`

6. **AI Insights:** Generate summary for message display

**Result:**
- `CustomerAsk` record created
- `Message` linked to `CustomerAsk` via junction table
- Feature appears in Themes dashboard under "Design" → "UI/UX"

---

## Performance Characteristics

- **Normalization:** ~100 messages/second
- **Chunking:** ~50 messages/second
- **Tier-1 Classification:** ~20 messages/second (AI bottleneck)
- **Tier-2 Extraction:** ~5 messages/second (multiple AI calls)
- **Total Pipeline:** ~3-5 messages/second end-to-end

**Cost per Message:**
- Tier-1: ~$0.001
- Tier-2: ~$0.01-0.02
- **Total: ~$0.01-0.02 per message** (only for messages that pass Tier-1)

---

## Error Handling & Recovery

1. **Retry Logic:** Each stage retries failed items up to 3 times
2. **Exhausted Items:** Items that exhaust retries are marked as completed with score 0
3. **Orphaned Messages:** Recovery functions fix messages that got stuck
4. **Idempotency:** All stages are idempotent (safe to re-run)

---

## Monitoring & Observability

- **Processing Stages:** Track items in each `processing_stage`
- **Feature Scores:** `Message.feature_score` shows Tier-1 relevance
- **Extracted Facts:** Audit trail of all AI decisions
- **Mention Counts:** `CustomerAsk.mention_count` shows popularity

---

This pipeline ensures that all customer feedback is systematically processed, categorized, and deduplicated into actionable feature requests organized by themes.

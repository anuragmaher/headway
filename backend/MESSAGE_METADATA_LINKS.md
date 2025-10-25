# Message Storage and External Links - Data Availability Analysis

## Summary

Messages from Gong and Fathom are stored with rich metadata that includes direct links to view the original calls/sessions. The metadata is stored in the `message_metadata` JSONB column of the Message model.

---

## 1. Message Model Structure

**File:** `app/models/message.py`

### Key Fields:

```python
class Message(Base):
    __tablename__ = "messages"
    
    id                 # UUID - primary key
    external_id        # String - unique ID from source (Gong call ID, Fathom session ID)
    content            # Text - full transcript
    source             # String - "gong", "fathom", "slack", etc.
    channel_name       # String - channel/source display name
    channel_id         # String - channel identifier
    
    # Author information
    author_name        # String - message author name
    author_id          # String - author ID in source system
    author_email       # String - author email
    
    # CRITICAL: Metadata Storage
    message_metadata   # JSONB - stores source-specific metadata (links, call IDs, etc.)
    ai_insights        # JSONB - AI-extracted features, bugs, sentiment
    
    # Relationships
    features           # Many-to-many relationship to Feature model
    customer           # Foreign key to Customer
    workspace          # Foreign key to Workspace
    integration        # Foreign key to Integration
```

---

## 2. Gong Message Metadata Structure

**Source:** `app/scripts/ingest_gong_calls.py` (lines 603-614)

### What's Stored:

```python
message_metadata = {
    "call_id": call_id,                           # Gong call ID - use for links
    "title": title,                               # Call title
    "scheduled": scheduled,                       # Scheduled time
    "started": started,                           # Call start time
    "duration_seconds": duration_seconds,         # Call duration
    "participants": participants,                 # List of participant names
    "has_transcript": transcript_data is not None,# Boolean
    "hubspot_context": hubspot_data,              # HubSpot account/deal info
    "raw_call_data": call_data,                   # Full call data from Gong API
    "transcript_data": transcript_data            # Full transcript JSON
}
```

### Available for Linking:

- **Call ID:** `message_metadata['call_id']` - Can be used to construct Gong call URL
- **Title:** `message_metadata['title']`
- **Participants:** `message_metadata['participants']`
- **HubSpot Context:** `message_metadata['hubspot_context']` (accounts, deals, contacts)

### Gong Call URL Format:
Based on typical Gong URLs: `https://app.gong.io/call?id={call_id}` or similar

---

## 3. Fathom Message Metadata Structure

**Source:** `app/scripts/ingest_fathom_sessions.py` (lines 314-334)

### What's Stored:

```python
message_metadata = {
    "session_id": session_id,                     # Fathom recording ID
    "title": title,                               # Session title
    "recording_url": recording_url,               # DIRECT LINK to recording (share_url)
    "user_email": user_email,                     # Who recorded it
    "user_name": user_name,                       # Recorder name
    "duration_seconds": duration_seconds,         # Session duration
    "created_at": created_at,                     # When recorded
    "page_url": session_data.get('page_url'),    # Page being recorded
    "device_type": session_data.get('device_type'),
    "browser": session_data.get('browser'),
    "os": session_data.get('os'),
    
    # User behavior metrics
    "rage_clicks": session_data.get('rage_clicks', 0),
    "error_clicks": session_data.get('error_clicks', 0),
    "dead_clicks": session_data.get('dead_clicks', 0),
    "frustrated_gestures": session_data.get('frustrated_gestures', 0),
    
    "events_count": len(events),                  # Number of recorded events
    "tags": session_data.get('tags', []),         # Session tags
    "has_transcript": bool(transcript_text),      # Boolean
    "raw_session_data": session_data              # Full session data
}
```

### Available for Linking:

- **Recording URL:** `message_metadata['recording_url']` - **READY TO USE DIRECTLY!** (share_url from Fathom API)
- **Session ID:** `message_metadata['session_id']` - Alternative identifier
- **User/Author Info:** `message_metadata['user_email']`, `message_metadata['user_name']`
- **Behavior Metrics:** rage_clicks, error_clicks, dead_clicks, frustrated_gestures

---

## 4. How to Query Messages with Links

### API Endpoint to Get Messages for a Feature:

**File:** `app/api/v1/features.py` (line 738)

```
GET /features/{feature_id}/messages?workspace_id={workspace_id}
```

Returns `List[MessageResponse]` with current structure:
```python
class MessageResponse(BaseModel):
    id: str
    content: str
    sent_at: str
    sender_name: Optional[str]
    channel_name: Optional[str]
    customer_name: Optional[str]
    customer_email: Optional[str]
    ai_insights: Optional[dict]
```

**IMPORTANT:** This response currently does NOT include `message_metadata`. To get metadata, you need to:

1. Add `message_metadata` to the `MessageResponse` model
2. Return it in the API response

---

## 5. Database Schema for Data Points

**File:** `app/models/workspace_data_point.py`

The `WorkspaceDataPoint` model stores extracted data from messages:

```python
class WorkspaceDataPoint(Base):
    __tablename__ = "workspace_data_points"
    
    id                    # UUID
    workspace_id          # FK to workspace
    feature_id            # FK to feature
    message_id            # FK to message - LINKS BACK TO MESSAGE!
    
    data_point_key        # e.g., "mrr", "urgency_score", "pain_level"
    data_point_category   # e.g., "business_metrics", "structured_metrics"
    
    numeric_value         # For numbers
    integer_value         # For counts/scores
    text_value            # For strings
```

This allows querying what specific data was extracted from each message.

---

## 6. Customer and Metadata Context

### Gong - HubSpot Integration

```python
# From ingest_gong_calls.py
hubspot_context = {
    "accounts": [
        {
            "object_id": account_id,
            "domain": company_domain,
            "name": company_name,
            "industry": industry,
            "website": website,
            "all_fields": {}  # Custom fields including MRR, ARR, etc.
        }
    ],
    "deals": [
        {
            "amount": deal_amount,
            "stage": deal_stage,
            "close_date": close_date,
            "probability": probability
        }
    ],
    "contacts": []
}
```

**Stored in:** `message_metadata['hubspot_context']`

### Fathom - Email Domain Based

```python
# From ingest_fathom_sessions.py
# Customer created from email domain (e.g., user@acme.com -> customer.domain = "acme.com")
customer = Customer(
    workspace_id=workspace_id,
    name=company_name,
    domain=domain,
    external_system='fathom',
    external_id=domain,
    last_activity_at=datetime.now(timezone.utc)
)
```

---

## 7. Summary: What You Can Access

### For Gong Messages:
- `message.external_id` → Gong call ID
- `message.message_metadata['call_id']` → Same as above
- `message.message_metadata['title']` → Call title
- `message.message_metadata['participants']` → List of participants
- `message.message_metadata['hubspot_context']` → Customer/deal info
- `message.customer` → Customer record linked to the call

### For Fathom Messages:
- `message.external_id` → Fathom session ID (recording_id)
- `message.message_metadata['recording_url']` → **Direct link to recording!**
- `message.message_metadata['session_id']` → Session identifier
- `message.message_metadata['user_name']` → Who recorded it
- `message.message_metadata['user_email']` → Recorder email
- `message.message_metadata['page_url']` → Page being recorded
- `message.message_metadata['rage_clicks']` → User frustration metrics
- `message.customer` → Customer extracted from email domain

---

## 8. Integration Model

**File:** `app/models/integration.py`

Each message is linked to an Integration record:

```python
class Integration(Base):
    provider             # "gong", "fathom", "slack", etc.
    provider_metadata    # JSONB - can store provider-specific config
    external_team_id     # Team/workspace ID in external system
    external_team_name   # Team name
    last_synced_at       # When data was last synced
    sync_status          # "pending", "syncing", "success", "error"
```

---

## 9. Implementation Recommendation

To add links to original calls in the UI:

1. **Update MessageResponse to include metadata:**
   ```python
   class MessageResponse(BaseModel):
       id: str
       content: str
       sent_at: str
       sender_name: Optional[str]
       channel_name: Optional[str]
       source: str  # "gong", "fathom", "slack"
       external_id: str  # The call/session ID
       message_metadata: Optional[dict]  # Include this!
       ...
   ```

2. **Build links in frontend:**
   ```typescript
   // For Fathom
   const recordingUrl = message.message_metadata?.recording_url;
   
   // For Gong (you need to determine Gong's URL format)
   const gongUrl = `https://app.gong.io/call?id=${message.external_id}`;
   ```

3. **Store any missing URL patterns:**
   - Verify Gong call URL format
   - Document both in code as constants

---

## 10. Key Findings

| Aspect | Gong | Fathom |
|--------|------|--------|
| **Call/Session ID** | `call_id` in metadata or `external_id` | `session_id` in metadata or `external_id` |
| **Direct Link URL** | Need to construct | **Already available in `message_metadata['recording_url']`** |
| **Participants** | Yes, in `message_metadata['participants']` | User info in `message_metadata['user_email']`, `user_name` |
| **Customer Context** | HubSpot integration available | Email domain-based customer |
| **Behavior/Metrics** | Call duration, participants | Rage clicks, error clicks, frustrated gestures |
| **Source Verification** | `message.source == 'gong'` | `message.source == 'fathom'` |

---

## Conclusion

All necessary data to create clickable links to original Gong calls and Fathom recordings is already being stored in the database. The `message_metadata` JSONB column contains:
- **Fathom:** Direct recording URL (`recording_url`)
- **Gong:** Call ID (`call_id`) to construct URL

No database changes needed—just need to expose this metadata through the API and use it in the frontend.

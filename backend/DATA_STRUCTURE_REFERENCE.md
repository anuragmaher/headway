# Data Structure Reference: Gong & Fathom Message Metadata

## Message Database Row Example

```sql
-- What a Gong message looks like in the database:
SELECT 
  id,
  external_id,           -- Gong call ID
  source,                -- "gong"
  content,               -- Full transcript
  message_metadata,      -- JSON with all metadata below
  created_at
FROM messages
WHERE source = 'gong'
LIMIT 1;

-- What a Fathom message looks like:
SELECT 
  id,
  external_id,           -- Fathom session ID
  source,                -- "fathom"
  content,               -- Full transcript
  message_metadata,      -- JSON with all metadata below
  created_at
FROM messages
WHERE source = 'fathom'
LIMIT 1;
```

---

## Gong Message Metadata (JSON Structure)

```json
{
  "call_id": "abc123def456",
  "title": "Q4 Sales Call - Acme Corp",
  "scheduled": "2024-10-25T14:00:00Z",
  "started": "2024-10-25T14:05:00Z",
  "duration_seconds": 1843,
  "participants": [
    "john.smith@acme.com",
    "jane.doe@acme.com",
    "sales-rep@company.com"
  ],
  "has_transcript": true,
  "hubspot_context": {
    "accounts": [
      {
        "object_id": "hubspot_account_123",
        "name": "Acme Corporation",
        "domain": "acme.com",
        "industry": "Technology",
        "website": "https://acme.com",
        "phone": "+1-555-0100",
        "all_fields": {
          "mrr": 50000,
          "arr": 600000,
          "custom_field_1": "value"
        }
      }
    ],
    "deals": [
      {
        "amount": 250000,
        "stage": "negotiation",
        "close_date": 1730390400,
        "probability": 0.75
      }
    ],
    "contacts": []
  },
  "raw_call_data": {
    // Full Gong API response...
  },
  "transcript_data": {
    // Full transcript JSON from Gong API...
  }
}
```

---

## Fathom Message Metadata (JSON Structure)

```json
{
  "session_id": "fathom_rec_789xyz",
  "title": "Website Session - Product Demo",
  "recording_url": "https://share.fathom.video/share/abc123def456",
  "user_email": "john@acme.com",
  "user_name": "John Smith",
  "duration_seconds": 342,
  "created_at": "2024-10-25T10:30:00Z",
  "page_url": "https://app.example.com/pricing",
  "device_type": "Desktop",
  "browser": "Chrome 119.0",
  "os": "macOS 14.0",
  "rage_clicks": 3,
  "error_clicks": 1,
  "dead_clicks": 2,
  "frustrated_gestures": 0,
  "events_count": 45,
  "tags": [
    "product-demo",
    "pricing-page",
    "enterprise"
  ],
  "has_transcript": true,
  "raw_session_data": {
    // Full Fathom API session object...
  }
}
```

---

## How to Access in Python

```python
from app.models.message import Message
from sqlalchemy.orm import Session

# Get a message
db: Session = ...
message = db.query(Message).filter(Message.id == "message-uuid").first()

# Access metadata fields
if message.source == "gong":
    # Direct field access
    call_id = message.external_id  # "abc123def456"
    call_title = message.message_metadata['title']
    
    # Get participant list
    participants = message.message_metadata.get('participants', [])
    # Returns: ["john.smith@acme.com", "jane.doe@acme.com", ...]
    
    # Get customer info
    hubspot = message.message_metadata.get('hubspot_context', {})
    company_name = hubspot['accounts'][0]['name']  # "Acme Corporation"
    mrr = hubspot['accounts'][0]['all_fields']['mrr']  # 50000
    
    # Build link to Gong
    gong_url = f"https://app.gong.io/call?id={call_id}"

elif message.source == "fathom":
    # Direct link available!
    recording_url = message.message_metadata['recording_url']
    # "https://share.fathom.video/share/abc123def456"
    
    # User information
    user_name = message.message_metadata['user_name']
    user_email = message.message_metadata['user_email']
    
    # Session metrics
    rage_clicks = message.message_metadata['rage_clicks']  # 3
    frustrated = message.message_metadata['frustrated_gestures']  # 0
    
    # Page being recorded
    page_url = message.message_metadata['page_url']
    # "https://app.example.com/pricing"

# Get customer record linked to message
customer = message.customer
if customer:
    print(f"Customer: {customer.name}")
    print(f"Domain: {customer.domain}")
    print(f"MRR: ${customer.mrr}")
```

---

## How to Access via API

### Current Response (GET /features/{feature_id}/messages)

```json
{
  "id": "msg-uuid-123",
  "content": "[Full transcript text...]",
  "sent_at": "2024-10-25T14:05:00Z",
  "sender_name": "Jane Doe",
  "channel_name": "Gong Call" or "Fathom Session",
  "customer_name": "Acme Corp",
  "customer_email": "john@acme.com",
  "ai_insights": {
    "feature_requests": [...],
    "bugs": [...]
  }
}
```

### Updated Response (after adding metadata)

```json
{
  "id": "msg-uuid-123",
  "content": "[Full transcript text...]",
  "sent_at": "2024-10-25T14:05:00Z",
  "sender_name": "Jane Doe",
  "channel_name": "Gong Call" or "Fathom Session",
  "source": "gong" or "fathom",
  "external_id": "call-id-or-session-id",
  "message_metadata": {
    // Full metadata object from above...
  },
  "customer_name": "Acme Corp",
  "customer_email": "john@acme.com",
  "ai_insights": {...}
}
```

---

## Building Frontend Links

### TypeScript/React Implementation

```typescript
interface MessageMetadata {
  recording_url?: string;  // Fathom only
  call_id?: string;        // Gong
  title: string;
  user_name?: string;      // Fathom
  participants?: string[]; // Gong
}

interface Message {
  id: string;
  source: 'gong' | 'fathom' | 'slack';
  external_id: string;
  message_metadata: MessageMetadata;
}

function buildExternalLink(message: Message): {
  url: string | null;
  label: string;
  icon: string;
} {
  if (message.source === 'fathom') {
    return {
      url: message.message_metadata.recording_url || null,
      label: 'View Recording',
      icon: 'video'
    };
  } else if (message.source === 'gong') {
    const callId = message.external_id;
    return {
      url: `https://app.gong.io/call?id=${callId}`,
      label: 'View Call',
      icon: 'phone'
    };
  }
  return {
    url: null,
    label: '',
    icon: ''
  };
}

// In your React component:
function MessageCard({ message }: { message: Message }) {
  const link = buildExternalLink(message);
  
  return (
    <div>
      <p>{message.message_metadata.title}</p>
      {link.url && (
        <a href={link.url} target="_blank" rel="noopener noreferrer">
          {link.label} →
        </a>
      )}
    </div>
  );
}
```

---

## Data Availability Summary

### Gong Messages Have:
- ✓ Call ID (for linking)
- ✓ Call title
- ✓ All participants
- ✓ Call duration
- ✓ Company info (via HubSpot)
- ✓ Deal info (via HubSpot)
- ✓ MRR/ARR if in HubSpot
- ✓ Full transcript

### Fathom Messages Have:
- ✓ Recording URL (ready to use!)
- ✓ Session ID
- ✓ User who recorded it
- ✓ Page being recorded
- ✓ Device/browser/OS info
- ✓ User frustration signals (rage clicks, errors)
- ✓ Session duration
- ✓ Tags/metadata
- ✓ Full transcript

### Both Have:
- ✓ Source identification
- ✓ Timestamps (when created)
- ✓ Author/user information
- ✓ Customer linkage
- ✓ Full content/transcript
- ✓ AI-extracted insights

---

## Notes

1. **Fathom advantage:** Recording URL is pre-built by Fathom API
2. **Gong advantage:** Rich HubSpot integration with company/deal data
3. **Database fields:** All metadata stored in JSONB `message_metadata` column
4. **No migrations needed:** Structure already exists
5. **Customer records:** Both sources create/link to Customer records

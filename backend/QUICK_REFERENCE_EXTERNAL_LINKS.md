# Quick Reference: External Links for Gong and Fathom Messages

## At a Glance

All the data you need to create links to original calls/sessions is already stored in the database.

---

## For Fathom Messages

### Recording URL (Ready to Use)
```python
message.message_metadata['recording_url']  # Direct link - just use it!
```

**Example:**
```python
for message in messages:
    if message.source == 'fathom':
        recording_url = message.message_metadata.get('recording_url')
        # Use this URL directly in your <a href> tags
```

### Other Useful Fathom Data
```python
message.message_metadata['session_id']           # Session identifier
message.message_metadata['user_name']            # Who recorded it
message.message_metadata['user_email']           # Recorder email
message.message_metadata['page_url']             # Page being recorded
message.message_metadata['duration_seconds']     # How long the session was
message.message_metadata['rage_clicks']          # User frustration signal
message.message_metadata['error_clicks']         # More frustration signals
```

---

## For Gong Messages

### Call ID (For Building Links)
```python
message.external_id                  # Gong call ID
message.message_metadata['call_id']  # Same ID (stored in metadata too)
```

### Building the URL
```python
# Assuming standard Gong URL format
call_id = message.external_id
gong_url = f"https://app.gong.io/call?id={call_id}"
```

### Other Useful Gong Data
```python
message.message_metadata['title']               # Call title
message.message_metadata['participants']        # List of people on the call
message.message_metadata['duration_seconds']    # Call duration
message.message_metadata['started']             # When call started
message.message_metadata['hubspot_context']     # Customer/deal info
  └─ accounts[0]['name']                       # Company name
  └─ accounts[0]['domain']                     # Company domain
  └─ deals[0]['amount']                        # Deal amount
```

---

## How to Access in Code

### Python Backend (FastAPI)
```python
from app.models.message import Message
from sqlalchemy.orm import Session

def get_message_with_links(db: Session, message_id: str):
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if message.source == 'fathom':
        recording_url = message.message_metadata['recording_url']
        return {
            'link': recording_url,
            'type': 'fathom',
            'user': message.message_metadata['user_name']
        }
    
    elif message.source == 'gong':
        call_id = message.external_id
        gong_url = f"https://app.gong.io/call?id={call_id}"
        return {
            'link': gong_url,
            'type': 'gong',
            'title': message.message_metadata['title']
        }
```

### Frontend (TypeScript/React)
```typescript
interface Message {
  id: string;
  source: 'gong' | 'fathom' | 'slack';
  externalId: string;
  messageMetadata?: Record<string, any>;
}

function getExternalLink(message: Message): string | null {
  if (message.source === 'fathom') {
    return message.messageMetadata?.recording_url || null;
  } else if (message.source === 'gong') {
    return `https://app.gong.io/call?id=${message.externalId}`;
  }
  return null;
}

// In your component
const link = getExternalLink(message);
if (link) {
  return <a href={link} target="_blank">View Call</a>;
}
```

---

## Key Differences

| Platform | URL Status | How to Get It |
|----------|-----------|---------------|
| **Fathom** | Pre-built, ready to use | `message.message_metadata['recording_url']` |
| **Gong** | Need to construct | Use `message.external_id` in URL template |

---

## API Changes Needed

The current `GET /features/{feature_id}/messages` endpoint doesn't return `message_metadata`. To expose it:

### Option 1: Update MessageResponse (Recommended)
```python
# In app/api/v1/features.py

class MessageResponse(BaseModel):
    id: str
    content: str
    sent_at: str
    sender_name: Optional[str]
    channel_name: Optional[str]
    source: str  # "gong", "fathom", "slack"
    external_id: str  # Add this
    message_metadata: Optional[dict]  # Add this
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    ai_insights: Optional[dict] = None
```

### Option 2: Create New Response Model
```python
class MessageDetailsResponse(MessageResponse):
    message_metadata: Optional[dict]  # Only for detailed requests
```

---

## Testing/Verification

To verify the data is available:

```bash
# Backend test
python -c "
from app.models.message import Message
from app.core.database import SessionLocal
db = SessionLocal()
msg = db.query(Message).filter(Message.source == 'fathom').first()
print(f'Recording URL: {msg.message_metadata.get(\"recording_url\")}')
print(f'Session ID: {msg.message_metadata.get(\"session_id\")}')
"

# Or check a Gong message
python -c "
from app.models.message import Message
from app.core.database import SessionLocal
db = SessionLocal()
msg = db.query(Message).filter(Message.source == 'gong').first()
print(f'Call ID: {msg.external_id}')
print(f'Title: {msg.message_metadata.get(\"title\")}')
"
```

---

## Notes

- **No database changes needed** - all data is already stored
- **Fathom advantage** - recording URL is pre-built (from Fathom API's `share_url`)
- **Gong advantage** - participant information readily available
- **Customer context** - Both platforms link to Customer records with company info

For more details, see: `MESSAGE_METADATA_LINKS.md`

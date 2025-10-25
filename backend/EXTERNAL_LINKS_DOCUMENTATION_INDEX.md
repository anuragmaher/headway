# External Links Documentation Index

## Overview

Complete documentation for accessing and displaying links to Gong calls and Fathom recording sessions within HeadwayHQ.

## Documents Overview

### 1. MESSAGE_METADATA_LINKS.md (10 KB) - COMPREHENSIVE ANALYSIS
**For:** Technical team members who need a deep understanding of how data is stored and accessed

**Contains:**
- Complete Message model structure and all database fields
- Detailed breakdown of Gong metadata (10 fields with descriptions)
- Detailed breakdown of Fathom metadata (16 fields with descriptions)
- Database relationships and how to query them
- Customer context and CRM integration details
- HubSpot integration for Gong data
- Email domain-based customer creation for Fathom
- Implementation recommendations
- API endpoint analysis and requirements

**When to read:** 
- Implementing the API changes
- Understanding the database schema
- Debugging metadata issues

---

### 2. QUICK_REFERENCE_EXTERNAL_LINKS.md (5.4 KB) - PRACTICAL GUIDE
**For:** Developers implementing the feature

**Contains:**
- Quick copy-paste code examples
- Python backend example
- TypeScript/React frontend example
- Exact fields to access for each platform
- API response structure (current and updated)
- Testing instructions
- Common patterns and gotchas

**When to read:**
- Getting started with implementation
- Quick lookup of field names
- Troubleshooting access patterns

---

### 3. DATA_STRUCTURE_REFERENCE.md (7.4 KB) - SCHEMA & EXAMPLES
**For:** Understanding actual data structures with concrete examples

**Contains:**
- SQL queries to see messages in database
- Gong message metadata as JSON with example values
- Fathom message metadata as JSON with example values
- Python code examples for accessing each field
- API response examples (before and after)
- React component implementation example
- Comparison table of available data

**When to read:**
- Designing API response structure
- Understanding what data is available
- Learning by example

---

## Quick Start Path

### If you want to add external links to the UI:

1. **First read:** QUICK_REFERENCE_EXTERNAL_LINKS.md (5 min)
   - Get the exact field names to expose
   - See code examples

2. **Then implement:**
   - Update MessageResponse in `app/api/v1/features.py`
   - Add `source`, `external_id`, `message_metadata` fields

3. **Build frontend:** Use the TypeScript example in DATA_STRUCTURE_REFERENCE.md

---

## Key Findings Summary

### Fathom Recording Links
- Status: **READY TO USE**
- Field: `message_metadata['recording_url']`
- Example: `https://share.fathom.video/share/abc123def456`
- Additional data: user info, session metrics, page visited, frustration signals

### Gong Call Links
- Status: **NEEDS URL CONSTRUCTION**
- Field: `message.external_id` or `message_metadata['call_id']`
- URL template: `https://app.gong.io/call?id={call_id}` (verify format)
- Additional data: participants, company info, deal info, MRR/ARR from HubSpot

---

## Implementation Checklist

- [ ] Read QUICK_REFERENCE_EXTERNAL_LINKS.md for overview
- [ ] Verify Gong URL format with team/documentation
- [ ] Update MessageResponse model in `app/api/v1/features.py`
  - [ ] Add `source: str` field
  - [ ] Add `external_id: str` field  
  - [ ] Add `message_metadata: Optional[dict]` field
- [ ] Update the get_feature_messages endpoint to return new fields
- [ ] Build frontend component to display links
  - [ ] Handle Fathom (direct URL)
  - [ ] Handle Gong (constructed URL)
  - [ ] Add appropriate icons/labels
- [ ] Test with actual Gong and Fathom messages in database
- [ ] Update API documentation

---

## Database Considerations

### Storage Location
- Table: `messages`
- Column: `message_metadata` (JSONB type)
- Already populated during ingestion

### No Migrations Needed
All data is already being stored. Only API exposure and frontend components are needed.

### Data Availability
- Gong calls: Ingested from `app/scripts/ingest_gong_calls.py`
- Fathom sessions: Ingested from `app/scripts/ingest_fathom_sessions.py`
- Service processing: `app/services/transcript_ingestion_service.py`

---

## API Endpoints Affected

### GET /features/{feature_id}/messages
**Location:** `app/api/v1/features.py` line 738

**Current response:** Does NOT include message_metadata or source info

**Required changes:**
```python
class MessageResponse(BaseModel):
    id: str
    content: str
    sent_at: str
    sender_name: Optional[str]
    channel_name: Optional[str]
    source: str                          # ADD THIS
    external_id: str                     # ADD THIS
    message_metadata: Optional[dict]     # ADD THIS
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    ai_insights: Optional[dict] = None
```

---

## Related Files

### Models
- `app/models/message.py` - Message model with message_metadata field
- `app/models/integration.py` - Integration tracking
- `app/models/customer.py` - Customer records linked to messages

### Ingestion
- `app/scripts/ingest_gong_calls.py` - Where Gong metadata is stored
- `app/scripts/ingest_fathom_sessions.py` - Where Fathom metadata is stored
- `app/services/transcript_ingestion_service.py` - Generic processing service

### API
- `app/api/v1/features.py` - Where messages endpoint is defined

---

## Questions & Answers

**Q: Do I need to modify the database?**
A: No. All data is already stored in message_metadata JSONB field.

**Q: Where is the recording URL for Fathom?**
A: It's in `message_metadata['recording_url']`. It's a direct link from Fathom API.

**Q: How do I get the Gong call link?**
A: Use `message.external_id` in URL template: `https://app.gong.io/call?id={call_id}`

**Q: What other data is available?**
A: See DATA_STRUCTURE_REFERENCE.md for complete breakdown with examples.

**Q: Can I access participant information?**
A: Yes for Gong (in message_metadata['participants']), limited for Fathom (user info only).

**Q: Is customer data linked?**
A: Yes. Both have message.customer reference. Gong has HubSpot data too.

---

## File Locations

All documentation files are in `/backend/`:

```
/backend/
├── MESSAGE_METADATA_LINKS.md              (This analysis - comprehensive)
├── QUICK_REFERENCE_EXTERNAL_LINKS.md      (Quick guide - practical)
├── DATA_STRUCTURE_REFERENCE.md            (Examples - concrete)
├── EXTERNAL_LINKS_DOCUMENTATION_INDEX.md  (This file - navigation)
└── app/
    ├── models/message.py
    ├── scripts/ingest_gong_calls.py
    ├── scripts/ingest_fathom_sessions.py
    └── api/v1/features.py
```

---

## Next Steps

1. **Read:** QUICK_REFERENCE_EXTERNAL_LINKS.md
2. **Verify:** Gong URL format with team
3. **Implement:** Update MessageResponse and endpoint
4. **Build:** Frontend component for display
5. **Test:** With actual messages in database
6. **Deploy:** To production

---

Generated: October 26, 2024
Based on code analysis of HeadwayHQ backend

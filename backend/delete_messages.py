#!/usr/bin/env python3
"""
Delete all messages to re-ingest with updated AI prompt
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.message import Message

def delete_messages():
    """Delete all messages"""
    db = next(get_db())
    try:
        count = db.query(Message).delete()
        db.commit()
        print(f"✅ Deleted {count} messages")
    finally:
        db.close()

if __name__ == "__main__":
    delete_messages()

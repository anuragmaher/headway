#!/usr/bin/env python3
"""
Clean up test data
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables
load_dotenv()

# Add the backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.message import Message
from app.models.feature import Feature


def cleanup():
    """Delete test data"""
    db = next(get_db())

    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    try:
        # First delete feature-message associations
        db.execute(text("""
            DELETE FROM feature_messages
            WHERE message_id IN (
                SELECT id FROM messages
                WHERE workspace_id = :workspace_id AND source = 'test'
            )
        """), {"workspace_id": workspace_id})
        print("Deleted feature-message associations")

        # Delete messages from test source
        messages_deleted = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "test"
        ).delete()
        print(f"Deleted {messages_deleted} test messages")

        db.commit()
        print("Cleanup complete")
    finally:
        db.close()


if __name__ == "__main__":
    cleanup()

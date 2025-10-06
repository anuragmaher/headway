#!/usr/bin/env python3

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.message import Message

def find_workspace_ids():
    """Find all workspace IDs in the database"""

    db = next(get_db())
    try:
        print("Finding workspace IDs...")

        # Get distinct workspace IDs from messages
        workspace_ids = db.query(Message.workspace_id).distinct().all()

        if workspace_ids:
            print("Found workspace IDs:")
            for (workspace_id,) in workspace_ids:
                print(f"  - {workspace_id}")
        else:
            print("No workspace IDs found in messages table")

        # Count messages per workspace
        for (workspace_id,) in workspace_ids:
            count = db.query(Message).filter(Message.workspace_id == workspace_id).count()
            print(f"Workspace {workspace_id}: {count} messages")

    except Exception as e:
        print(f"❌ Error finding workspace IDs: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    find_workspace_ids()
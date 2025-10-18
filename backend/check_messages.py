#!/usr/bin/env python3
"""
Check messages and their ai_insights status
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.message import Message

def check_messages():
    """Check messages in the database"""

    db = next(get_db())

    try:
        workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

        # Get all messages for workspace
        all_messages = db.query(Message).filter(
            Message.workspace_id == workspace_id
        ).all()

        print(f"Total messages in workspace: {len(all_messages)}")
        print("=" * 70)

        # Check messages with ai_insights
        for msg in all_messages:
            has_insights = msg.ai_insights is not None
            print(f"Message ID: {msg.id}")
            print(f"Source: {msg.source}")
            print(f"Has ai_insights: {has_insights}")
            if has_insights:
                print(f"  Features: {len(msg.ai_insights.get('feature_requests', []))}")
                print(f"  Bugs: {len(msg.ai_insights.get('bug_reports', []))}")
            print()

    finally:
        db.close()


if __name__ == "__main__":
    check_messages()

#!/usr/bin/env python3
"""
Migration script to move ai_insights from message_metadata to ai_insights column
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.message import Message
from sqlalchemy import text


def migrate_ai_insights():
    """Move ai_insights from message_metadata to separate column"""

    db = next(get_db())

    try:
        print("🔄 Migrating AI insights from message_metadata to ai_insights column...")
        print("=" * 70)

        # Find messages with ai_insights in metadata
        messages = db.query(Message).filter(
            Message.message_metadata.contains({"ai_insights": {}})
        ).all()

        print(f"Found {len(messages)} messages with ai_insights in metadata")

        updated_count = 0
        for message in messages:
            if message.message_metadata and 'ai_insights' in message.message_metadata:
                # Move to new column
                message.ai_insights = message.message_metadata['ai_insights']

                # Remove from metadata
                metadata = dict(message.message_metadata)
                del metadata['ai_insights']
                message.message_metadata = metadata

                updated_count += 1
                print(f"  ✓ Migrated message {message.id} ({message.source})")

        if updated_count > 0:
            db.commit()
            print()
            print(f"✅ Successfully migrated {updated_count} messages")
        else:
            print()
            print("✅ No messages needed migration")

        # Verify
        print()
        print("📊 Verification:")
        print("-" * 70)

        total_messages = db.query(Message).count()
        messages_with_ai_insights = db.query(Message).filter(
            Message.ai_insights.isnot(None)
        ).count()

        print(f"Total messages: {total_messages}")
        print(f"Messages with ai_insights column populated: {messages_with_ai_insights}")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_ai_insights()

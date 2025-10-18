#!/usr/bin/env python3
"""
Check detailed breakdown of features per message
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.message import Message


def check_message_details():
    """Check how many features/bugs each message has"""
    db = next(get_db())

    try:
        workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

        # Get all messages with ai_insights for workspace
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.ai_insights.isnot(None)
        ).all()

        print(f"\nTotal messages with AI insights: {len(messages)}")
        print(f"{'='*100}\n")

        total_features = 0
        total_bugs = 0

        for idx, msg in enumerate(messages, 1):
            ai_insights = msg.ai_insights

            if not ai_insights:
                continue

            feature_count = len(ai_insights.get('feature_requests', []))
            bug_count = len(ai_insights.get('bug_reports', []))

            total_features += feature_count
            total_bugs += bug_count

            customer_name = msg.customer.name if msg.customer else 'Unknown'

            print(f"{idx}. Message ID: {str(msg.id)[:8]} | Customer: {customer_name[:30]:<30} | Features: {feature_count} | Bugs: {bug_count}")

            # Show feature titles if any
            if feature_count > 0:
                for feature in ai_insights.get('feature_requests', []):
                    print(f"   - {feature.get('title', 'N/A')[:80]}")

        print(f"\n{'='*100}")
        print(f"TOTALS: {total_features} features, {total_bugs} bugs across {len(messages)} messages")
        print(f"{'='*100}\n")

    finally:
        db.close()


if __name__ == "__main__":
    check_message_details()

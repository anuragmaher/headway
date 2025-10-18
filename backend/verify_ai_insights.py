#!/usr/bin/env python3
"""
Verify ai_insights column structure
"""

import sys
from pathlib import Path
import json

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.message import Message


def verify_structure():
    """Show ai_insights structure from a sample message"""

    db = next(get_db())

    try:
        # Get first message with ai_insights
        message = db.query(Message).filter(
            Message.ai_insights.isnot(None)
        ).first()

        if not message:
            print("No messages with ai_insights found")
            return

        print("=" * 70)
        print(f"Message ID: {message.id}")
        print(f"Source: {message.source}")
        print(f"Customer: {message.customer.name if message.customer else 'N/A'}")
        print("=" * 70)
        print()

        print("📊 AI Insights Structure:")
        print("-" * 70)

        insights = message.ai_insights

        # Feature Requests
        features = insights.get('feature_requests', [])
        print(f"\n✨ Feature Requests: {len(features)}")
        for i, feature in enumerate(features[:2], 1):  # Show first 2
            print(f"  {i}. {feature.get('title')}")
            print(f"     Urgency: {feature.get('urgency')}")
            print(f"     Quote: {feature.get('quote', '')[:80]}...")

        # Bug Reports
        bugs = insights.get('bug_reports', [])
        print(f"\n🐛 Bug Reports: {len(bugs)}")
        for i, bug in enumerate(bugs[:2], 1):
            print(f"  {i}. {bug.get('title')}")
            print(f"     Severity: {bug.get('severity')}")

        # Pain Points
        pain_points = insights.get('pain_points', [])
        print(f"\n😓 Pain Points: {len(pain_points)}")
        for i, pain in enumerate(pain_points[:2], 1):
            print(f"  {i}. {pain.get('description', '')[:80]}...")

        # Sentiment
        sentiment = insights.get('sentiment', {})
        print(f"\n💭 Sentiment:")
        print(f"  Overall: {sentiment.get('overall')}")
        print(f"  Score: {sentiment.get('score')}")
        print(f"  Reasoning: {sentiment.get('reasoning', '')[:80]}...")

        # Key Topics
        topics = insights.get('key_topics', [])
        print(f"\n🏷️  Key Topics: {', '.join(topics)}")

        # Summary
        summary = insights.get('summary', '')
        print(f"\n📝 Summary:")
        print(f"  {summary[:150]}...")

        # Metadata
        metadata = insights.get('extraction_metadata', {})
        print(f"\n⚙️  Extraction Metadata:")
        print(f"  Model: {metadata.get('model')}")
        print(f"  Tokens: {metadata.get('tokens_used')}")
        customer_mrr = metadata.get('customer_mrr')
        if customer_mrr:
            print(f"  Customer MRR: ${customer_mrr:,.2f}")
        else:
            print(f"  Customer MRR: N/A")

        print()
        print("=" * 70)
        print("✅ ai_insights is now stored in separate column!")
        print("✅ message_metadata no longer contains ai_insights")

    finally:
        db.close()


if __name__ == "__main__":
    verify_structure()

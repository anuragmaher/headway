#!/usr/bin/env python3
"""
Display all feature requests and bug reports from messages in table format
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.message import Message


def display_features_bugs():
    """Display all feature requests and bug reports in table format"""
    db = next(get_db())

    try:
        # Get all messages with ai_insights
        messages = db.query(Message).filter(
            Message.ai_insights.isnot(None)
        ).all()

        print(f"\n{'='*120}")
        print(f"FEATURE REQUESTS AND BUG REPORTS")
        print(f"Total messages with AI insights: {len(messages)}")
        print(f"{'='*120}\n")

        # Collect all features and bugs
        all_features = []
        all_bugs = []

        for msg in messages:
            ai_insights = msg.ai_insights

            if not ai_insights:
                continue

            # Extract feature requests
            feature_requests = ai_insights.get('feature_requests', [])
            for feature in feature_requests:
                all_features.append({
                    'message_id': str(msg.id)[:8],
                    'customer': msg.customer.name if msg.customer else 'Unknown',
                    'title': feature.get('title', 'N/A'),
                    'urgency': feature.get('urgency', 'N/A'),
                    'description': feature.get('description', 'N/A')[:100],
                    'quote': feature.get('quote', 'N/A')[:100]
                })

            # Extract bug reports
            bug_reports = ai_insights.get('bug_reports', [])
            for bug in bug_reports:
                all_bugs.append({
                    'message_id': str(msg.id)[:8],
                    'customer': msg.customer.name if msg.customer else 'Unknown',
                    'title': bug.get('title', 'N/A'),
                    'severity': bug.get('severity', 'N/A'),
                    'description': bug.get('description', 'N/A')[:100],
                    'quote': bug.get('quote', 'N/A')[:100]
                })

        # Display Feature Requests
        print(f"\n{'='*120}")
        print(f"FEATURE REQUESTS ({len(all_features)} total)")
        print(f"{'='*120}")

        if all_features:
            # Print header
            print(f"\n{'Msg ID':<10} {'Customer':<20} {'Urgency':<10} {'Title':<40}")
            print(f"{'-'*10} {'-'*20} {'-'*10} {'-'*40}")

            # Print each feature
            for idx, feature in enumerate(all_features, 1):
                print(f"{feature['message_id']:<10} {feature['customer'][:20]:<20} {feature['urgency']:<10} {feature['title'][:40]:<40}")
                print(f"  Description: {feature['description']}")
                print(f"  Quote: \"{feature['quote']}\"")
                print()
        else:
            print("No feature requests found.")

        # Display Bug Reports
        print(f"\n{'='*120}")
        print(f"BUG REPORTS ({len(all_bugs)} total)")
        print(f"{'='*120}")

        if all_bugs:
            # Print header
            print(f"\n{'Msg ID':<10} {'Customer':<20} {'Severity':<10} {'Title':<40}")
            print(f"{'-'*10} {'-'*20} {'-'*10} {'-'*40}")

            # Print each bug
            for idx, bug in enumerate(all_bugs, 1):
                print(f"{bug['message_id']:<10} {bug['customer'][:20]:<20} {bug['severity']:<10} {bug['title'][:40]:<40}")
                print(f"  Description: {bug['description']}")
                print(f"  Quote: \"{bug['quote']}\"")
                print()
        else:
            print("No bug reports found.")

        # Summary
        print(f"\n{'='*120}")
        print(f"SUMMARY")
        print(f"{'='*120}")
        print(f"Total Messages: {len(messages)}")
        print(f"Total Feature Requests: {len(all_features)}")
        print(f"Total Bug Reports: {len(all_bugs)}")
        print(f"{'='*120}\n")

    finally:
        db.close()


if __name__ == "__main__":
    display_features_bugs()

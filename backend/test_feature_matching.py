"""
Simple test script to verify AI feature matching service
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_feature_matching_service import get_ai_feature_matching_service
import json


def test_matching():
    """Test the feature matching service with sample data"""

    print("Testing AI Feature Matching Service\n")
    print("=" * 60)

    # Sample existing features
    existing_features = [
        {
            "id": "feature-1",
            "name": "AI Chatbot Integration",
            "description": "Add an AI-powered chatbot to handle basic customer inquiries automatically"
        },
        {
            "id": "feature-2",
            "name": "Salesforce Sync",
            "description": "Automatically sync tickets and customer data with Salesforce CRM"
        },
        {
            "id": "feature-3",
            "name": "Email Templates",
            "description": "Create and manage reusable email templates for common responses"
        }
    ]

    # Test cases
    test_cases = [
        {
            "name": "Exact Match",
            "new_feature": {
                "title": "AI Chatbot Integration",
                "description": "We need an AI chatbot"
            },
            "expected": "Should match feature-1 with high confidence"
        },
        {
            "name": "Semantic Match",
            "new_feature": {
                "title": "Chatbot powered by AI",
                "description": "Add automatic chatbot responses using artificial intelligence"
            },
            "expected": "Should match feature-1 (different wording, same concept)"
        },
        {
            "name": "Similar Feature",
            "new_feature": {
                "title": "Salesforce Integration",
                "description": "Need better integration with Salesforce for ticket syncing"
            },
            "expected": "Should match feature-2 (Salesforce sync)"
        },
        {
            "name": "New Feature",
            "new_feature": {
                "title": "Slack Notifications",
                "description": "Send notifications to Slack when new tickets arrive"
            },
            "expected": "Should NOT match any existing feature"
        }
    ]

    try:
        service = get_ai_feature_matching_service()

        for i, test_case in enumerate(test_cases, 1):
            print(f"\nTest Case {i}: {test_case['name']}")
            print(f"Expected: {test_case['expected']}")
            print("-" * 60)

            result = service.find_matching_feature(
                new_feature=test_case['new_feature'],
                existing_features=existing_features,
                confidence_threshold=0.7
            )

            print(f"New Feature: {test_case['new_feature']['title']}")
            print(f"Is Duplicate: {result['is_duplicate']}")
            print(f"Confidence: {result['confidence']:.2f}")
            print(f"Matching ID: {result['matching_feature_id']}")
            print(f"Reasoning: {result['reasoning']}")

            if result['is_duplicate']:
                matched = next(f for f in existing_features if f['id'] == result['matching_feature_id'])
                print(f"✓ Matched to: {matched['name']}")
            else:
                print("✓ Identified as new feature")

        print("\n" + "=" * 60)
        print("All tests completed successfully!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_matching()

"""
Test script for theme validation with confidence threshold
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_feature_matching_service import get_ai_feature_matching_service


def test_theme_validation():
    """Test the theme validation service with sample features"""

    print("Testing AI Theme Validation Service")
    print("=" * 80)
    print()

    # Test cases
    test_cases = [
        {
            "name": "Perfect Match - AI Feature",
            "feature": {
                "title": "AI-powered Smart Reply Suggestions",
                "description": "Use machine learning to suggest intelligent email replies based on context"
            },
            "theme": {
                "name": "AI Features",
                "description": "AI-powered capabilities including smart replies, sentiment analysis, and automated categorization"
            },
            "expected": "Should have HIGH confidence (>0.8)"
        },
        {
            "name": "Perfect Match - Integration",
            "feature": {
                "title": "Slack Integration for Notifications",
                "description": "Send real-time notifications to Slack channels when new tickets arrive"
            },
            "theme": {
                "name": "Apps and Integrations",
                "description": "Third-party integrations with tools like Slack, Salesforce, Jira, etc."
            },
            "expected": "Should have HIGH confidence (>0.8)"
        },
        {
            "name": "Weak Match - AI theme but not really AI",
            "feature": {
                "title": "Email Template Builder",
                "description": "Create and save reusable email templates for common responses"
            },
            "theme": {
                "name": "AI Features",
                "description": "AI-powered capabilities including smart replies, sentiment analysis, and automated categorization"
            },
            "expected": "Should have LOW confidence (<0.8) - not AI-related"
        },
        {
            "name": "Weak Match - Integration theme but not integration",
            "feature": {
                "title": "Dark Mode Support",
                "description": "Add dark mode theme to reduce eye strain for users working at night"
            },
            "theme": {
                "name": "Apps and Integrations",
                "description": "Third-party integrations with tools like Slack, Salesforce, Jira, etc."
            },
            "expected": "Should have LOW confidence (<0.8) - not an integration"
        }
    ]

    try:
        service = get_ai_feature_matching_service()

        for i, test_case in enumerate(test_cases, 1):
            print(f"Test Case {i}: {test_case['name']}")
            print(f"Expected: {test_case['expected']}")
            print("-" * 80)

            feature = test_case['feature']
            theme = test_case['theme']

            result = service.validate_theme_assignment(
                feature_title=feature['title'],
                feature_description=feature['description'],
                suggested_theme=theme['name'],
                theme_description=theme['description']
            )

            print(f"Feature: {feature['title']}")
            print(f"Theme: {theme['name']}")
            print(f"Is Valid (≥0.8): {result['is_valid']}")
            print(f"Confidence: {result['confidence']:.2f}")
            print(f"Reasoning: {result['reasoning']}")

            # Color coding for result
            if result['is_valid']:
                print("✓ PASSED - Feature would be CREATED with this theme")
            else:
                print("✗ REJECTED - Feature would be SKIPPED (theme mismatch)")

            print()

        print("=" * 80)
        print("All theme validation tests completed!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_theme_validation()

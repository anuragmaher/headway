"""
Test script for AI processing service with user-defined schemas
"""
import sys
import os
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db
from app.models.message import Message
from app.services.ai_processing_service import ai_processing_service


def test_ai_processing():
    """Test AI processing on a few messages"""

    # Get database session
    db = next(get_db())

    try:
        # Get workspace ID (hardcoded for testing)
        workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

        # Fetch a few messages from the database
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id
        ).limit(5).all()

        if not messages:
            print("❌ No messages found in the database")
            return

        print(f"✅ Found {len(messages)} messages to test\n")
        print("=" * 80)

        # Process each message
        for i, message in enumerate(messages, 1):
            print(f"\n📨 Message {i}:")
            print(f"   Content: {message.content[:100]}...")
            print(f"   Channel: {message.channel_name}")
            print(f"   Author: {message.author_name}")

            # Process the message
            result = ai_processing_service.process_message(message, workspace_id=workspace_id)

            # Display results
            print(f"\n🤖 AI Processing Result:")
            print(f"   Is Feature Request: {result.get('is_feature_request', False)}")
            print(f"   Confidence: {result.get('confidence', 0.0)}")

            if result.get('is_feature_request'):
                print(f"   Feature Title: {result.get('feature_title', 'N/A')}")
                print(f"   Theme: {result.get('theme', 'N/A')}")
                print(f"   Priority: {result.get('priority', 'N/A')}")
                print(f"   Urgency: {result.get('urgency', 'N/A')}")

                # Display extracted data
                extracted_data = result.get('extracted_data', {})
                if extracted_data:
                    print(f"\n   📊 Extracted Data:")
                    for field_name, field_value in extracted_data.items():
                        print(f"      - {field_name}: {field_value}")

                print(f"\n   💡 Reasoning: {result.get('reasoning', 'N/A')}")

            if 'error' in result:
                print(f"   ❌ Error: {result['error']}")

            print("=" * 80)

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


if __name__ == "__main__":
    test_ai_processing()

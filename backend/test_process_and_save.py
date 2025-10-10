"""
Test script for processing messages with AI and saving to database
"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db
from app.models.message import Message
from app.services.message_processing_with_storage_service import message_processing_with_storage_service


def test_process_and_save():
    """Test processing messages and saving to database"""

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

        print(f"✅ Found {len(messages)} messages to process\n")
        print("=" * 80)

        # Process each message
        for i, message in enumerate(messages, 1):
            print(f"\n📨 Message {i}:")
            print(f"   Content: {message.content[:80]}...")
            print(f"   Channel: {message.channel_name}")
            print(f"   Author: {message.author_name}")

            # Process and save the message
            result = message_processing_with_storage_service.process_and_save_message(
                message=message,
                workspace_id=workspace_id,
                db=db
            )

            # Display results
            print(f"\n🤖 Processing Result:")
            print(f"   Status: {result.get('status')}")

            if result.get('status') == 'success':
                print(f"   Feature ID: {result.get('feature_id')}")
                print(f"   Feature Name: {result.get('feature_name')}")
                print(f"   Theme: {result.get('theme_name', 'No theme')}")
                print(f"   Is New Feature: {result.get('is_new_feature')}")
                print(f"   Data Points Saved: {result.get('data_points_saved')}")
                print(f"   ✅ Saved to database!")
            elif result.get('status') == 'not_feature_request':
                print(f"   ⚠️  Not identified as a feature request")
            else:
                print(f"   ❌ Error: {result.get('error', 'Unknown error')}")

            print("=" * 80)

        # Display summary
        print(f"\n📊 Summary:")
        print(f"   Messages processed: {i}")
        print(f"   Check the database for saved features and data points!")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


if __name__ == "__main__":
    test_process_and_save()

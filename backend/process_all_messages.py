"""
Process ALL messages with AI and save to database
"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.message_processing_with_storage_service import message_processing_with_storage_service


def process_all_messages():
    """Process all messages and save to database"""

    # Get workspace ID (hardcoded for testing)
    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    print("🚀 Starting batch processing of ALL messages...")
    print("=" * 80)

    try:
        # Process all messages in the workspace
        result = message_processing_with_storage_service.batch_process_and_save_messages(
            workspace_id=workspace_id,
            limit=None  # Process all messages
        )

        # Display results
        print(f"\n✅ Processing Complete!\n")
        print(f"📊 Summary:")
        print(f"   Status: {result.get('status')}")
        print(f"   Messages Processed: {result.get('messages_processed', 0)}")
        print(f"   Features Created: {result.get('features_created', 0)}")
        print(f"   Features Updated: {result.get('features_updated', 0)}")
        print(f"   Data Points Saved: {result.get('data_points_saved', 0)}")
        print("=" * 80)

        # Show any errors
        results = result.get('results', [])
        errors = [r for r in results if r.get('status') == 'error']
        if errors:
            print(f"\n⚠️  Errors encountered: {len(errors)}")
            for error in errors[:5]:  # Show first 5 errors
                print(f"   - Message {error.get('message_id')}: {error.get('error')}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    process_all_messages()

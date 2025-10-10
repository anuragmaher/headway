"""
Test AI-powered feature deduplication
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
from app.models.feature import Feature
from app.services.message_processing_with_storage_service import message_processing_with_storage_service


def test_deduplication():
    """Test AI deduplication by processing similar messages"""

    # Get database session
    db = next(get_db())

    try:
        # Get workspace ID
        workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

        # Show existing features count before
        features_before = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()

        print(f"📊 Features before processing: {features_before}")
        print("=" * 80)

        # Get a few messages to process
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id
        ).limit(10).all()

        print(f"\n🔄 Processing {len(messages)} messages with AI deduplication...\n")

        for i, message in enumerate(messages, 1):
            print(f"📨 Message {i}: {message.content[:60]}...")

            result = message_processing_with_storage_service.process_and_save_message(
                message=message,
                workspace_id=workspace_id,
                db=db
            )

            if result.get('status') == 'success':
                is_new = result.get('is_new_feature')
                feature_name = result.get('feature_name')

                if is_new:
                    print(f"   ✨ Created NEW feature: {feature_name}")
                else:
                    print(f"   🔗 Mapped to EXISTING feature: {feature_name}")

                # Show AI decision
                ai_result = result.get('ai_result', {})
                mapping = ai_result.get('feature_mapping', {})
                if mapping:
                    print(f"   📊 AI Decision: {mapping.get('action')}")
                    print(f"   🎯 Similarity: {mapping.get('similarity_score', 0):.2f}")
                    print(f"   💭 Reasoning: {mapping.get('reasoning', 'N/A')}")
            else:
                print(f"   ⚠️  {result.get('status')}")

            print()

        # Show features count after
        features_after = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()

        print("=" * 80)
        print(f"📊 Features after processing: {features_after}")
        print(f"📈 New features created: {features_after - features_before}")

        # Show features with mention_count > 1
        popular_features = db.query(Feature).filter(
            Feature.workspace_id == workspace_id,
            Feature.mention_count > 1
        ).all()

        if popular_features:
            print(f"\n🔥 Features with multiple mentions:")
            for feature in popular_features:
                print(f"   - {feature.name}: {feature.mention_count} mentions")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


if __name__ == "__main__":
    test_deduplication()

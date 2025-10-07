#!/usr/bin/env python3
"""
Test script for the Enhanced Message Processor

This script demonstrates how to use the enhanced message processor
and runs a small test with sample data.
"""

import os
import sys
from datetime import datetime

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from enhanced_message_processor import EnhancedMessageProcessor


def test_processor_basic_functionality():
    """Test basic functionality of the message processor"""

    print("Testing Enhanced Message Processor")
    print("="*50)

    try:
        # Initialize processor
        processor = EnhancedMessageProcessor()
        print("✓ Processor initialized successfully")

        # Test workspace ID (you'll need to replace with a real workspace ID)
        workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

        print(f"✓ Testing with workspace ID: {workspace_id}")

        # Run dry-run test with limit of 5 messages
        print("\n" + "-"*30)
        print("Running DRY RUN test (limit: 5)")
        print("-"*30)

        result = processor.process_workspace_messages(
            workspace_id=workspace_id,
            limit=5,
            dry_run=True
        )

        print(f"✓ Processing completed")
        print(f"Status: {result['status']}")

        processor.print_statistics()

        if result.get('results'):
            print(f"\nSample results:")
            for i, res in enumerate(result['results'][:3]):
                print(f"{i+1}. Message {res.message_id}")
                print(f"   Step reached: {res.step_reached}")
                if res.theme_id:
                    print(f"   Theme: {res.theme_id}")
                if res.sub_theme_id:
                    print(f"   Sub-theme: {res.sub_theme_id}")
                if res.feature_id:
                    print(f"   Feature: {res.feature_id} {'(created)' if res.feature_created else '(updated)'}")
                if res.signals_extracted:
                    print(f"   Signals: {len(res.signals_extracted)} extracted")
                if res.error:
                    print(f"   Error: {res.error}")
                print()

        return True

    except Exception as e:
        print(f"✗ Error testing processor: {e}")
        return False


def show_usage_examples():
    """Show usage examples for the processor"""

    print("\n" + "="*60)
    print("USAGE EXAMPLES")
    print("="*60)

    examples = [
        {
            "title": "Basic dry-run test (5 messages)",
            "command": "python enhanced_message_processor.py --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 --limit 5 --dry-run"
        },
        {
            "title": "Process 50 messages with verbose logging",
            "command": "python enhanced_message_processor.py --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 --limit 50 --verbose --dry-run"
        },
        {
            "title": "Process all messages (LIVE - will save to database)",
            "command": "python enhanced_message_processor.py --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874"
        },
        {
            "title": "Process 100 messages live",
            "command": "python enhanced_message_processor.py --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 --limit 100"
        }
    ]

    for i, example in enumerate(examples, 1):
        print(f"\n{i}. {example['title']}:")
        print(f"   {example['command']}")


def check_prerequisites():
    """Check if all prerequisites are met"""

    print("Checking prerequisites...")
    print("-" * 30)

    # Check if OpenAI API key is set
    openai_key = os.getenv('OPENAI_API_KEY')
    if openai_key:
        print("✓ OPENAI_API_KEY is set")
    else:
        print("✗ OPENAI_API_KEY not found in environment")
        print("  Please set your OpenAI API key in the .env file")
        return False

    # Check if we can import required modules
    try:
        from app.core.database import get_db
        print("✓ Database connection available")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

    try:
        from openai import OpenAI
        print("✓ OpenAI library available")
    except ImportError:
        print("✗ OpenAI library not found. Install with: pip install openai")
        return False

    return True


def main():
    """Main test function"""

    print("Enhanced Message Processor Test")
    print("=" * 60)
    print(f"Test started at: {datetime.now()}")
    print()

    # Check prerequisites
    if not check_prerequisites():
        print("\n❌ Prerequisites not met. Please fix the issues above.")
        return False

    print("\n✅ All prerequisites met!")

    # Run basic test
    print("\n" + "="*60)
    print("RUNNING BASIC FUNCTIONALITY TEST")
    print("="*60)

    success = test_processor_basic_functionality()

    if success:
        print("\n✅ Test completed successfully!")
    else:
        print("\n❌ Test failed!")

    # Show usage examples
    show_usage_examples()

    print("\n" + "="*60)
    print("IMPORTANT NOTES:")
    print("="*60)
    print("• Always run with --dry-run first to test without saving changes")
    print("• Use --limit to process a small number of messages initially")
    print("• Use --verbose for detailed logging")
    print("• Make sure your .env file has OPENAI_API_KEY set")
    print("• The script processes messages sequentially to avoid rate limits")
    print("• Each message goes through 3 LLM calls (theme → sub-theme → feature)")

    return success


if __name__ == "__main__":
    main()
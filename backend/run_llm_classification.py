#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.services.llm_message_classification_service import llm_message_classification_service

def run_classification():
    """Run LLM classification on all messages"""

    # Use the workspace ID with 70 messages (from find_workspace.py output)
    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    print("Starting LLM-based message classification...")
    print(f"Workspace ID: {workspace_id}")

    try:
        # Run the classification without limit to process all messages
        result = llm_message_classification_service.classify_messages_to_features(
            workspace_id=workspace_id,
            limit=None  # Process all messages
        )

        print("✅ LLM Classification completed!")
        print(f"Status: {result['status']}")
        print(f"Messages processed: {result.get('messages_processed', 0)}")
        print(f"Features created: {result.get('features_created', 0)}")
        print(f"Features updated: {result.get('features_updated', 0)}")

        if result.get('created_features'):
            print("\nCreated Features:")
            for feature in result['created_features']:
                print(f"  - {feature['name']} (ID: {feature['id']})")

        if result.get('updated_features'):
            print("\nUpdated Features:")
            for feature in result['updated_features']:
                print(f"  - {feature['name']} (ID: {feature['id']})")

    except Exception as e:
        print(f"❌ Error running LLM classification: {e}")
        raise

if __name__ == "__main__":
    run_classification()
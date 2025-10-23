#!/usr/bin/env python3
"""
Debug script to check feature creation details
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.message import Message
from app.models.feature import Feature


def check_features():
    """Check created features and their messages"""
    db = next(get_db())

    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    try:
        # Get all features for this workspace
        features = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).all()

        print(f"Total features: {len(features)}\n")

        for i, feature in enumerate(features, 1):
            print(f"Feature {i}: {feature.name}")
            print(f"  ID: {feature.id}")
            print(f"  Mentions: {feature.mention_count}")
            print(f"  Messages linked: {len(feature.messages)}")
            print(f"  Theme: {feature.theme_id}")
            print()

        # Get all messages
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id
        ).all()

        print(f"\nTotal messages: {len(messages)}\n")

        for i, message in enumerate(messages, 1):
            print(f"Message {i}: {message.content[:50]}...")
            print(f"  ID: {message.id}")
            print(f"  Source: {message.source}")
            print(f"  Features: {len(message.features)}")
            if message.features:
                for feat in message.features:
                    print(f"    - {feat.name}")
            print()

    finally:
        db.close()


if __name__ == "__main__":
    check_features()

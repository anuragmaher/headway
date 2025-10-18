#!/usr/bin/env python3
"""
Test classify-features directly with database
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.theme import Theme
from app.models.feature import Feature
from app.models.message import Message
from datetime import datetime
import asyncio

async def test_classify():
    """Test feature classification"""
    db = next(get_db())

    try:
        workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

        print("=" * 80)
        print("TESTING FEATURE CLASSIFICATION")
        print("=" * 80)

        # 1. Check/Create Unclassified theme
        print("\n1. Checking for Unclassified theme...")
        unclassified = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.is_default == True
        ).first()

        if unclassified:
            print(f"✅ Found Unclassified theme: {unclassified.id}")
        else:
            print("Creating Unclassified theme...")
            unclassified = Theme(
                workspace_id=workspace_id,
                name="Unclassified",
                description="Features that haven't been categorized yet",
                color="#9e9e9e",
                icon="HelpOutlineIcon",
                is_default=True,
                sort_order=9999
            )
            db.add(unclassified)
            db.commit()
            db.refresh(unclassified)
            print(f"✅ Created Unclassified theme: {unclassified.id}")

        # 2. Check existing themes
        print("\n2. Checking existing themes...")
        themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.is_default == False
        ).all()
        print(f"Found {len(themes)} themes (excluding Unclassified):")
        for theme in themes:
            print(f"   - {theme.name}: {theme.description}")

        # 3. Check messages with ai_insights
        print("\n3. Checking messages with AI insights...")
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.ai_insights.isnot(None)
        ).all()

        total_features = 0
        for msg in messages:
            if msg.ai_insights:
                features = msg.ai_insights.get('feature_requests', [])
                total_features += len(features)

        print(f"Found {len(messages)} messages with {total_features} total feature requests")

        # 4. Check existing features
        print("\n4. Checking existing features...")
        existing_features = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).all()
        print(f"Currently have {len(existing_features)} features in database")

        print("\n" + "=" * 80)
        print("Ready to classify features!")
        print("Call: POST /api/v1/way/classify-features?workspace_id=" + workspace_id)
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_classify())

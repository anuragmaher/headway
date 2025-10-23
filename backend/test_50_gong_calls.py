#!/usr/bin/env python3
"""
Test the fix with last 50 real Gong calls
"""
import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.workspace import Workspace
from app.scripts.ingest_gong_calls import ingest_gong_calls
from app.models.message import Message
from app.models.feature import Feature
import logging

# Enable logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_50_calls():
    """Test with 50 real Gong calls"""

    # Get database session
    db = next(get_db())

    try:
        # Find a workspace (use first active workspace)
        workspace = db.query(Workspace).filter(
            Workspace.is_active == True
        ).first()

        if not workspace:
            print("❌ No active workspace found")
            return

        workspace_id = str(workspace.id)
        print(f"✅ Using workspace: {workspace.name} ({workspace_id})")
        print(f"{'='*80}\n")

        # Count messages and features BEFORE
        messages_before = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).count()

        features_before = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()

        print(f"📊 Before ingestion:")
        print(f"   Gong Messages: {messages_before}")
        print(f"   Total Features: {features_before}")
        print(f"{'='*80}\n")

        # Ingest last 50 Gong calls
        print(f"🔄 Fetching and processing last 50 Gong calls...\n")
        ingested_count = await ingest_gong_calls(
            workspace_id=workspace_id,
            limit=50,
            days_back=30,
            fetch_transcripts=True,
            extract_features=True
        )

        print(f"\n{'='*80}")
        print(f"✅ Ingestion complete: {ingested_count} calls processed")
        print(f"{'='*80}\n")

        # Count messages and features AFTER
        messages_after = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).count()

        features_after = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()

        messages_added = messages_after - messages_before
        features_added = features_after - features_before

        print(f"📊 After ingestion:")
        print(f"   Gong Messages: {messages_after} ({messages_added} new)")
        print(f"   Total Features: {features_after} ({features_added} new)")
        print()

        # Check feature-message linking
        gong_messages = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).all()

        linked_count = sum(1 for msg in gong_messages if len(msg.features) > 0)
        unlinked_count = len(gong_messages) - linked_count

        print(f"🔗 Feature Linking:")
        print(f"   Messages with features: {linked_count}/{len(gong_messages)}")
        print(f"   Messages without features: {unlinked_count}/{len(gong_messages)}")
        print()

        # Show top features by mentions
        top_features = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).order_by(Feature.mention_count.desc()).limit(10).all()

        if top_features:
            print(f"📈 Top 10 Features by mention count:")
            for i, feat in enumerate(top_features, 1):
                theme_name = feat.theme.name if feat.theme else "No Theme"
                print(f"   {i}. {feat.name[:50]}")
                print(f"      Mentions: {feat.mention_count} | Theme: {theme_name}")
            print()

        # Statistics
        print(f"{'='*80}")
        print(f"📊 Summary:")
        print(f"   Success Rate: {linked_count}/{len(gong_messages)} messages linked to features")
        print(f"   Feature/Message Ratio: {features_after}/{messages_after}")
        if messages_added > 0:
            print(f"   New Features/New Messages: {features_added}/{messages_added}")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(test_50_calls())

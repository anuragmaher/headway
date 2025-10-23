#!/usr/bin/env python3
"""
Test with fresh Gong calls (last 5 new ones)
"""
import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables
load_dotenv()

# Add the backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.message import Message
from app.models.feature import Feature
from app.scripts.ingest_gong_calls import ingest_gong_calls
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_fresh():
    """Test with fresh Gong calls"""

    db = next(get_db())

    try:
        # Find workspace
        workspace = db.query(Workspace).filter(
            Workspace.name == "Test's Workspace"
        ).first()

        if not workspace:
            print("❌ Workspace not found")
            return

        workspace_id = str(workspace.id)
        print(f"Testing with workspace: {workspace.name}\n")

        # Clean old gong messages for this test
        print("🧹 Cleaning old Gong messages from database...")
        db.execute(text("""
            DELETE FROM feature_messages
            WHERE feature_id IN (
                SELECT id FROM features WHERE workspace_id = :workspace_id
            )
        """), {"workspace_id": workspace_id})

        deleted = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).delete()
        db.commit()
        print(f"   Deleted {deleted} messages\n")

        # Count before
        gong_before = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).count()

        feat_before = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()

        print(f"Before ingestion:")
        print(f"   Gong messages: {gong_before}")
        print(f"   Features: {feat_before}\n")

        # Ingest last 5 calls
        print(f"⏳ Processing last 5 Gong calls with AI feature extraction...")
        count = await ingest_gong_calls(
            workspace_id=workspace_id,
            limit=5,
            days_back=90,  # Get from last 90 days
            fetch_transcripts=True,
            extract_features=True
        )

        print(f"\nIngestion complete!\n")

        # Count after
        gong_after = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).count()

        feat_after = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()

        gong_added = gong_after - gong_before
        feat_added = feat_after - feat_before

        print(f"After ingestion:")
        print(f"   Gong messages: {gong_after} ({gong_added} new)")
        print(f"   Features: {feat_after} ({feat_added} new)\n")

        # Check linking
        recent_messages = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).order_by(Message.created_at.desc()).limit(gong_added).all()

        linked = sum(1 for m in recent_messages if len(m.features) > 0)

        print(f"✅ Results:")
        print(f"   Messages created: {gong_added}")
        print(f"   Features created: {feat_added}")
        print(f"   Messages linked to features: {linked}/{gong_added}")

        if gong_added > 0:
            if linked == gong_added:
                print(f"\n🎉 SUCCESS: All {gong_added} messages are linked to features!")
            elif linked > 0:
                print(f"\n⚠️  PARTIAL: {linked}/{gong_added} messages have features")
                print(f"\n   Messages with features:")
                for msg in recent_messages[:gong_added]:
                    if msg.features:
                        print(f"      ✅ {msg.external_id}: {len(msg.features)} feature(s)")
                    else:
                        print(f"      ❌ {msg.external_id}: NO features")
            else:
                print(f"\n❌ FAILED: No messages linked to features")
        else:
            print(f"\n⚠️  No new messages ingested (all were duplicates)")

    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 80)
    print("Fresh Gong Calls Test")
    print("=" * 80 + "\n")
    asyncio.run(test_fresh())

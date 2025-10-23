#!/usr/bin/env python3
"""
Quick verification that the fix works with Gong data
"""
import asyncio
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
from app.models.workspace import Workspace
from app.scripts.ingest_gong_calls import ingest_gong_calls
from app.models.message import Message
from app.models.feature import Feature
import logging

# Setup logging
logging.basicConfig(level=logging.WARNING)


async def quick_test():
    """Quick test with 5 Gong calls to verify fix"""

    db = next(get_db())

    try:
        # Find a workspace
        workspace = db.query(Workspace).filter(
            Workspace.is_active == True
        ).first()

        if not workspace:
            print("❌ No active workspace found")
            return

        workspace_id = str(workspace.id)
        print(f"Testing with workspace: {workspace.name}\n")

        # Count before
        gong_msg_before = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).count()

        feat_before = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()

        print(f"Before: {gong_msg_before} gong messages, {feat_before} features")

        # Ingest just 5 calls for quick verification
        print(f"\n⏳ Processing 5 Gong calls...")
        count = await ingest_gong_calls(
            workspace_id=workspace_id,
            limit=5,
            days_back=30,
            fetch_transcripts=True,
            extract_features=True
        )

        # Count after
        gong_msg_after = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).count()

        feat_after = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()

        msg_added = gong_msg_after - gong_msg_before
        feat_added = feat_after - feat_before

        print(f"\nAfter: {gong_msg_after} gong messages, {feat_after} features")
        print(f"Added: {msg_added} messages, {feat_added} features")

        # Check linking
        gong_messages = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == "gong"
        ).order_by(Message.created_at.desc()).limit(msg_added).all()

        linked = sum(1 for m in gong_messages if len(m.features) > 0)

        print(f"\n✅ Results:")
        print(f"   Messages created: {msg_added}")
        print(f"   Features created: {feat_added}")
        print(f"   Messages linked to features: {linked}/{msg_added}")

        if msg_added > 0 and linked == msg_added:
            print(f"\n✅ SUCCESS: All {msg_added} messages are linked to features!")
        elif msg_added > 0 and linked > 0:
            print(f"\n⚠️  PARTIAL: {linked}/{msg_added} messages linked")
        else:
            print(f"\n❌ FAILED: No messages linked to features")

    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 80)
    print("Quick Gong Verification Test")
    print("=" * 80 + "\n")
    asyncio.run(quick_test())

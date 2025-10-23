#!/usr/bin/env python3
"""
Debug script to test transcript ingestion with 5 sample calls
"""
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

from app.core.database import get_db, engine
from app.models.workspace import Workspace
from app.models.theme import Theme
from app.models.integration import Integration
from app.models.message import Message
from app.models.feature import Feature
from app.services.transcript_ingestion_service import get_transcript_ingestion_service
from sqlalchemy import text
import logging

# Enable verbose logging
logging.basicConfig(level=logging.INFO, format='%(name)s - %(levelname)s - %(message)s')


def setup_test_data(db):
    """Get or use existing test workspace"""

    # Use existing workspace from test
    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    # Get or create test integration
    integration = db.query(Integration).filter(
        Integration.workspace_id == workspace_id,
        Integration.provider == "test"
    ).first()

    if not integration:
        integration = Integration(
            workspace_id=workspace_id,
            name="Test Integration",
            provider="test",
            is_active=True
        )
        db.add(integration)
        db.commit()

    return workspace_id, integration.id


def test_5_calls():
    """Test 5 sample transcript calls"""
    db = next(get_db())

    # Sample transcripts
    sample_transcripts = [
        {
            "external_id": "call_001",
            "text": "Customer: We need better AI features. Agent: What specific AI capabilities do you need?",
            "title": "AI Enhancement Request"
        },
        {
            "external_id": "call_002",
            "text": "Customer: Can you integrate with Salesforce? Agent: We're working on Salesforce integration.",
            "title": "Salesforce Integration Request"
        },
        {
            "external_id": "call_003",
            "text": "Customer: We'd like AI-powered insights in our dashboard. Agent: That's a good idea.",
            "title": "AI Dashboard Insights"
        },
        {
            "external_id": "call_004",
            "text": "Customer: Better integration with our CRM would help us a lot. Agent: Noted.",
            "title": "CRM Integration Improvement"
        },
        {
            "external_id": "call_005",
            "text": "Customer: Can you provide more detailed analytics reports? Agent: We're enhancing our reporting.",
            "title": "Analytics Enhancement"
        }
    ]

    try:
        # Setup
        workspace_id, integration_id = setup_test_data(db)
        print(f"✅ Setup complete. Workspace: {workspace_id}")
        print(f"{'='*80}\n")

        # Initialize transcript service
        transcript_service = get_transcript_ingestion_service(db)

        # Test 5 calls
        for i, transcript in enumerate(sample_transcripts, 1):
            print(f"📞 Call {i}: {transcript['title']}")

            try:
                message_id = transcript_service.ingest_transcript(
                    workspace_id=workspace_id,
                    external_id=transcript["external_id"],
                    transcript_text=transcript["text"],
                    source="test",
                    metadata={"title": transcript["title"]},
                    channel_name="Test Channel",
                    channel_id="test_channel",
                    author_name=f"Test User {i}",
                    author_email=f"test{i}@example.com",
                    sent_at=datetime.now(timezone.utc),
                    integration_id=integration_id,
                    extract_features=True
                )

                if message_id:
                    print(f"   ✅ Success: Message ID {message_id}")

                    # Check message features
                    message_obj = db.query(Message).filter(
                        Message.id == message_id
                    ).first()

                    if message_obj:
                        print(f"   🔗 Features linked: {len(message_obj.features)}")
                        for feat in message_obj.features:
                            print(f"      - {feat.name}")

                    # Check total features
                    total_features = db.query(Feature).filter(
                        Feature.workspace_id == workspace_id
                    ).count()
                    print(f"   📊 Total features: {total_features}")
                else:
                    print(f"   ⚠️  Skipped (already exists)")

            except Exception as e:
                print(f"   ❌ Error: {e}")
                import traceback
                traceback.print_exc()
                db.rollback()

            print()

        # Summary
        print(f"{'='*80}")
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id
        ).count()
        features = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).count()
        print(f"✅ Final count: {messages} messages, {features} features")

    finally:
        db.close()


if __name__ == "__main__":
    test_5_calls()

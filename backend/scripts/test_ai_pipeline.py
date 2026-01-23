#!/usr/bin/env python
"""
AI Pipeline Test Script

This script helps you test the state-driven AI pipeline by:
1. Running individual pipeline stages manually
2. Monitoring pipeline state in the database
3. Simulating test data if needed

Usage:
    # From backend directory:
    python scripts/test_ai_pipeline.py --action status
    python scripts/test_ai_pipeline.py --action run-stage --stage scoring
    python scripts/test_ai_pipeline.py --action run-all
    python scripts/test_ai_pipeline.py --action create-test-data --count 5
"""

import argparse
import sys
import os
from datetime import datetime, timezone
from uuid import UUID

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.core.database import engine
from app.models.normalized_event import NormalizedEvent, EventChunk
from app.models.extracted_fact import ExtractedFact
from app.models.feature import Feature


def get_pipeline_status(db: Session) -> dict:
    """Get current state of all pipeline stages."""

    # NormalizedEvent stage counts
    event_stages = db.query(
        NormalizedEvent.processing_stage,
        func.count(NormalizedEvent.id)
    ).group_by(NormalizedEvent.processing_stage).all()

    # Locked events count
    locked_events = db.query(func.count(NormalizedEvent.id)).filter(
        NormalizedEvent.lock_token.isnot(None)
    ).scalar()

    # EventChunk stage counts
    chunk_stages = db.query(
        EventChunk.processing_stage,
        func.count(EventChunk.id)
    ).group_by(EventChunk.processing_stage).all()

    # Locked chunks count
    locked_chunks = db.query(func.count(EventChunk.id)).filter(
        EventChunk.lock_token.isnot(None)
    ).scalar()

    # ExtractedFact aggregation status counts
    fact_statuses = db.query(
        ExtractedFact.aggregation_status,
        func.count(ExtractedFact.id)
    ).group_by(ExtractedFact.aggregation_status).all()

    # Feature counts
    feature_count = db.query(func.count(Feature.id)).scalar()

    # Recent processing timestamps
    recent_scored = db.query(func.max(NormalizedEvent.scored_at)).scalar()
    recent_chunked = db.query(func.max(NormalizedEvent.chunked_at)).scalar()
    recent_classified = db.query(func.max(NormalizedEvent.classified_at)).scalar()
    recent_extracted = db.query(func.max(NormalizedEvent.extracted_at)).scalar()

    return {
        "normalized_events": {
            "by_stage": dict(event_stages),
            "locked": locked_events,
            "recent_scored_at": recent_scored,
            "recent_chunked_at": recent_chunked,
            "recent_classified_at": recent_classified,
            "recent_extracted_at": recent_extracted,
        },
        "event_chunks": {
            "by_stage": dict(chunk_stages),
            "locked": locked_chunks,
        },
        "extracted_facts": {
            "by_status": dict(fact_statuses),
        },
        "features": {
            "total": feature_count,
        },
    }


def print_status(status: dict):
    """Pretty print pipeline status."""
    print("\n" + "=" * 60)
    print("AI PIPELINE STATUS")
    print("=" * 60)

    print("\n📋 NORMALIZED EVENTS:")
    for stage, count in status["normalized_events"]["by_stage"].items():
        print(f"   {stage}: {count}")
    print(f"   🔒 Currently locked: {status['normalized_events']['locked']}")

    print("\n   Recent timestamps:")
    if status["normalized_events"]["recent_scored_at"]:
        print(f"   - Last scored: {status['normalized_events']['recent_scored_at']}")
    if status["normalized_events"]["recent_chunked_at"]:
        print(f"   - Last chunked: {status['normalized_events']['recent_chunked_at']}")
    if status["normalized_events"]["recent_classified_at"]:
        print(f"   - Last classified: {status['normalized_events']['recent_classified_at']}")
    if status["normalized_events"]["recent_extracted_at"]:
        print(f"   - Last extracted: {status['normalized_events']['recent_extracted_at']}")

    print("\n📦 EVENT CHUNKS:")
    for stage, count in status["event_chunks"]["by_stage"].items():
        print(f"   {stage}: {count}")
    print(f"   🔒 Currently locked: {status['event_chunks']['locked']}")

    print("\n📝 EXTRACTED FACTS:")
    for status_name, count in status["extracted_facts"]["by_status"].items():
        print(f"   {status_name}: {count}")

    print("\n✨ FEATURES:")
    print(f"   Total: {status['features']['total']}")

    print("\n" + "=" * 60)


def run_pipeline_stage(stage: str):
    """Run a specific pipeline stage manually."""
    from app.sync_engine.tasks.ai_pipeline.normalization import normalize_source_data
    from app.sync_engine.tasks.ai_pipeline.chunking import chunk_normalized_events
    from app.sync_engine.tasks.ai_pipeline.tier1_classification import classify_events
    from app.sync_engine.tasks.ai_pipeline.tier2_extraction import extract_features
    from app.sync_engine.tasks.ai_pipeline.tier3_aggregation import aggregate_facts

    stages = {
        "normalization": normalize_source_data,
        "chunking": chunk_normalized_events,
        "classification": classify_events,
        "extraction": extract_features,
        "aggregation": aggregate_facts,
    }

    if stage not in stages:
        print(f"Unknown stage: {stage}")
        print(f"Available stages: {', '.join(stages.keys())}")
        return

    print(f"\n🚀 Running {stage} stage...")

    # Run the task synchronously (not via Celery)
    task_func = stages[stage]
    result = task_func()

    print(f"\n✅ Result: {result}")


def run_all_stages():
    """Run all pipeline stages in sequence."""
    stages = [
        "normalization",
        "chunking",
        "classification",
        "extraction",
        "aggregation",
    ]

    for stage in stages:
        run_pipeline_stage(stage)
        print()


def create_test_data(count: int, workspace_id: str = None):
    """Create test NormalizedEvents for pipeline testing."""
    import uuid

    with Session(engine) as db:
        # Get a workspace ID if not provided
        if not workspace_id:
            from app.models.workspace import Workspace
            workspace = db.query(Workspace).first()
            if not workspace:
                print("❌ No workspace found. Please create a workspace first.")
                return
            workspace_id = workspace.id
        else:
            workspace_id = UUID(workspace_id)

        print(f"\n📝 Creating {count} test NormalizedEvents for workspace {workspace_id}...")

        test_texts = [
            "We really need a way to export data to CSV. Our team has been asking for this feature for months. It would help with our reporting workflow.",
            "The dashboard is loading very slowly. Can you please optimize the performance? It takes about 10 seconds to load.",
            "It would be great if we could integrate with Salesforce. This would help our sales team track customer interactions better.",
            "Bug report: The login page shows an error sometimes when using Safari browser. Steps to reproduce: open Safari, go to login page, wait 5 seconds.",
            "Feature request: Add dark mode support. Many users work late at night and the bright interface strains their eyes.",
            "Can we have a mobile app? I often need to check things while away from my desk.",
            "The notification system is too noisy. We need better controls for what notifications we receive.",
            "Would love to see AI-powered suggestions for task prioritization based on deadlines and importance.",
            "Please add support for SSO with Okta. Our IT team requires this for security compliance.",
            "The search functionality could be improved. It doesn't find results when I search for partial words.",
        ]

        created = 0
        for i in range(count):
            text = test_texts[i % len(test_texts)]

            event = NormalizedEvent(
                workspace_id=workspace_id,
                source_type="test",
                source_id=f"test-{uuid.uuid4().hex[:8]}",
                source_table="test_data",
                source_record_id=uuid.uuid4(),
                clean_text=text,
                text_length=len(text),
                actor_name=f"Test User {i + 1}",
                actor_email=f"testuser{i + 1}@example.com",
                actor_role="external",
                title=f"Test Event {i + 1}",
                event_timestamp=datetime.now(timezone.utc),
                processing_stage="pending",
            )
            db.add(event)
            created += 1

        db.commit()
        print(f"✅ Created {created} test NormalizedEvents")


def reset_stuck_locks():
    """Reset any stuck locks (useful for debugging)."""
    with Session(engine) as db:
        # Reset NormalizedEvent locks
        event_count = db.query(NormalizedEvent).filter(
            NormalizedEvent.lock_token.isnot(None)
        ).update(
            {NormalizedEvent.lock_token: None, NormalizedEvent.locked_at: None},
            synchronize_session=False
        )

        # Reset EventChunk locks
        chunk_count = db.query(EventChunk).filter(
            EventChunk.lock_token.isnot(None)
        ).update(
            {EventChunk.lock_token: None, EventChunk.locked_at: None},
            synchronize_session=False
        )

        db.commit()

        print(f"\n🔓 Reset locks:")
        print(f"   - NormalizedEvents: {event_count}")
        print(f"   - EventChunks: {chunk_count}")


def main():
    parser = argparse.ArgumentParser(description="Test AI Pipeline")
    parser.add_argument(
        "--action",
        choices=["status", "run-stage", "run-all", "create-test-data", "reset-locks"],
        required=True,
        help="Action to perform"
    )
    parser.add_argument(
        "--stage",
        choices=["normalization", "chunking", "classification", "extraction", "aggregation"],
        help="Pipeline stage to run (for run-stage action)"
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of test records to create (for create-test-data action)"
    )
    parser.add_argument(
        "--workspace-id",
        type=str,
        help="Workspace ID for test data"
    )

    args = parser.parse_args()

    if args.action == "status":
        with Session(engine) as db:
            status = get_pipeline_status(db)
            print_status(status)

    elif args.action == "run-stage":
        if not args.stage:
            print("❌ --stage is required for run-stage action")
            sys.exit(1)
        run_pipeline_stage(args.stage)

    elif args.action == "run-all":
        run_all_stages()

    elif args.action == "create-test-data":
        create_test_data(args.count, args.workspace_id)

    elif args.action == "reset-locks":
        reset_stuck_locks()


if __name__ == "__main__":
    main()

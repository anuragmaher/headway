#!/usr/bin/env python
"""
Run AI Pipeline for Specific User

This script runs the complete AI pipeline for a specific user's messages.
It finds unprocessed messages from Fathom/Gong, resets their processing flags,
and runs all pipeline stages systematically.

Prerequisites:
    - Activate virtual environment: source venv/bin/activate
    - Install dependencies: pip install -r requirements.txt

Usage:
    # From backend directory (with venv activated):
    python scripts/run_pipeline_for_user.py --email anurag@grexit.com --limit 5 --yes
    python scripts/run_pipeline_for_user.py --email anurag@grexit.com --limit 5 --sources fathom gong --yes
    python scripts/run_pipeline_for_user.py --workspace-id <uuid> --limit 5 --yes
"""

import argparse
import sys
import os
from typing import List, Optional
from uuid import UUID

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import engine
from app.models.user import User
from app.models.message import Message
from app.models.normalized_event import NormalizedEvent
from app.models.workspace import Workspace


def find_workspace_by_email(db: Session, email: str) -> Optional[UUID]:
    """Find workspace_id for a user by email."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"❌ User not found: {email}")
        return None
    
    if not user.workspace_id:
        print(f"❌ User {email} has no workspace_id")
        return None
    
    print(f"✅ Found user: {email}")
    print(f"   Workspace ID: {user.workspace_id}")
    return user.workspace_id


def find_unprocessed_messages(
    db: Session,
    workspace_id: UUID,
    sources: List[str],
    limit: int = 5
) -> List[Message]:
    """Find unprocessed messages from specified sources."""
    query = db.query(Message).filter(
        and_(
            Message.workspace_id == workspace_id,
            Message.tier1_processed == False,  # Not yet processed
        )
    )
    
    # Filter by source types
    if sources:
        query = query.filter(Message.source.in_(sources))
    
    messages = query.order_by(Message.sent_at.desc()).limit(limit).all()
    return messages


def reset_message_processing_flags(db: Session, message_ids: List[UUID]):
    """Reset processing flags for messages to allow re-processing."""
    count = db.query(Message).filter(
        Message.id.in_(message_ids)
    ).update(
        {
            Message.tier1_processed: False,
            Message.tier2_processed: False,
            Message.feature_score: None,
            Message.processed_at: None,
        },
        synchronize_session=False
    )
    db.commit()
    return count


def delete_existing_normalized_events(db: Session, message_ids: List[UUID]):
    """Delete existing NormalizedEvents for these messages to start fresh."""
    # Find NormalizedEvents linked to these messages
    events = db.query(NormalizedEvent).filter(
        and_(
            NormalizedEvent.source_table == "messages",
            NormalizedEvent.source_record_id.in_(message_ids)
        )
    ).all()
    
    event_ids = [e.id for e in events]
    if event_ids:
        # Delete EventChunks first (foreign key constraint)
        from app.models.normalized_event import EventChunk
        db.query(EventChunk).filter(
            EventChunk.normalized_event_id.in_(event_ids)
        ).delete(synchronize_session=False)
        
        # Delete NormalizedEvents
        count = db.query(NormalizedEvent).filter(
            NormalizedEvent.id.in_(event_ids)
        ).delete(synchronize_session=False)
        db.commit()
        return count
    return 0


def run_pipeline_stage_sync(stage_name: str, workspace_id: Optional[UUID] = None):
    """Run a pipeline stage synchronously by calling the task function directly."""
    from app.sync_engine.tasks.ai_pipeline.normalization import normalize_source_data
    from app.sync_engine.tasks.ai_pipeline.chunking import chunk_normalized_events
    from app.sync_engine.tasks.ai_pipeline.tier1_classification import classify_events
    from app.sync_engine.tasks.ai_pipeline.tier2_extraction import extract_features
    from app.sync_engine.tasks.ai_insights.worker import process_pending_insights
    
    stages = {
        "normalization": normalize_source_data,
        "chunking": chunk_normalized_events,
        "classification": classify_events,
        "extraction": extract_features,
        "insights": process_pending_insights,
    }
    
    if stage_name not in stages:
        print(f"❌ Unknown stage: {stage_name}")
        return None
    
    print(f"\n🚀 Running {stage_name} stage...")
    
    task_func = stages[stage_name]
    
    # Create a mock task object for Celery tasks with bind=True
    # The tasks expect 'self' as first parameter
    class MockTask:
        def retry(self, exc=None, countdown=60):
            # In sync mode, we don't retry - just re-raise the exception
            if exc:
                raise exc
            raise Exception("Retry called")
    
    mock_task = MockTask()
    
    try:
        # Use Celery's .apply() method to run the task synchronously
        # For bound tasks (bind=True), self is automatically provided
        # Pass workspace_id as a keyword argument
        if workspace_id:
            result = task_func.apply(kwargs={"workspace_id": str(workspace_id)})
        else:
            result = task_func.apply()
        
        # Get the result value from AsyncResult
        result_value = result.get() if hasattr(result, 'get') else result
        
        print(f"✅ {stage_name} complete: {result_value}")
        return result_value
    except Exception as e:
        print(f"❌ {stage_name} failed: {e}")
        import traceback
        traceback.print_exc()
        return None


def run_full_pipeline(
    workspace_id: UUID,
    message_ids: List[UUID],
    sources: List[str]
):
    """Run the complete pipeline for selected messages."""
    print("\n" + "=" * 60)
    print("RUNNING AI PIPELINE")
    print("=" * 60)
    print(f"Workspace ID: {workspace_id}")
    print(f"Messages: {len(message_ids)}")
    print(f"Sources: {', '.join(sources)}")
    print("=" * 60)
    
    stages = [
        ("normalization", "Normalizing messages into events"),
        ("chunking", "Chunking long messages"),
        ("classification", "Tier-1: Classifying feature relevance"),
        ("extraction", "Tier-2: Extracting features and themes"),
        ("insights", "Generating AI insights"),
    ]
    
    for stage_name, description in stages:
        print(f"\n📋 {description}...")
        result = run_pipeline_stage_sync(stage_name, workspace_id)
        
        if result and result.get("status") == "error":
            print(f"⚠️  Stage {stage_name} returned error, but continuing...")
        
        # Small delay between stages
        import time
        time.sleep(1)
    
    print("\n" + "=" * 60)
    print("✅ PIPELINE COMPLETE")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Run AI Pipeline for Specific User",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run for user by email (5 messages from Fathom/Gong)
  python scripts/run_pipeline_for_user.py --email anurag@grexit.com --limit 5

  # Run for specific sources only
  python scripts/run_pipeline_for_user.py --email anurag@grexit.com --limit 5 --sources fathom gong

  # Run for workspace directly
  python scripts/run_pipeline_for_user.py --workspace-id <uuid> --limit 5
        """
    )
    
    parser.add_argument(
        "--email",
        type=str,
        help="User email to find workspace"
    )
    parser.add_argument(
        "--workspace-id",
        type=str,
        help="Workspace ID directly (skips email lookup)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of messages to process (default: 5)"
    )
    parser.add_argument(
        "--sources",
        nargs="+",
        choices=["fathom", "gong", "slack", "gmail"],
        default=["fathom", "gong"],
        help="Source types to include (default: fathom gong)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without actually running"
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompt and run automatically"
    )
    
    args = parser.parse_args()
    
    if not args.email and not args.workspace_id:
        print("❌ Either --email or --workspace-id is required")
        sys.exit(1)
    
    with Session(engine) as db:
        # Find workspace
        if args.workspace_id:
            workspace_id = UUID(args.workspace_id)
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                print(f"❌ Workspace not found: {args.workspace_id}")
                sys.exit(1)
            print(f"✅ Using workspace: {workspace.name} ({workspace_id})")
        else:
            workspace_id = find_workspace_by_email(db, args.email)
            if not workspace_id:
                sys.exit(1)
        
        # Find unprocessed messages
        print(f"\n🔍 Finding {args.limit} unprocessed messages from {', '.join(args.sources)}...")
        messages = find_unprocessed_messages(
            db=db,
            workspace_id=workspace_id,
            sources=args.sources,
            limit=args.limit
        )
        
        if not messages:
            print(f"❌ No unprocessed messages found for workspace {workspace_id}")
            print("   Try checking if messages exist and are already processed:")
            print(f"   - tier1_processed = False")
            print(f"   - source in {args.sources}")
            sys.exit(1)
        
        print(f"✅ Found {len(messages)} messages:")
        for i, msg in enumerate(messages, 1):
            print(f"   {i}. {msg.source} - {msg.title or msg.content[:50]}...")
            print(f"      ID: {msg.id}")
            print(f"      Sent: {msg.sent_at}")
            print(f"      Author: {msg.author_name or msg.author_email}")
        
        if args.dry_run:
            print("\n🔍 DRY RUN - Would process these messages")
            print("   Run without --dry-run to execute pipeline")
            return
        
        # Confirm (unless --yes flag is set)
        if not args.yes:
            print(f"\n⚠️  About to process {len(messages)} messages through the AI pipeline")
            response = input("Continue? (yes/no): ")
            if response.lower() not in ["yes", "y"]:
                print("Cancelled")
                return
        else:
            print(f"\n🚀 Processing {len(messages)} messages through the AI pipeline (--yes flag set)")
        
        # Reset processing flags
        message_ids = [msg.id for msg in messages]
        print(f"\n🔄 Resetting processing flags for {len(message_ids)} messages...")
        reset_count = reset_message_processing_flags(db, message_ids)
        print(f"✅ Reset {reset_count} messages")
        
        # Delete existing NormalizedEvents (start fresh)
        print(f"\n🗑️  Deleting existing NormalizedEvents for these messages...")
        deleted_count = delete_existing_normalized_events(db, message_ids)
        print(f"✅ Deleted {deleted_count} existing events")
        
        # Run pipeline
        run_full_pipeline(workspace_id, message_ids, args.sources)
        
        # Show results
        print("\n📊 Checking results...")
        with Session(engine) as result_db:
            processed = result_db.query(Message).filter(
                Message.id.in_(message_ids),
                Message.tier2_processed == True
            ).count()
            
            print(f"✅ Successfully processed: {processed}/{len(message_ids)} messages")
            
            # Show created CustomerAsks
            from app.models.customer_ask import CustomerAsk
            from app.models.message_customer_ask import MessageCustomerAsk
            
            linked_asks = result_db.query(CustomerAsk).join(
                MessageCustomerAsk
            ).filter(
                MessageCustomerAsk.message_id.in_(message_ids)
            ).distinct().all()
            
            if linked_asks:
                print(f"\n📝 Created/Matched {len(linked_asks)} CustomerAsks:")
                for ask in linked_asks[:10]:  # Show first 10
                    print(f"   - {ask.name} (mentions: {ask.mention_count})")


if __name__ == "__main__":
    main()

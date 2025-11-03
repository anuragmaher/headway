"""
One-time script to delete orphaned messages (messages with no customer_id).
These are typically internal meetings that were incorrectly created.
"""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.message import Message

def delete_orphaned_messages(workspace_id: str = None, dry_run: bool = True):
    """
    Delete orphaned messages (messages with customer_id = NULL).

    Args:
        workspace_id: Specific workspace to clean (if None, cleans all workspaces)
        dry_run: If True, only shows what would be done without making changes
    """
    db: Session = SessionLocal()

    try:
        # Build query for orphaned messages
        query = db.query(Message).filter(Message.customer_id.is_(None))

        if workspace_id:
            query = query.filter(Message.workspace_id == workspace_id)

        orphaned_messages = query.all()

        if not orphaned_messages:
            print("✅ No orphaned messages found - all good!")
            return

        print(f"\n{'='*80}")
        print(f"Found {len(orphaned_messages)} orphaned message(s) to delete")
        print(f"{'='*80}\n")

        for message in orphaned_messages:
            title = message.title or message.id
            source = message.source or "unknown"
            if dry_run:
                print(f"[DRY RUN] Would delete message: {title} (source: {source})")
            else:
                db.delete(message)
                print(f"🗑️  Deleted message: {title} (source: {source})")

        # Commit changes if not dry run
        if not dry_run:
            db.commit()
            print(f"\n{'='*80}")
            print("✅ Changes committed to database")
        else:
            print(f"\n{'='*80}")
            print("ℹ️  DRY RUN - No changes were made")

        print(f"{'='*80}")
        print(f"\n📊 SUMMARY:")
        print(f"   Orphaned messages deleted: {len(orphaned_messages)}")
        print()

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Delete orphaned messages with no customer_id')
    parser.add_argument('--workspace-id', type=str, help='Specific workspace ID to clean')
    parser.add_argument('--execute', action='store_true', help='Actually execute changes (default is dry-run)')

    args = parser.parse_args()

    dry_run = not args.execute

    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made")
        print("    Use --execute flag to apply changes\n")
    else:
        print("\n⚠️  EXECUTION MODE - Changes will be applied!\n")

    delete_orphaned_messages(
        workspace_id=args.workspace_id,
        dry_run=dry_run
    )

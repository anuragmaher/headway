"""
Clean messages and customers from the database

Usage:
    python3 -m app.scripts.clean_messages_and_customers --workspace-id <workspace_id>
    python3 -m app.scripts.clean_messages_and_customers --workspace-id <workspace_id> --dry-run
"""

import sys
from pathlib import Path
import argparse
import logging

# Add the backend directory to Python path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.customer import Customer
from app.models.message import Message
from app.models.feature import Feature
from sqlalchemy import func, text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def clean_messages_and_customers(workspace_id: str = None, dry_run: bool = False):
    """
    Delete all messages and customers from the database

    Args:
        workspace_id: If provided, only delete for this workspace. Otherwise delete all.
        dry_run: If True, just count what would be deleted
    """
    db = SessionLocal()
    try:
        # Count customers
        customer_query = db.query(Customer)
        if workspace_id:
            customer_query = customer_query.filter(Customer.workspace_id == workspace_id)
        customer_count = customer_query.count()

        # Count messages (either by workspace through customer relationship or all)
        if workspace_id:
            message_count = db.query(Message).join(Customer).filter(
                Customer.workspace_id == workspace_id
            ).count()
        else:
            message_count = db.query(Message).count()

        logger.info("=" * 60)
        logger.info(f"🔍 Found:")
        logger.info(f"   Customers: {customer_count}")
        logger.info(f"   Messages: {message_count}")
        if workspace_id:
            logger.info(f"   Workspace: {workspace_id}")
        else:
            logger.info(f"   Scope: ALL WORKSPACES")
        logger.info("=" * 60)

        if customer_count == 0 and message_count == 0:
            logger.info("✅ Nothing to delete")
            return

        if dry_run:
            logger.info("🏃 DRY RUN - No data will be deleted")
            return

        # Step 1: Delete feature_messages associations (many-to-many table)
        logger.info(f"🗑️  Step 1: Deleting feature_messages associations...")
        if workspace_id:
            # Delete feature_messages where message is from a customer in this workspace
            result = db.execute(
                text("""
                    DELETE FROM feature_messages
                    WHERE message_id IN (
                        SELECT m.id FROM messages m
                        JOIN customers c ON m.customer_id = c.id
                        WHERE c.workspace_id = :workspace_id
                    )
                """),
                {"workspace_id": workspace_id}
            )
            deleted_associations = result.rowcount
        else:
            result = db.execute(text("DELETE FROM feature_messages"))
            deleted_associations = result.rowcount

        logger.info(f"✅ Deleted {deleted_associations} feature_messages associations")

        # Step 2: Delete messages
        logger.info(f"🗑️  Step 2: Deleting {message_count} messages...")
        if workspace_id:
            deleted_messages = db.query(Message).filter(
                Message.customer_id.in_(
                    db.query(Customer.id).filter(Customer.workspace_id == workspace_id)
                )
            ).delete(synchronize_session=False)
        else:
            deleted_messages = db.query(Message).delete()

        logger.info(f"✅ Deleted {deleted_messages} messages")

        # Step 3: Delete customers
        logger.info(f"🗑️  Step 3: Deleting {customer_count} customers...")
        if workspace_id:
            deleted_customers = db.query(Customer).filter(
                Customer.workspace_id == workspace_id
            ).delete()
        else:
            deleted_customers = db.query(Customer).delete()

        db.commit()

        logger.info(f"✅ Deleted {deleted_customers} customers")

        # Step 4: Clean up any remaining orphaned records
        logger.info(f"🗑️  Step 4: Cleaning orphaned records...")

        # Delete feature_messages for orphaned messages
        result = db.execute(text("""
            DELETE FROM feature_messages
            WHERE message_id NOT IN (SELECT id FROM messages)
        """))
        orphaned_fm = result.rowcount
        if orphaned_fm > 0:
            logger.info(f"✅ Deleted {orphaned_fm} orphaned feature_messages")

        # Delete orphaned messages (no customer)
        result = db.execute(text("""
            DELETE FROM messages
            WHERE customer_id IS NULL OR customer_id NOT IN (SELECT id FROM customers)
        """))
        orphaned_msg = result.rowcount
        if orphaned_msg > 0:
            logger.info(f"✅ Deleted {orphaned_msg} orphaned messages")

        # Step 5: Reset mention counts on features
        logger.info(f"🔄  Step 5: Resetting feature mention counts...")
        if workspace_id:
            result = db.execute(text("""
                UPDATE features
                SET mention_count = 0
                WHERE id NOT IN (SELECT DISTINCT feature_id FROM feature_messages)
                AND workspace_id = :workspace_id
            """), {"workspace_id": workspace_id})
        else:
            result = db.execute(text("""
                UPDATE features
                SET mention_count = 0
                WHERE id NOT IN (SELECT DISTINCT feature_id FROM feature_messages)
            """))
        reset_count = result.rowcount
        if reset_count > 0:
            logger.info(f"✅ Reset mention_count for {reset_count} features")

        db.commit()

        logger.info("=" * 60)
        logger.info("✅ Cleanup complete!")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"❌ Error during cleanup: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Clean messages and customers')
    parser.add_argument('--workspace-id', help='Workspace ID (optional, deletes all if not specified)')
    parser.add_argument('--dry-run', action='store_true', help='Just count what would be deleted')

    args = parser.parse_args()

    if not args.workspace_id and not args.dry_run:
        logger.warning("⚠️  WARNING: No workspace specified - this will delete ALL customers and messages!")
        response = input("Are you sure? Type 'yes' to confirm: ")
        if response.lower() != 'yes':
            logger.info("❌ Cancelled")
            sys.exit(0)

    logger.info("🚀 Starting cleanup...")
    clean_messages_and_customers(args.workspace_id, args.dry_run)
    logger.info("✅ Done!")

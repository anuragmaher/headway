#!/usr/bin/env python3
"""
One-time script to clear all customers from the database

Usage:
    python3 -m app.scripts.clear_customers
    python3 -m app.scripts.clear_customers --workspace-id <uuid>
    python3 -m app.scripts.clear_customers --confirm
"""

import argparse
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.customer import Customer
from app.models.workspace import Workspace
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def clear_customers(workspace_id: str = None, confirm: bool = False) -> bool:
    """
    Clear all customers from the database or from a specific workspace.

    Args:
        workspace_id: Optional workspace UUID. If provided, only clear customers from that workspace
        confirm: If True, skip confirmation prompt

    Returns:
        True if successful, False otherwise
    """
    try:
        db = next(get_db())

        # Count customers
        if workspace_id:
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                print(f"❌ Workspace {workspace_id} not found")
                return False

            customer_count = db.query(Customer).filter(Customer.workspace_id == workspace_id).count()
            print(f"\n📊 Found {customer_count} customers in workspace '{workspace.name}'")
        else:
            customer_count = db.query(Customer).count()
            print(f"\n📊 Found {customer_count} total customers across all workspaces")

        if customer_count == 0:
            print("✓ No customers to delete")
            return True

        # Confirmation
        if not confirm:
            print("\n" + "=" * 70)
            print("⚠️  WARNING: This will permanently delete:")
            print(f"  - {customer_count} customers")
            if workspace_id:
                print(f"  - From workspace: {workspace.name}")
            else:
                print(f"  - From ALL workspaces")
            print("=" * 70)

            user_input = input("\nAre you sure you want to continue? Type 'yes' to confirm: ").strip().lower()
            if user_input != "yes":
                print("❌ Cancelled by user")
                return False

        # Delete in batches
        BATCH_SIZE = 20
        deleted_count = 0

        while True:
            # Get a batch
            if workspace_id:
                batch = db.query(Customer).filter(Customer.workspace_id == workspace_id).limit(BATCH_SIZE).all()
            else:
                batch = db.query(Customer).limit(BATCH_SIZE).all()

            if not batch:
                break

            batch_count = len(batch)
            for customer in batch:
                db.delete(customer)

            db.commit()
            deleted_count += batch_count
            print(f"🗑️  Deleted batch of {batch_count} customers (total: {deleted_count}/{customer_count})")

        print(f"\n✅ Successfully deleted {deleted_count} customers!")
        db.close()
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(description="Clear customers from database")
    parser.add_argument("--workspace-id", help="Optional: Only clear customers from this workspace")
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation prompt")

    args = parser.parse_args()

    try:
        success = clear_customers(
            workspace_id=args.workspace_id,
            confirm=args.confirm
        )
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Interrupted by user")
        sys.exit(1)


if __name__ == "__main__":
    main()

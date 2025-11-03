"""
One-time script to retrospectively fix internal customers (like Hiverhq, Grexit)
that were incorrectly created as customers.

This script will:
1. Find all customers whose domains match workspace company_domains
2. For each internal customer's messages, try to re-map to the correct external customer
3. Delete messages with no external customer (internal meetings)
4. Delete the internal customer records
"""
import sys
import os
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.core.database import SessionLocal
from app.models.workspace import Workspace
from app.models.customer import Customer
from app.models.message import Message

def extract_domain_from_email(email: str) -> str:
    """Extract domain from email address"""
    if not email or '@' not in email:
        return None
    return email.split('@')[1].lower()

def find_or_suggest_correct_customer(db: Session, message: Message, workspace_id: str, internal_domains: list) -> Customer:
    """
    Try to find the correct external customer for a message.

    Logic:
    1. Look at message metadata for external participants
    2. Check author_email if available
    3. Return the first external customer found, or None
    """
    # Check message metadata for parties/invitees
    if message.message_metadata:
        # Gong call - check parties
        if 'parties' in message.message_metadata:
            parties = message.message_metadata.get('parties', [])
            for party in parties:
                if party.get('affiliation') == 'External':
                    email = party.get('emailAddress')
                    if email:
                        domain = extract_domain_from_email(email)
                        if domain and domain not in internal_domains:
                            # Find or note this customer
                            customer = db.query(Customer).filter(
                                and_(
                                    Customer.workspace_id == workspace_id,
                                    Customer.domain == domain
                                )
                            ).first()
                            return customer

        # Fathom session - check calendar_invitees
        if 'calendar_invitees' in message.message_metadata:
            invitees = message.message_metadata.get('calendar_invitees', [])
            for invitee in invitees:
                if invitee.get('is_external'):
                    email = invitee.get('email')
                    domain = invitee.get('email_domain')
                    if domain and domain not in internal_domains:
                        # Find or note this customer
                        customer = db.query(Customer).filter(
                            and_(
                                Customer.workspace_id == workspace_id,
                                Customer.domain == domain.lower()
                            )
                        ).first()
                        return customer

    # Check author_email as fallback
    if message.author_email:
        domain = extract_domain_from_email(message.author_email)
        if domain and domain not in internal_domains:
            customer = db.query(Customer).filter(
                and_(
                    Customer.workspace_id == workspace_id,
                    Customer.domain == domain
                )
            ).first()
            return customer

    return None

def fix_internal_customers(workspace_id: str = None, dry_run: bool = True):
    """
    Fix internal customers that were incorrectly created.

    Args:
        workspace_id: Specific workspace to fix (if None, fixes all workspaces)
        dry_run: If True, only shows what would be done without making changes
    """
    db: Session = SessionLocal()

    try:
        # Get workspaces to process
        if workspace_id:
            workspaces = db.query(Workspace).filter(Workspace.id == workspace_id).all()
        else:
            workspaces = db.query(Workspace).filter(Workspace.company_domains.isnot(None)).all()

        if not workspaces:
            print("❌ No workspaces found with company_domains configured")
            return

        total_internal_customers = 0
        total_messages_reassigned = 0
        total_messages_orphaned = 0

        for workspace in workspaces:
            print(f"\n{'='*80}")
            print(f"🏢 Workspace: {workspace.name}")
            print(f"   Company Domains: {workspace.company_domains}")
            print(f"{'='*80}\n")

            if not workspace.company_domains:
                print("   ⏭️  Skipping - no company domains configured\n")
                continue

            internal_domains = [d.lower() for d in workspace.company_domains]

            # Also add workspace company domain if exists
            if workspace.company and workspace.company.domain:
                internal_domains.append(workspace.company.domain.lower())

            # Find all internal customers
            internal_customers = db.query(Customer).filter(
                and_(
                    Customer.workspace_id == workspace.id,
                    Customer.domain.in_(internal_domains)
                )
            ).all()

            if not internal_customers:
                print("   ✅ No internal customers found - all good!\n")
                continue

            print(f"   Found {len(internal_customers)} internal customer(s) to fix:")
            for customer in internal_customers:
                print(f"   - {customer.name} ({customer.domain})")
            print()

            total_internal_customers += len(internal_customers)

            # Process each internal customer
            for internal_customer in internal_customers:
                print(f"   📋 Processing: {internal_customer.name} ({internal_customer.domain})")

                # Get all messages for this internal customer
                messages = db.query(Message).filter(
                    Message.customer_id == internal_customer.id
                ).all()

                print(f"      Found {len(messages)} message(s)")

                reassigned_count = 0
                orphaned_count = 0

                for message in messages:
                    # Try to find correct external customer
                    correct_customer = find_or_suggest_correct_customer(
                        db, message, workspace.id, internal_domains
                    )

                    if correct_customer:
                        if dry_run:
                            print(f"      [DRY RUN] Would reassign message '{message.title or message.id}' to {correct_customer.name}")
                        else:
                            message.customer_id = correct_customer.id
                            print(f"      ✅ Reassigned message to {correct_customer.name}")
                        reassigned_count += 1
                    else:
                        if dry_run:
                            print(f"      [DRY RUN] Would delete message '{message.title or message.id}' (no external customer found)")
                        else:
                            db.delete(message)
                            print(f"      🗑️  Deleted message (no external customer found)")
                        orphaned_count += 1

                total_messages_reassigned += reassigned_count
                total_messages_orphaned += orphaned_count

                print(f"      Summary: {reassigned_count} reassigned, {orphaned_count} deleted")

                # Delete the internal customer
                if dry_run:
                    print(f"      [DRY RUN] Would delete customer: {internal_customer.name}\n")
                else:
                    db.delete(internal_customer)
                    print(f"      🗑️  Deleted customer: {internal_customer.name}\n")

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
        print(f"   Internal customers found: {total_internal_customers}")
        print(f"   Messages reassigned: {total_messages_reassigned}")
        print(f"   Messages deleted: {total_messages_orphaned}")
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

    parser = argparse.ArgumentParser(description='Fix internal customers that were incorrectly created')
    parser.add_argument('--workspace-id', type=str, help='Specific workspace ID to fix')
    parser.add_argument('--execute', action='store_true', help='Actually execute changes (default is dry-run)')

    args = parser.parse_args()

    dry_run = not args.execute

    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made")
        print("    Use --execute flag to apply changes\n")
    else:
        print("\n⚠️  EXECUTION MODE - Changes will be applied!")
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled.")
            sys.exit(0)
        print()

    fix_internal_customers(
        workspace_id=args.workspace_id,
        dry_run=dry_run
    )

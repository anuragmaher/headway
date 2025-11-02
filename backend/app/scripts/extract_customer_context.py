"""
Extract customer context (industry, use cases, pain points) for all customers

Usage:
    python3 -m app.scripts.extract_customer_context --workspace-id <workspace_id>
"""

import sys
from pathlib import Path
import argparse
import logging
import os
from dotenv import load_dotenv

# Add the backend directory to Python path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
env_path = backend_dir / '.env'
if env_path.exists():
    load_dotenv(env_path)
    logging.info(f"Loaded environment from {env_path}")

from app.core.database import SessionLocal
from app.models.customer import Customer
from app.models.message import Message
from app.services.ai_extraction_service import get_ai_extraction_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def extract_context_for_customers(workspace_id: str, force_update: bool = False):
    """
    Extract customer context for all customers in a workspace

    Args:
        workspace_id: The workspace ID
        force_update: If True, re-extract even if use_cases already exists
    """
    db = SessionLocal()
    ai_service = get_ai_extraction_service()

    try:
        # Get all customers
        query = db.query(Customer).filter(Customer.workspace_id == workspace_id)

        if not force_update:
            # Only process customers without use_cases
            query = query.filter(
                (Customer.use_cases == None) | (Customer.use_cases == '')
            )

        customers = query.all()

        if not customers:
            logger.info("No customers to process")
            return

        logger.info(f"Processing {len(customers)} customers...")

        processed = 0
        updated = 0
        errors = 0

        for customer in customers:
            try:
                processed += 1
                logger.info(f"[{processed}/{len(customers)}] Processing {customer.name}...")

                # Get all messages for this customer
                messages = db.query(Message).filter(
                    Message.customer_id == customer.id
                ).order_by(Message.sent_at.desc()).all()

                if not messages:
                    logger.info(f"  ⚠️  No messages found for {customer.name}, skipping")
                    continue

                logger.info(f"  📧 Found {len(messages)} messages")

                # Prepare messages for AI extraction
                message_dicts = [
                    {
                        'content': msg.content,
                        'sent_at': msg.sent_at.isoformat() if msg.sent_at else None
                    }
                    for msg in messages
                    if msg.content
                ]

                if not message_dicts:
                    logger.info(f"  ⚠️  No valid message content for {customer.name}, skipping")
                    continue

                # Extract customer context using LLM
                logger.info(f"  🤖 Extracting context with AI...")
                context_extraction = ai_service.extract_customer_context(
                    messages=message_dicts,
                    customer_name=customer.name,
                    existing_industry=customer.industry,
                    existing_use_cases=customer.use_cases
                )

                # Update customer record
                should_update = False

                # Update industry if we have high confidence and it's not already set
                if (not customer.industry and
                    context_extraction.get('industry') and
                    context_extraction.get('industry_confidence', 0) > 0.7):
                    customer.industry = context_extraction['industry']
                    should_update = True
                    logger.info(f"  ✓ Industry: {customer.industry}")

                # Update use cases (always update if extracted)
                if context_extraction.get('use_cases'):
                    customer.use_cases = context_extraction['use_cases']
                    should_update = True
                    preview = customer.use_cases[:100] + "..." if len(customer.use_cases) > 100 else customer.use_cases
                    logger.info(f"  ✓ Use cases: {preview}")

                if should_update:
                    db.commit()
                    db.refresh(customer)
                    updated += 1
                    logger.info(f"  ✅ Updated {customer.name}")
                else:
                    logger.info(f"  ℹ️  No updates needed for {customer.name}")

            except Exception as e:
                errors += 1
                logger.error(f"  ❌ Error processing {customer.name}: {e}")
                db.rollback()
                continue

        logger.info("")
        logger.info("=" * 60)
        logger.info(f"✅ Complete!")
        logger.info(f"   Processed: {processed}")
        logger.info(f"   Updated: {updated}")
        logger.info(f"   Errors: {errors}")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract customer context')
    parser.add_argument('--workspace-id', required=True, help='Workspace ID')
    parser.add_argument('--force', action='store_true', help='Re-extract even if use_cases exists')

    args = parser.parse_args()

    logger.info("🚀 Starting customer context extraction...")
    extract_context_for_customers(args.workspace_id, args.force)
    logger.info("✅ Done!")

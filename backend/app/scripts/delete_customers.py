"""
Delete all customers from the database

Usage:
    python3 -m app.scripts.delete_customers
"""

import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.models.customer import Customer
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def delete_all_customers():
    """Delete all customers from the database"""
    db = SessionLocal()
    try:
        # Count customers before deletion
        count = db.query(Customer).count()
        logger.info(f"Found {count} customers to delete")

        if count == 0:
            logger.info("No customers to delete")
            return

        # Delete all customers
        deleted = db.query(Customer).delete()
        db.commit()

        logger.info(f"✅ Successfully deleted {deleted} customers")

    except Exception as e:
        logger.error(f"❌ Error deleting customers: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("🗑️  Starting customer deletion...")
    delete_all_customers()
    logger.info("✅ Done!")

#!/usr/bin/env python3

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.feature import Feature
from app.models.message import feature_messages

def clean_features_and_relationships():
    """Clean all features and feature-message relationships from database"""

    db = next(get_db())
    try:
        print("Starting database cleanup...")

        # First, delete all feature-message relationships
        print("Deleting feature-message relationships...")
        result = db.execute(feature_messages.delete())
        relationships_deleted = result.rowcount
        print(f"Deleted {relationships_deleted} feature-message relationships")

        # Then delete all features
        print("Deleting features...")
        features_deleted = db.query(Feature).delete()
        print(f"Deleted {features_deleted} features")

        # Commit the changes
        db.commit()
        print("✅ Database cleanup completed successfully!")
        print(f"Summary: {features_deleted} features and {relationships_deleted} relationships removed")

    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clean_features_and_relationships()
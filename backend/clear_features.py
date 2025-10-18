#!/usr/bin/env python3
"""
Clear all features to test new classification
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.feature import Feature
from app.models.message import feature_messages
from sqlalchemy import delete

def clear_features():
    """Clear all features and their associations"""
    db = next(get_db())
    try:
        # First delete feature-message associations
        db.execute(delete(feature_messages))

        # Then delete features
        count = db.query(Feature).delete()
        db.commit()
        print(f"✅ Deleted {count} features and their associations")
    finally:
        db.close()

if __name__ == "__main__":
    clear_features()

#!/usr/bin/env python3
"""
Check features in the database
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.feature import Feature
from app.models.theme import Theme

def check_features():
    """Check features in the database"""
    db = next(get_db())

    try:
        workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

        # Get all features
        features = db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).all()

        print(f"\nTotal features in database: {len(features)}")
        print(f"{'='*100}\n")

        # Group by theme
        theme_counts = {}
        for feature in features:
            theme_name = feature.theme.name if feature.theme else "No Theme"
            if theme_name not in theme_counts:
                theme_counts[theme_name] = []
            theme_counts[theme_name].append(feature)

        # Display by theme
        for theme_name, theme_features in sorted(theme_counts.items()):
            print(f"\n{theme_name} ({len(theme_features)} features):")
            print(f"{'-'*100}")
            for feature in theme_features:
                print(f"  • {feature.name}")
                print(f"    ID: {feature.id}")
                print(f"    Urgency: {feature.urgency} | Status: {feature.status} | Mentions: {feature.mention_count}")
                print()

    finally:
        db.close()


if __name__ == "__main__":
    check_features()

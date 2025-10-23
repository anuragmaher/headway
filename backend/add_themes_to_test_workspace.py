#!/usr/bin/env python3
"""
Add themes to test workspace
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.theme import Theme


def add_themes():
    """Add default themes to test workspace"""
    db = next(get_db())

    try:
        # Find workspace
        workspace = db.query(Workspace).filter(
            Workspace.name == "Test's Workspace"
        ).first()

        if not workspace:
            print("❌ Workspace not found")
            return

        print(f"Adding themes to workspace: {workspace.name}")

        # Check existing themes
        existing = db.query(Theme).filter(
            Theme.workspace_id == workspace.id
        ).count()

        if existing > 0:
            print(f"   ⚠️  Already has {existing} themes")
            return

        # Create default themes
        themes = [
            Theme(
                workspace_id=workspace.id,
                name="Uncategorized",
                description="Features that don't fit other categories",
                is_default=True
            ),
            Theme(
                workspace_id=workspace.id,
                name="Features",
                description="New feature requests and enhancements",
                is_default=False
            ),
            Theme(
                workspace_id=workspace.id,
                name="Integrations",
                description="Third-party integrations and API improvements",
                is_default=False
            ),
            Theme(
                workspace_id=workspace.id,
                name="Performance",
                description="Speed, optimization, and scalability",
                is_default=False
            ),
        ]

        db.add_all(themes)
        db.commit()

        print(f"✅ Added {len(themes)} themes:")
        for theme in themes:
            print(f"   - {theme.name} (default: {theme.is_default})")

    finally:
        db.close()


if __name__ == "__main__":
    add_themes()

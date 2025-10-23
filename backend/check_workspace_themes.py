#!/usr/bin/env python3
"""
Check themes in test workspace
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
from app.models.theme import Theme


def check_themes():
    """Check themes"""
    db = next(get_db())

    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    try:
        themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).all()

        print(f"Themes in workspace {workspace_id}:\n")

        for i, theme in enumerate(themes, 1):
            print(f"{i}. {theme.name}")
            print(f"   ID: {theme.id}")
            print(f"   Description: {theme.description}")
            print(f"   Is Default: {theme.is_default}")
            print()

    finally:
        db.close()


if __name__ == "__main__":
    check_themes()

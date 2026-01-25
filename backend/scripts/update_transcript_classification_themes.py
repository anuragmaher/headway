#!/usr/bin/env python
"""
Update Transcript Classifications - Extract theme_id and sub_theme_id from mappings

This script updates existing transcript classifications to extract and set
theme_id and sub_theme_id from the mappings array in extracted_data.

Usage:
    python scripts/update_transcript_classification_themes.py --workspace-id <uuid>
    python scripts/update_transcript_classification_themes.py --email anurag@grexit.com
"""

import argparse
import sys
import os
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import engine
from app.models.user import User
from app.models.workspace import Workspace
from app.models.transcript_classification import TranscriptClassification
from app.models.theme import Theme
from app.models.sub_theme import SubTheme


def find_workspace_by_email(db: Session, email: str) -> Optional[UUID]:
    """Find workspace_id for a user by email."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"❌ User not found: {email}")
        return None
    
    if not user.workspace_id:
        print(f"❌ User {email} has no workspace_id")
        return None
    
    print(f"✅ Found user: {email}")
    print(f"   Workspace ID: {user.workspace_id}")
    return user.workspace_id


def update_classification_themes(db: Session, workspace_id: UUID) -> dict:
    """Update transcript classifications to extract theme_id/sub_theme_id from mappings."""
    classifications = db.query(TranscriptClassification).filter(
        TranscriptClassification.workspace_id == workspace_id
    ).all()
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    for tc in classifications:
        try:
            # Check if already has theme_id/sub_theme_id
            if tc.theme_id and tc.sub_theme_id:
                skipped_count += 1
                continue
            
            # Extract from mappings
            extracted_data = tc.extracted_data or {}
            mappings = extracted_data.get('mappings', [])
            
            if not isinstance(mappings, list) or len(mappings) == 0:
                skipped_count += 1
                continue
            
            # Use first mapping's theme/sub_theme IDs
            first_mapping = mappings[0]
            if not isinstance(first_mapping, dict):
                skipped_count += 1
                continue
            
            theme_id_str = first_mapping.get('theme_id')
            sub_theme_id_str = first_mapping.get('sub_theme_id')
            
            theme_id = None
            sub_theme_id = None
            
            # Validate and set theme_id
            if theme_id_str:
                try:
                    theme_id = UUID(theme_id_str)
                    # Verify theme exists and belongs to workspace
                    theme = db.query(Theme).filter(
                        Theme.id == theme_id,
                        Theme.workspace_id == workspace_id
                    ).first()
                    if not theme:
                        print(f"   ⚠️  Theme {theme_id_str} not found for workspace")
                        theme_id = None
                except (ValueError, TypeError) as e:
                    print(f"   ⚠️  Invalid theme_id format: {theme_id_str} - {e}")
                    theme_id = None
            
            # Validate and set sub_theme_id
            if sub_theme_id_str:
                try:
                    sub_theme_id = UUID(sub_theme_id_str)
                    # Verify sub_theme exists and belongs to workspace
                    sub_theme = db.query(SubTheme).filter(
                        SubTheme.id == sub_theme_id,
                        SubTheme.workspace_id == workspace_id
                    ).first()
                    if not sub_theme:
                        print(f"   ⚠️  SubTheme {sub_theme_id_str} not found for workspace")
                        sub_theme_id = None
                except (ValueError, TypeError) as e:
                    print(f"   ⚠️  Invalid sub_theme_id format: {sub_theme_id_str} - {e}")
                    sub_theme_id = None
            
            # Update if we found valid IDs
            if theme_id or sub_theme_id:
                if theme_id:
                    tc.theme_id = theme_id
                if sub_theme_id:
                    tc.sub_theme_id = sub_theme_id
                tc.updated_at = datetime.now(timezone.utc)
                updated_count += 1
            else:
                skipped_count += 1
                
        except Exception as e:
            print(f"   ❌ Error updating classification {tc.id}: {e}")
            error_count += 1
    
    db.commit()
    
    return {
        'total': len(classifications),
        'updated': updated_count,
        'skipped': skipped_count,
        'errors': error_count
    }


def main():
    parser = argparse.ArgumentParser(
        description="Update transcript classifications to extract theme_id/sub_theme_id from mappings"
    )
    
    parser.add_argument(
        "--email",
        type=str,
        help="User email to find workspace"
    )
    parser.add_argument(
        "--workspace-id",
        type=str,
        help="Workspace ID directly"
    )
    
    args = parser.parse_args()
    
    if not args.email and not args.workspace_id:
        print("❌ Either --email or --workspace-id is required")
        sys.exit(1)
    
    with Session(engine) as db:
        # Find workspace
        if args.workspace_id:
            workspace_id = UUID(args.workspace_id)
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                print(f"❌ Workspace not found: {args.workspace_id}")
                sys.exit(1)
            print(f"✅ Using workspace: {workspace.name} ({workspace_id})")
        else:
            workspace_id = find_workspace_by_email(db, args.email)
            if not workspace_id:
                sys.exit(1)
        
        print(f"\n🔄 Updating transcript classifications...")
        result = update_classification_themes(db, workspace_id)
        
        print(f"\n✅ Update complete!")
        print(f"   Total classifications: {result['total']}")
        print(f"   Updated: {result['updated']}")
        print(f"   Skipped (already set or no mappings): {result['skipped']}")
        print(f"   Errors: {result['errors']}")


if __name__ == "__main__":
    main()

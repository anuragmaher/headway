#!/usr/bin/env python
"""
Backfill theme_ids and sub_theme_ids arrays for existing transcript classifications.

This script populates the array columns from extracted_data.mappings[] for records
that were created before the array columns were added.

Usage:
    python scripts/backfill_transcript_arrays.py --email anurag@grexit.com
    python scripts/backfill_transcript_arrays.py --workspace-id <uuid>
"""

import argparse
import sys
import os
from uuid import UUID
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import engine
from app.models.workspace import Workspace
from app.models.user import User
from app.models.transcript_classification import TranscriptClassification
from app.models.theme import Theme
from app.models.sub_theme import SubTheme


def find_workspace_by_email(db: Session, email: str) -> Optional[UUID]:
    """Find workspace_id for a user by email."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"❌ User not found: {email}")
        return None
    
    workspace_id = user.workspace_id
    if not workspace_id:
        print(f"❌ User {email} does not have a workspace")
        return None
    
    return workspace_id


def backfill_arrays(db: Session, workspace_id: UUID) -> dict:
    """Backfill theme_ids and sub_theme_ids arrays from mappings."""
    print(f"\n🔄 Backfilling arrays for workspace: {workspace_id}")
    
    # Find all transcript classifications that need backfilling
    classifications = db.query(TranscriptClassification).filter(
        TranscriptClassification.workspace_id == workspace_id
    ).all()
    
    total = len(classifications)
    updated = 0
    skipped = 0
    errors = 0
    
    print(f"   Found {total} transcript classifications")
    
    for i, tc in enumerate(classifications, 1):
        # Check if arrays need to be populated
        needs_backfill = (
            tc.theme_ids is None or 
            tc.sub_theme_ids is None or
            len(tc.theme_ids or []) == 0 or
            len(tc.sub_theme_ids or []) == 0
        )
        
        if not needs_backfill:
            skipped += 1
            continue
        
        # Extract arrays from mappings
        theme_ids_list = []
        sub_theme_ids_list = []
        
        extracted_data = tc.extracted_data or {}
        mappings = extracted_data.get('mappings', [])
        
        if isinstance(mappings, list) and len(mappings) > 0:
            for mapping in mappings:
                if isinstance(mapping, dict):
                    # Extract theme_id from mapping
                    theme_id_str = mapping.get('theme_id')
                    if theme_id_str:
                        try:
                            theme_uuid = UUID(theme_id_str)
                            # Verify theme exists and belongs to workspace
                            theme = db.query(Theme).filter(
                                Theme.id == theme_uuid,
                                Theme.workspace_id == workspace_id
                            ).first()
                            if theme and theme_uuid not in theme_ids_list:
                                theme_ids_list.append(theme_uuid)
                        except (ValueError, TypeError):
                            pass
                    
                    # Extract sub_theme_id from mapping
                    sub_theme_id_str = mapping.get('sub_theme_id')
                    if sub_theme_id_str:
                        try:
                            sub_theme_uuid = UUID(sub_theme_id_str)
                            # Verify sub_theme exists and belongs to workspace
                            sub_theme = db.query(SubTheme).filter(
                                SubTheme.id == sub_theme_uuid,
                                SubTheme.workspace_id == workspace_id
                            ).first()
                            if sub_theme and sub_theme_uuid not in sub_theme_ids_list:
                                sub_theme_ids_list.append(sub_theme_uuid)
                        except (ValueError, TypeError):
                            pass
        
        # Update the record
        try:
            tc.theme_ids = theme_ids_list if theme_ids_list else None
            tc.sub_theme_ids = sub_theme_ids_list if sub_theme_ids_list else None
            db.commit()
            updated += 1
            
            if (i % 10 == 0) or (i == total):
                print(f"   Progress: {i}/{total} (updated: {updated}, skipped: {skipped}, errors: {errors})")
        except Exception as e:
            errors += 1
            print(f"   ⚠️  Error updating {tc.id}: {e}")
            db.rollback()
    
    print(f"\n✅ Backfill complete!")
    print(f"   Total: {total}")
    print(f"   Updated: {updated}")
    print(f"   Skipped (already populated): {skipped}")
    print(f"   Errors: {errors}")
    
    return {
        "total": total,
        "updated": updated,
        "skipped": skipped,
        "errors": errors
    }


def main():
    parser = argparse.ArgumentParser(description="Backfill theme_ids and sub_theme_ids arrays")
    parser.add_argument(
        "--email",
        type=str,
        help="User email to find workspace"
    )
    parser.add_argument(
        "--workspace-id",
        type=str,
        help="Workspace UUID (alternative to --email)"
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
        
        # Run backfill
        backfill_arrays(db, workspace_id)


if __name__ == "__main__":
    main()

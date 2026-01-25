#!/usr/bin/env python
"""
Export Themes and SubThemes to JSON

This script exports themes and sub_themes from the database to a JSON file
that can be used for AI classification prompts or other purposes.

Usage:
    # From backend directory (with venv activated):
    python scripts/export_themes_json.py --email anurag@grexit.com --output themes.json
    python scripts/export_themes_json.py --workspace-id <uuid> --output themes.json
    python scripts/export_themes_json.py --email anurag@grexit.com --output themes.json --format langfuse
"""

import argparse
import json
import sys
import os
from typing import List, Dict, Any, Optional
from uuid import UUID

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from app.core.database import engine
from app.models.user import User
from app.models.theme import Theme
from app.models.sub_theme import SubTheme
from app.models.workspace import Workspace


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


def get_themes_hierarchy(db: Session, workspace_id: UUID) -> List[Dict[str, Any]]:
    """Get all themes with their sub_themes for a workspace."""
    themes = db.query(Theme).filter(
        Theme.workspace_id == workspace_id
    ).order_by(Theme.sort_order.asc()).all()
    
    result = []
    for theme in themes:
        sub_themes = db.query(SubTheme).filter(
            SubTheme.theme_id == theme.id
        ).order_by(SubTheme.sort_order.asc()).all()
        
        theme_data = {
            "id": str(theme.id),
            "name": theme.name,
            "description": theme.description or "",
            "sort_order": theme.sort_order,
            "sub_themes": [
                {
                    "id": str(st.id),
                    "name": st.name,
                    "description": st.description or "",
                    "sort_order": st.sort_order
                }
                for st in sub_themes
            ]
        }
        result.append(theme_data)
    
    return result


def format_for_langfuse(themes: List[Dict[str, Any]]) -> str:
    """Format themes for Langfuse prompt variables (themes_list format)."""
    lines = []
    for theme in themes:
        lines.append(f"THEME: {theme['name']} (ID: {theme['id']})")
        if theme['description']:
            lines.append(f"  Description: {theme['description']}")
        lines.append("  Sub-themes:")
        for st in theme['sub_themes']:
            lines.append(f"    - {st['name']} (ID: {st['id']}): {st['description'] or 'N/A'}")
        lines.append("")
    return "\n".join(lines)


def format_for_classification(themes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Format themes in a structure optimized for AI classification."""
    return {
        "themes": themes,
        "total_themes": len(themes),
        "total_sub_themes": sum(len(t['sub_themes']) for t in themes),
        "format": "classification"
    }


def format_for_prompt_variables(themes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Format themes as prompt variables (similar to what tier2_extraction uses)."""
    return {
        "themes_list": format_for_langfuse(themes),
        "themes": themes,
        "format": "prompt_variables"
    }


def main():
    parser = argparse.ArgumentParser(
        description="Export Themes and SubThemes to JSON",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Export for user by email
  python scripts/export_themes_json.py --email anurag@grexit.com --output themes.json

  # Export for workspace directly
  python scripts/export_themes_json.py --workspace-id <uuid> --output themes.json

  # Export in Langfuse format (text format for prompts)
  python scripts/export_themes_json.py --email anurag@grexit.com --output themes.txt --format langfuse

  # Export in classification format (structured JSON)
  python scripts/export_themes_json.py --email anurag@grexit.com --output themes.json --format classification
        """
    )
    
    parser.add_argument(
        "--email",
        type=str,
        help="User email to find workspace"
    )
    parser.add_argument(
        "--workspace-id",
        type=str,
        help="Workspace ID directly (skips email lookup)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="themes.json",
        help="Output file path (default: themes.json)"
    )
    parser.add_argument(
        "--format",
        choices=["json", "classification", "langfuse", "prompt_variables"],
        default="json",
        help="Output format (default: json)"
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
        
        # Get themes hierarchy
        print(f"\n📋 Fetching themes and sub_themes for workspace {workspace_id}...")
        themes = get_themes_hierarchy(db, workspace_id)
        
        if not themes:
            print(f"❌ No themes found for workspace {workspace_id}")
            sys.exit(1)
        
        print(f"✅ Found {len(themes)} themes with {sum(len(t['sub_themes']) for t in themes)} sub_themes")
        
        # Format output based on format type
        if args.format == "langfuse":
            # Text format for Langfuse prompts
            output_content = format_for_langfuse(themes)
            with open(args.output, 'w') as f:
                f.write(output_content)
            print(f"✅ Exported Langfuse format to {args.output}")
            print(f"\nPreview (first 500 chars):")
            print(output_content[:500])
            
        elif args.format == "classification":
            # Structured format for classification
            output_data = format_for_classification(themes)
            with open(args.output, 'w') as f:
                json.dump(output_data, f, indent=2)
            print(f"✅ Exported classification format to {args.output}")
            
        elif args.format == "prompt_variables":
            # Format for prompt variables (like tier2_extraction uses)
            output_data = format_for_prompt_variables(themes)
            with open(args.output, 'w') as f:
                json.dump(output_data, f, indent=2)
            print(f"✅ Exported prompt variables format to {args.output}")
            
        else:  # json (default)
            # Simple JSON format
            with open(args.output, 'w') as f:
                json.dump(themes, f, indent=2)
            print(f"✅ Exported JSON format to {args.output}")
        
        # Print summary
        print(f"\n📊 Summary:")
        print(f"   Themes: {len(themes)}")
        for theme in themes:
            print(f"   - {theme['name']}: {len(theme['sub_themes'])} sub_themes")
            for st in theme['sub_themes']:
                print(f"     • {st['name']}")


if __name__ == "__main__":
    main()

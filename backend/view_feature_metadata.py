#!/usr/bin/env python3
"""
Utility script to view and analyze AI metadata stored with features.

Usage:
    python view_feature_metadata.py --workspace-id <uuid> [--theme <theme_name>]
    python view_feature_metadata.py --workspace-id <uuid> --feature <feature_name>
    python view_feature_metadata.py --workspace-id <uuid> --low-confidence
"""

import sys
import argparse
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.feature import Feature
from app.models.theme import Theme


def view_feature_details(feature):
    """Display detailed information about a feature and its AI metadata"""
    print(f"\n{'='*80}")
    print(f"Feature: {feature.name}")
    print(f"ID: {feature.id}")
    print(f"Status: {feature.status} | Urgency: {feature.urgency}")
    print(f"Theme: {feature.theme.name if feature.theme else 'None'}")
    print(f"Mentions: {feature.mention_count} | Last mentioned: {feature.last_mentioned}")
    print(f"{'='*80}")

    if not feature.ai_metadata:
        print("No AI metadata stored")
        return

    metadata = feature.ai_metadata

    # Theme Relevance
    if "transcript_theme_relevance" in metadata:
        relevance = metadata["transcript_theme_relevance"]
        print(f"\n📊 TRANSCRIPT THEME RELEVANCE")
        print(f"  Relevant: {relevance.get('is_relevant', 'N/A')}")
        print(f"  Confidence: {relevance.get('confidence', 0):.2%}")
        print(f"  Matched Themes: {', '.join(relevance.get('matched_themes', []))}")
        print(f"  Reasoning: {relevance.get('reasoning', 'N/A')}")

    # Theme Validation
    if "theme_validation" in metadata:
        validation = metadata["theme_validation"]
        print(f"\n✓ THEME VALIDATION")
        print(f"  Suggested Theme: {validation.get('suggested_theme', 'N/A')}")
        print(f"  Assigned Theme: {validation.get('assigned_theme', 'N/A')}")
        print(f"  Valid: {validation.get('is_valid', False)}")
        print(f"  Confidence: {validation.get('confidence', 0):.2%}")
        print(f"  Reasoning: {validation.get('reasoning', 'N/A')}")

    # Feature Matching
    if "feature_matching" in metadata:
        matching = metadata["feature_matching"]
        print(f"\n🔗 FEATURE MATCHING")
        print(f"  Is Unique: {matching.get('is_unique', 'N/A')}")
        print(f"  Confidence: {matching.get('confidence', 0):.2%}")
        print(f"  Reasoning: {matching.get('reasoning', 'N/A')}")

    # Matched Features (if this is a duplicate)
    if "matches" in metadata and metadata["matches"]:
        print(f"\n📍 MATCHED TO EXISTING FEATURES")
        for match in metadata["matches"]:
            print(f"  - {match.get('matched_title', 'N/A')}")
            print(f"    Confidence: {match.get('confidence', 0):.2%}")
            print(f"    Reasoning: {match.get('reasoning', 'N/A')}")

    print()


def main():
    parser = argparse.ArgumentParser(description="View AI metadata for features")
    parser.add_argument("--workspace-id", required=True, help="Workspace ID")
    parser.add_argument("--feature", help="View specific feature by name")
    parser.add_argument("--theme", help="Filter features by theme")
    parser.add_argument("--low-confidence", action="store_true",
                        help="Show only features with low theme validation confidence (<0.8)")
    parser.add_argument("--detailed", "-d", action="store_true",
                        help="Show detailed metadata for each feature")

    args = parser.parse_args()

    db = next(get_db())

    try:
        # Get features based on filters
        query = db.query(Feature).filter(Feature.workspace_id == args.workspace_id)

        if args.feature:
            query = query.filter(Feature.name.ilike(f"%{args.feature}%"))
        elif args.theme:
            theme = db.query(Theme).filter(
                Theme.workspace_id == args.workspace_id,
                Theme.name.ilike(f"%{args.theme}%")
            ).first()
            if theme:
                query = query.filter(Feature.theme_id == theme.id)
            else:
                print(f"Theme '{args.theme}' not found")
                return

        features = query.all()

        if not features:
            print("No features found")
            return

        # Filter by confidence if requested
        if args.low_confidence:
            features = [
                f for f in features
                if f.ai_metadata and
                   f.ai_metadata.get("theme_validation", {}).get("confidence", 0) < 0.8
            ]

        if not features:
            print("No features with low confidence found")
            return

        if args.detailed:
            for feature in features:
                view_feature_details(feature)
        else:
            # Summary table
            print("\nFeature Theme Classification Summary:")
            print("-" * 100)
            print(f"{'Feature Name':<40} {'Theme':<20} {'Theme Val.':<12} {'Relevance':<12} {'Valid?':<6}")
            print("-" * 100)

            for feature in features:
                metadata = feature.ai_metadata or {}
                theme_val = metadata.get("theme_validation", {})
                relevance = metadata.get("transcript_theme_relevance", {})

                theme_conf = f"{theme_val.get('confidence', 0):.0%}"
                rel_conf = f"{relevance.get('confidence', 0):.0%}"
                valid = '✓' if theme_val.get('is_valid', False) else '✗'
                theme_name = feature.theme.name if feature.theme else 'None'

                print(
                    f"{feature.name[:39]:<40} "
                    f"{theme_name:<20} "
                    f"{theme_conf:<12} "
                    f"{rel_conf:<12} "
                    f"{valid:<6}"
                )

            print("-" * 100)
            print(f"\nTotal features: {len(features)}")
            low_conf = sum(1 for f in features
                          if f.ai_metadata and
                          f.ai_metadata.get("theme_validation", {}).get("confidence", 0) < 0.8)
            print(f"Low confidence (<80%): {low_conf}")

            print("\nRun with --detailed to see full AI reasoning for each feature")


    finally:
        db.close()


if __name__ == "__main__":
    main()

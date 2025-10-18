#!/usr/bin/env python3

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.message import Message, feature_messages
from app.models.feature import Feature
from app.models.theme import Theme
from app.models.clustering import ClusteringRun, DiscoveredCluster, ClassificationSignal
from app.models.workspace_data_point import WorkspaceDataPoint

def cleanup_database():
    """
    Clean all data from database except user credentials.

    Keeps:
    - Users
    - Companies
    - Workspaces
    - Integrations (OAuth tokens)

    Deletes:
    - Messages
    - Features
    - Themes (and sub-themes)
    - ClusteringRuns (and DiscoveredClusters)
    - ClassificationSignals
    - WorkspaceDataPoints
    """

    db = next(get_db())
    try:
        print("Starting comprehensive database cleanup...")
        print("=" * 60)

        # 1. Delete workspace data points first (references features and messages)
        print("\n[1/8] Deleting workspace data points...")
        data_points_deleted = db.query(WorkspaceDataPoint).delete()
        print(f"✓ Deleted {data_points_deleted} workspace data points")

        # 2. Delete feature-message relationships
        print("\n[2/8] Deleting feature-message relationships...")
        result = db.execute(feature_messages.delete())
        relationships_deleted = result.rowcount
        print(f"✓ Deleted {relationships_deleted} feature-message relationships")

        # 3. Delete classification signals (references discovered_clusters)
        print("\n[3/8] Deleting classification signals...")
        signals_deleted = db.query(ClassificationSignal).delete()
        print(f"✓ Deleted {signals_deleted} classification signals")

        # 4. Delete discovered clusters (references clustering_runs)
        print("\n[4/8] Deleting discovered clusters...")
        clusters_deleted = db.query(DiscoveredCluster).delete()
        print(f"✓ Deleted {clusters_deleted} discovered clusters")

        # 5. Delete clustering runs
        print("\n[5/8] Deleting clustering runs...")
        runs_deleted = db.query(ClusteringRun).delete()
        print(f"✓ Deleted {runs_deleted} clustering runs")

        # 6. Delete features
        print("\n[6/8] Deleting features...")
        features_deleted = db.query(Feature).delete()
        print(f"✓ Deleted {features_deleted} features")

        # 7. Delete messages
        print("\n[7/8] Deleting messages...")
        messages_deleted = db.query(Message).delete()
        print(f"✓ Deleted {messages_deleted} messages")

        # 8. Delete themes (handles sub-themes via cascade)
        print("\n[8/8] Deleting themes (including sub-themes)...")
        themes_deleted = db.query(Theme).delete()
        print(f"✓ Deleted {themes_deleted} themes")

        # Commit all changes
        db.commit()

        print("\n" + "=" * 60)
        print("✅ Database cleanup completed successfully!")
        print("\nSummary:")
        print(f"  • Workspace data points: {data_points_deleted}")
        print(f"  • Feature-message relationships: {relationships_deleted}")
        print(f"  • Classification signals: {signals_deleted}")
        print(f"  • Discovered clusters: {clusters_deleted}")
        print(f"  • Clustering runs: {runs_deleted}")
        print(f"  • Features: {features_deleted}")
        print(f"  • Messages: {messages_deleted}")
        print(f"  • Themes: {themes_deleted}")
        print(f"\n  Total items deleted: {data_points_deleted + relationships_deleted + signals_deleted + clusters_deleted + runs_deleted + features_deleted + messages_deleted + themes_deleted}")
        print("\nPreserved:")
        print("  ✓ Users")
        print("  ✓ Companies")
        print("  ✓ Workspaces")
        print("  ✓ Integrations (OAuth tokens)")

    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    # Ask for confirmation
    print("⚠️  WARNING: This will delete ALL data except user credentials!")
    print("\nThis will remove:")
    print("  - All workspace data points")
    print("  - All messages")
    print("  - All features")
    print("  - All themes")
    print("  - All clustering data")
    print("  - All classification signals")
    print("\nThis will keep:")
    print("  - Users")
    print("  - Companies")
    print("  - Workspaces")
    print("  - Integrations (OAuth tokens)")

    response = input("\nAre you sure you want to continue? (yes/no): ")

    if response.lower() in ['yes', 'y']:
        cleanup_database()
    else:
        print("Cleanup cancelled.")

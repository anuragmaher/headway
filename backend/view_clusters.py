#!/usr/bin/env python3
"""
Script to view discovered clusters directly from the database
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.clustering import ClusteringRun, DiscoveredCluster


def view_clusters():
    """View all discovered clusters"""

    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    db = SessionLocal()
    try:
        # Get the latest clustering run
        clustering_run = db.query(ClusteringRun).filter(
            ClusteringRun.workspace_id == workspace_id
        ).order_by(ClusteringRun.created_at.desc()).first()

        if not clustering_run:
            print("❌ No clustering runs found!")
            return

        print(f"🎯 CLUSTERING RUN RESULTS")
        print(f"=" * 60)
        print(f"📊 Run: {clustering_run.run_name}")
        print(f"📈 Status: {clustering_run.status}")
        print(f"📝 Messages analyzed: {clustering_run.messages_analyzed}")
        print(f"🎯 Clusters discovered: {clustering_run.clusters_discovered}")
        print(f"🔍 Confidence threshold: {clustering_run.confidence_threshold}")
        print(f"🕐 Created: {clustering_run.created_at}")
        print()

        # Get all discovered clusters
        clusters = db.query(DiscoveredCluster).filter(
            DiscoveredCluster.clustering_run_id == clustering_run.id
        ).order_by(DiscoveredCluster.confidence_score.desc()).all()

        print(f"🔍 DISCOVERED CLUSTERS ({len(clusters)}):")
        print(f"=" * 60)

        for i, cluster in enumerate(clusters, 1):
            print(f"{i}. 📋 {cluster.cluster_name}")
            print(f"   📊 Confidence: {cluster.confidence_score:.2f}")
            print(f"   📂 Category: {cluster.category}")
            print(f"   🎯 Theme: {cluster.theme}")
            print(f"   📝 Messages: {cluster.message_count}")
            print(f"   ✅ Status: {cluster.approval_status}")
            print(f"   📖 Description:")
            print(f"      {cluster.description}")
            print(f"   💼 Business Impact:")
            print(f"      {cluster.business_impact}")

            if cluster.example_messages:
                print(f"   📄 Example Messages: {len(cluster.example_messages)} samples")
            print()

        print(f"📋 NEXT STEPS:")
        print(f"1. Review the clusters above")
        print(f"2. Approve clusters you want to use for classification")
        print(f"3. Generate classification signals from approved clusters")
        print(f"4. Start fast classification on new messages")

    finally:
        db.close()


if __name__ == "__main__":
    view_clusters()
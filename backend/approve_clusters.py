#!/usr/bin/env python3
"""
Script to approve discovered clusters and generate classification signals
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.clustering import ClusteringRun, DiscoveredCluster, ClassificationSignal
from app.models.user import User
from app.services.llm_clustering_service import llm_clustering_service


def approve_clusters():
    """Approve the top clusters and generate classification signals"""

    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    db = SessionLocal()
    try:
        # Get test user for approval
        user = db.query(User).filter(User.email == "test@headwayhq.com").first()
        if not user:
            print("❌ Test user not found!")
            return

        # Get the latest clustering run
        clustering_run = db.query(ClusteringRun).filter(
            ClusteringRun.workspace_id == workspace_id
        ).order_by(ClusteringRun.created_at.desc()).first()

        if not clustering_run:
            print("❌ No clustering runs found!")
            return

        # Get top clusters (confidence > 0.85)
        clusters_to_approve = db.query(DiscoveredCluster).filter(
            DiscoveredCluster.clustering_run_id == clustering_run.id,
            DiscoveredCluster.confidence_score >= 0.85,
            DiscoveredCluster.approval_status == "pending"
        ).order_by(DiscoveredCluster.confidence_score.desc()).all()

        if not clusters_to_approve:
            print("❌ No clusters found for approval!")
            return

        print(f"🎯 APPROVING HIGH-CONFIDENCE CLUSTERS")
        print(f"=" * 60)
        print(f"📊 Found {len(clusters_to_approve)} clusters with confidence ≥ 0.85")
        print()

        approved_count = 0
        signals_generated = 0

        for cluster in clusters_to_approve:
            try:
                print(f"✅ Approving: {cluster.cluster_name} (confidence: {cluster.confidence_score:.2f})")

                # Approve the cluster
                approved_cluster = llm_clustering_service.approve_cluster(
                    cluster_id=str(cluster.id),
                    approved_by_user_id=str(user.id),
                    customer_feedback=f"Auto-approved high-confidence cluster for {cluster.theme} theme"
                )

                approved_count += 1

                # Count signals generated for this cluster
                cluster_signals = db.query(ClassificationSignal).filter(
                    ClassificationSignal.source_cluster_id == cluster.id
                ).count()

                signals_generated += cluster_signals
                print(f"   🔄 Generated {cluster_signals} classification signals")
                print(f"   📂 Category: {cluster.category}")
                print(f"   🎯 Theme: {cluster.theme}")
                print()

            except Exception as e:
                print(f"❌ Error approving cluster {cluster.cluster_name}: {e}")
                continue

        # Get total signals count
        total_signals = db.query(ClassificationSignal).filter(
            ClassificationSignal.workspace_id == workspace_id
        ).count()

        print(f"🎉 APPROVAL COMPLETE!")
        print(f"=" * 60)
        print(f"✅ Approved clusters: {approved_count}")
        print(f"🔄 Signals generated: {signals_generated}")
        print(f"📊 Total active signals: {total_signals}")
        print()

        # Show signal breakdown by type
        signal_types = db.execute("""
            SELECT signal_type, COUNT(*) as count
            FROM classification_signals
            WHERE workspace_id = :workspace_id AND is_active = true
            GROUP BY signal_type
            ORDER BY count DESC
        """, {"workspace_id": workspace_id}).fetchall()

        if signal_types:
            print(f"🔍 SIGNAL BREAKDOWN:")
            for signal_type, count in signal_types:
                print(f"   {signal_type}: {count} signals")
            print()

        print(f"🚀 FAST CLASSIFICATION READY!")
        print(f"The system can now classify new messages in milliseconds using these signals:")
        print(f"1. Keyword-based signals for exact matches")
        print(f"2. Pattern-based signals for structured content")
        print(f"3. Semantic signals for concept similarity")
        print(f"4. Business rule signals for complex logic")
        print()
        print(f"Next: Test fast classification on new messages!")

    finally:
        db.close()


if __name__ == "__main__":
    approve_clusters()
#!/usr/bin/env python3
"""
Script to start a clustering run directly via the service
(bypassing API authentication for testing)
"""

import sys
import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.llm_clustering_service import llm_clustering_service


async def start_clustering_run():
    """Start a clustering run for the test workspace"""

    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    print("🚀 Starting clustering run...")
    print(f"📍 Workspace ID: {workspace_id}")
    print(f"🕐 Started at: {datetime.now()}")

    try:
        # Start clustering run
        clustering_run = llm_clustering_service.start_clustering_run(
            workspace_id=workspace_id,
            run_name="Initial Discovery Run - Oct 2025",
            description="First clustering analysis of product feature requests",
            confidence_threshold=0.7,
            max_messages=50  # Limit for testing to reduce cost
        )

        print(f"✅ Clustering run started successfully!")
        print(f"📊 Run ID: {clustering_run.id}")
        print(f"📈 Status: {clustering_run.status}")
        print(f"📝 Messages analyzed: {clustering_run.messages_analyzed}")
        print(f"🎯 Clusters discovered: {clustering_run.clusters_discovered}")
        print(f"🔍 Confidence threshold: {clustering_run.confidence_threshold}")

        if clustering_run.status == "completed":
            print(f"🏁 Completed at: {clustering_run.completed_at}")
            print(f"\n🎉 Clustering analysis complete!")
            print(f"🔍 Found {clustering_run.clusters_discovered} clusters in {clustering_run.messages_analyzed} messages")
            print(f"\n📋 Next steps:")
            print(f"1. Review discovered clusters via API: GET /api/v1/clustering/pending-clusters?workspace_id={workspace_id}")
            print(f"2. Approve clusters you want to use for classification")
            print(f"3. Start using fast classification on new messages")
        else:
            print(f"⚠️  Clustering run status: {clustering_run.status}")

        return clustering_run

    except Exception as e:
        print(f"❌ Error starting clustering run: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    asyncio.run(start_clustering_run())
#!/usr/bin/env python3
"""
Wrapper script to sync Gong calls and classify features in one go.

This script:
1. Ingests calls from Gong API
2. Classifies extracted features into themes
"""

import sys
import asyncio
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import the main functions from existing scripts
from app.scripts.ingest_gong_calls import ingest_gong_calls
from classify_features import classify_features

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def sync_and_classify(workspace_id: str, limit: int = 5, days_back: int = 7):
    """
    Main function to sync Gong calls and classify features.

    Args:
        workspace_id: The workspace ID to sync and classify for
        limit: Maximum number of calls to fetch (default: 5)
        days_back: How many days back to fetch calls (default: 7)
    """
    try:
        logger.info("=" * 80)
        logger.info("STARTING GONG SYNC AND FEATURE CLASSIFICATION")
        logger.info("=" * 80)
        logger.info(f"Workspace ID: {workspace_id}")
        logger.info(f"Limit: {limit} calls")
        logger.info(f"Looking back: {days_back} days")
        logger.info("")

        # Step 1: Ingest Gong calls
        logger.info("STEP 1: Syncing Gong calls...")
        logger.info("-" * 80)
        count = await ingest_gong_calls(
            workspace_id=workspace_id,
            limit=limit,
            days_back=days_back,
            fetch_transcripts=True,
            extract_features=True
        )
        logger.info("")
        logger.info(f"✅ Gong sync completed successfully - Ingested {count} calls")
        logger.info("")

        # Step 2: Classify features
        logger.info("STEP 2: Classifying features into themes...")
        logger.info("-" * 80)
        classify_features(workspace_id)
        logger.info("")
        logger.info("✅ Feature classification completed successfully")
        logger.info("")

        logger.info("=" * 80)
        logger.info("SYNC AND CLASSIFICATION COMPLETE")
        logger.info("=" * 80)

    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error during sync and classification: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # Default workspace ID (can be modified or passed as argument)
    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

    # Limit to 50 calls
    limit = 50

    # Run the combined sync and classification
    asyncio.run(sync_and_classify(workspace_id, limit=limit))

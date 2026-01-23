#!/usr/bin/env python3
"""
Gong call ingestion script - Stub Version

NOTE: This script is currently disabled as part of the database schema redesign.
The Integration and Feature models have been replaced.
Full implementation will be restored after schema migration is complete.

Usage:
    python -m app.scripts.ingest_gong_calls --workspace-id <uuid> --limit 10
"""

import asyncio
import argparse
import logging
import sys
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _get_or_create_customer_from_parties(
    db: Session,
    workspace_id: str,
    parties: List[Dict[str, Any]]
) -> Optional[Any]:
    """
    Stub - Get or create a customer from Gong call parties.
    """
    logger.debug("_get_or_create_customer_from_parties called (stub - disabled)")
    return None


async def ingest_gong_calls(
    workspace_id: str,
    limit: int = 10,
    days_back: int = 7,
    fetch_transcripts: bool = True,
    extract_features: bool = True,
    access_key: Optional[str] = None,
    secret_key: Optional[str] = None
) -> Dict[str, int]:
    """
    Stub - Ingest calls from Gong for a specific workspace.

    NOTE: Currently disabled during schema migration.
    """
    logger.warning(
        f"ingest_gong_calls called for workspace {workspace_id} "
        f"but Gong ingestion is disabled during schema migration"
    )
    return {"total_checked": 0, "new_added": 0}


async def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(description="Ingest calls from Gong (DISABLED)")

    parser.add_argument("--workspace-id", required=True, help="Workspace ID")
    parser.add_argument("--limit", type=int, default=10, help="Max calls")
    parser.add_argument("--days-back", type=int, default=7, help="Days back")
    parser.add_argument("--no-transcripts", action="store_true", help="Skip transcripts")
    parser.add_argument("--no-extract-features", action="store_true", help="Skip AI")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose")

    args = parser.parse_args()

    logger.warning("Gong call ingestion is currently DISABLED during schema migration")
    logger.info("Please wait until the schema redesign is complete")

    result = await ingest_gong_calls(
        workspace_id=args.workspace_id,
        limit=args.limit,
        days_back=args.days_back,
        fetch_transcripts=not args.no_transcripts,
        extract_features=not args.no_extract_features
    )

    logger.info(f"Result: {result}")
    sys.exit(0)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

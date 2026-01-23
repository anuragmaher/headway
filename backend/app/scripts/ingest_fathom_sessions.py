#!/usr/bin/env python3
"""
Fathom session ingestion script - Stub Version

NOTE: This script is currently disabled as part of the database schema redesign.
The Integration model has been replaced by WorkspaceConnector.
Full implementation will be restored after schema migration is complete.

Usage:
    python -m app.scripts.ingest_fathom_sessions --workspace-id <uuid> --limit 10
"""

import asyncio
import argparse
import logging
import sys
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _get_or_create_customer_from_invitees(
    db: Session,
    workspace_id: str,
    calendar_invitees: List[Dict[str, Any]]
) -> Optional[Any]:
    """
    Stub - Get or create a customer from Fathom calendar invitees.
    """
    logger.debug("_get_or_create_customer_from_invitees called (stub - disabled)")
    return None


async def ingest_fathom_sessions(
    workspace_id: str,
    project_id: Optional[str] = None,
    limit: int = 10,
    days_back: int = 7,
    min_duration_seconds: int = 0,
    extract_features: bool = True,
    api_token: Optional[str] = None
) -> Dict[str, int]:
    """
    Stub - Ingest sessions from Fathom for a specific workspace.

    NOTE: Currently disabled during schema migration.
    """
    logger.warning(
        f"ingest_fathom_sessions called for workspace {workspace_id} "
        f"but Fathom ingestion is disabled during schema migration"
    )
    return {"total_checked": 0, "new_added": 0}


async def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(description="Ingest sessions from Fathom (DISABLED)")

    parser.add_argument("--workspace-id", required=True, help="Workspace ID")
    parser.add_argument("--project-id", help="Fathom project ID")
    parser.add_argument("--limit", type=int, default=10, help="Max sessions")
    parser.add_argument("--days-back", type=int, default=7, help="Days back")
    parser.add_argument("--min-duration", type=int, default=0, help="Min duration")
    parser.add_argument("--no-extract-features", action="store_true", help="Skip AI")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose")

    args = parser.parse_args()

    logger.warning("Fathom session ingestion is currently DISABLED during schema migration")
    logger.info("Please wait until the schema redesign is complete")

    result = await ingest_fathom_sessions(
        workspace_id=args.workspace_id,
        project_id=args.project_id,
        limit=args.limit,
        days_back=args.days_back,
        min_duration_seconds=args.min_duration,
        extract_features=not args.no_extract_features
    )

    logger.info(f"Result: {result}")
    sys.exit(0)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

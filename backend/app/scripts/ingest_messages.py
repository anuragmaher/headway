#!/usr/bin/env python3
"""
Message ingestion script - Stub Version

NOTE: This script is currently disabled as part of the database schema redesign.
The Integration model has been replaced by WorkspaceConnector.
Full implementation will be restored after schema migration is complete.

Usage:
    python -m app.scripts.ingest_messages --workspace-id <uuid>
"""

import asyncio
import argparse
import logging
import sys
from typing import Dict

logger = logging.getLogger(__name__)


async def ingest_integration_messages(integration_id: str, hours_back: int = 24) -> bool:
    """Stub - Ingest messages for a specific integration."""
    logger.warning(
        f"ingest_integration_messages called for integration {integration_id} "
        f"but message ingestion is disabled during schema migration"
    )
    return False


async def ingest_workspace_messages(workspace_id: str, hours_back: int = 24) -> bool:
    """Stub - Ingest messages for all integrations in a workspace."""
    logger.warning(
        f"ingest_workspace_messages called for workspace {workspace_id} "
        f"but message ingestion is disabled during schema migration"
    )
    return False


async def ingest_all_messages(hours_back: int = 24) -> bool:
    """Stub - Ingest messages for all active integrations."""
    logger.warning("ingest_all_messages called but message ingestion is disabled during schema migration")
    return False


async def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(description="Ingest messages (DISABLED)")

    target_group = parser.add_mutually_exclusive_group(required=True)
    target_group.add_argument("--integration-id", help="Integration ID")
    target_group.add_argument("--workspace-id", help="Workspace ID")
    target_group.add_argument("--all", action="store_true", help="All integrations")

    parser.add_argument("--hours-back", type=int, default=24, help="Hours back")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose")

    args = parser.parse_args()

    logger.warning("Message ingestion is currently DISABLED during schema migration")
    logger.info("Please wait until the schema redesign is complete")

    sys.exit(0)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

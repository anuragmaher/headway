#!/usr/bin/env python3
"""
Clean up features and messages from database - Stub Version

NOTE: This script is currently disabled as part of the database schema redesign.
The Feature model has been replaced by CustomerAsk.
Full implementation will be restored after schema migration is complete.

Usage:
    python -m app.scripts.clean_feature_and_messages --workspace-id <uuid>
"""

import asyncio
import argparse
import logging
import sys

logger = logging.getLogger(__name__)


def cleanup_workspace_data(
    workspace_id: str,
    confirm: bool = False,
    verbose: bool = False
) -> bool:
    """
    Stub - Clean up all features and messages for a given workspace.

    NOTE: Currently disabled during schema migration.
    """
    logger.warning(
        f"cleanup_workspace_data called for workspace {workspace_id} "
        f"but cleanup is disabled during schema migration"
    )
    return False


async def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(
        description="Clean up features and messages (DISABLED)"
    )

    parser.add_argument("--workspace-id", required=True, help="Workspace ID")
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose")

    args = parser.parse_args()

    logger.warning("Feature/message cleanup is currently DISABLED during schema migration")
    logger.info("Please wait until the schema redesign is complete")

    sys.exit(0)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

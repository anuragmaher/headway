#!/usr/bin/env python3
"""
Message processing script - Stub Version

NOTE: This script is currently disabled as part of the database schema redesign.
The Integration model has been replaced by WorkspaceConnector.
Full implementation will be restored after schema migration is complete.

Usage:
    python -m app.scripts.process_messages --workspace-id <uuid>
"""

import asyncio
import argparse
import logging
import sys

logger = logging.getLogger(__name__)


async def process_first_message_only() -> bool:
    """Stub - Process only the first unprocessed message."""
    logger.warning("process_first_message_only called but processing is disabled during schema migration")
    return False


async def process_integration_messages(integration_id: str, limit: int = 10) -> bool:
    """Stub - Process messages for a specific integration."""
    logger.warning(
        f"process_integration_messages called for integration {integration_id} "
        f"but processing is disabled during schema migration"
    )
    return False


async def process_workspace_messages(workspace_id: str, limit: int = 10) -> bool:
    """Stub - Process messages for all integrations in a workspace."""
    logger.warning(
        f"process_workspace_messages called for workspace {workspace_id} "
        f"but processing is disabled during schema migration"
    )
    return False


async def process_unprocessed_messages(limit: int = 10) -> bool:
    """Stub - Process unprocessed messages across all integrations."""
    logger.warning("process_unprocessed_messages called but processing is disabled during schema migration")
    return False


async def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(description="Process messages with AI (DISABLED)")

    target_group = parser.add_mutually_exclusive_group(required=True)
    target_group.add_argument("--first-message-only", action="store_true", help="First message")
    target_group.add_argument("--integration-id", help="Integration ID")
    target_group.add_argument("--workspace-id", help="Workspace ID")
    target_group.add_argument("--unprocessed", action="store_true", help="Unprocessed messages")

    parser.add_argument("--limit", type=int, default=10, help="Limit")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose")

    args = parser.parse_args()

    logger.warning("Message processing is currently DISABLED during schema migration")
    logger.info("Please wait until the schema redesign is complete")

    sys.exit(0)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

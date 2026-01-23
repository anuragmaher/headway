"""
Clean messages and customers from the database - Stub Version

NOTE: This script is currently disabled as part of the database schema redesign.
The Feature model has been replaced by CustomerAsk.
Full implementation will be restored after schema migration is complete.

Usage:
    python3 -m app.scripts.clean_messages_and_customers --workspace-id <workspace_id>
"""

import sys
import argparse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def clean_messages_and_customers(workspace_id: str = None, dry_run: bool = False):
    """
    Stub - Delete all messages and customers from the database.

    NOTE: Currently disabled during schema migration.
    """
    logger.warning(
        f"clean_messages_and_customers called but cleanup is disabled during schema migration"
    )
    logger.info("Please wait until the schema redesign is complete")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Clean messages and customers (DISABLED)')
    parser.add_argument('--workspace-id', help='Workspace ID')
    parser.add_argument('--dry-run', action='store_true', help='Dry run')

    args = parser.parse_args()

    logger.warning("Database cleanup is currently DISABLED during schema migration")
    clean_messages_and_customers(args.workspace_id, args.dry_run)

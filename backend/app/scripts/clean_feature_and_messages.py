#!/usr/bin/env python3
"""
Clean up features and messages from database for a fresh run

This script safely removes all feature requests and messages from a workspace
to allow for a fresh ingestion cycle. Handles all foreign key relationships
and provides detailed logging of what was deleted.

Usage:
    python -m app.scripts.clean_feature_and_messages --workspace-id <uuid>
    python -m app.scripts.clean_feature_and_messages --workspace-id <uuid> --confirm
    python -m app.scripts.clean_feature_and_messages --workspace-id <uuid> --verbose
"""

import argparse
import logging
import sys
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import and_

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.models.feature import Feature
from app.models.message import Message
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def cleanup_workspace_data(
    workspace_id: str,
    confirm: bool = False,
    verbose: bool = False
) -> bool:
    """
    Clean up all features and messages for a given workspace.

    Args:
        workspace_id: Workspace UUID to clean up
        confirm: If True, skip confirmation prompt
        verbose: Enable verbose logging

    Returns:
        True if cleanup was successful, False otherwise
    """
    try:
        # Get database session
        db: Session = next(get_db())

        # Verify workspace exists
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            logger.error(f"Workspace {workspace_id} not found")
            return False

        logger.info(f"Cleaning up workspace: {workspace.name} ({workspace_id})")

        # Count existing data
        feature_count = db.query(Feature).filter(Feature.workspace_id == workspace_id).count()
        message_count = db.query(Message).filter(Message.workspace_id == workspace_id).count()

        logger.info(f"Found {feature_count} features and {message_count} messages to delete")

        if feature_count == 0 and message_count == 0:
            logger.info("✓ Workspace is already clean (no features or messages to delete)")
            return True

        # Ask for confirmation
        if not confirm:
            print("\n" + "=" * 70)
            print(f"WARNING: This will permanently delete:")
            print(f"  - {feature_count} features")
            print(f"  - {message_count} messages")
            print(f"  - All associations between them")
            print(f"\nWorkspace: {workspace.name}")
            print("=" * 70)

            user_input = input("\nAre you sure you want to continue? Type 'yes' to confirm: ").strip().lower()
            if user_input != "yes":
                logger.info("Cleanup cancelled by user")
                return False

        try:
            # Delete features first (will cascade delete feature_messages associations)
            # This works because feature_messages has foreign keys to features
            features_to_delete = db.query(Feature).filter(Feature.workspace_id == workspace_id).all()

            deleted_feature_count = 0
            for feature in features_to_delete:
                if verbose:
                    logger.debug(f"Deleting feature: {feature.name} (ID: {feature.id})")
                db.delete(feature)
                deleted_feature_count += 1

            logger.info(f"Deleted {deleted_feature_count} features")

            # Delete messages (the feature_messages associations were already removed)
            messages_to_delete = db.query(Message).filter(Message.workspace_id == workspace_id).all()

            deleted_message_count = 0
            for message in messages_to_delete:
                if verbose:
                    logger.debug(f"Deleting message: {message.external_id} from {message.source}")
                db.delete(message)
                deleted_message_count += 1

            logger.info(f"Deleted {deleted_message_count} messages")

            # Commit all changes
            db.commit()
            logger.info("✓ Cleanup completed successfully")
            logger.info(f"  - Deleted {deleted_feature_count} features")
            logger.info(f"  - Deleted {deleted_message_count} messages")

            return True

        except Exception as e:
            logger.error(f"Error during deletion: {e}")
            db.rollback()
            logger.error("Rolled back all changes due to error")
            return False

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error in cleanup_workspace_data: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Main function to handle command line arguments and run cleanup"""
    parser = argparse.ArgumentParser(
        description="Clean up features and messages from database for a fresh run"
    )

    parser.add_argument(
        "--workspace-id",
        required=True,
        help="Workspace ID to clean up"
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Skip confirmation prompt and proceed with deletion"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging (shows each deleted item)"
    )

    args = parser.parse_args()

    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")

    logger.info("Starting cleanup of features and messages")
    logger.info(f"Workspace ID: {args.workspace_id}")
    logger.info(f"Confirm: {args.confirm}")

    try:
        success = cleanup_workspace_data(
            workspace_id=args.workspace_id,
            confirm=args.confirm,
            verbose=args.verbose
        )

        if success:
            logger.info("✅ Cleanup completed successfully!")
            sys.exit(0)
        else:
            logger.warning("❌ Cleanup failed or was cancelled")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Cleanup interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

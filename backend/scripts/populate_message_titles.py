"""
One-time migration script to populate message titles from message_metadata.

This script extracts titles from messages based on their source type:
- Gong: Extracts from message_metadata['call_title']
- Fathom: Extracts from message_metadata['meeting_title']
- Email: Extracts from message_metadata['subject']
- Slack: Uses channel name or first 80 chars of content

Run this script once after the database migration to populate existing messages:
  python scripts/populate_message_titles.py
"""

import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.message import Message
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def extract_title_from_metadata(message: Message) -> str | None:
    """Extract title from message metadata based on source type."""

    if not message.message_metadata:
        return None

    metadata = message.message_metadata
    source = message.source.lower() if message.source else ""

    # Gong: extract call title
    if source == "gong":
        title = metadata.get("call_title") or metadata.get("title")
        if title:
            return title[:255]  # Limit to VARCHAR length

    # Fathom: extract meeting title
    elif source == "fathom":
        title = metadata.get("meeting_title") or metadata.get("title")
        if title:
            return title[:255]

    # Email: extract subject
    elif source == "email":
        title = metadata.get("subject")
        if title:
            return title[:255]

    # Slack: use thread subject if available, otherwise use channel name
    elif source == "slack":
        # Check for thread subject in metadata
        title = metadata.get("thread_subject") or metadata.get("subject")
        if title:
            return title[:255]
        # Fallback to channel name
        if message.channel_name:
            return f"#{message.channel_name}"[:255]

    return None


def populate_titles(dry_run: bool = True):
    """Populate message titles from existing data."""

    # Create database engine
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Query all messages without titles
        messages = session.query(Message).filter(
            Message.title == None
        ).all()

        logger.info(f"Found {len(messages)} messages without titles")

        updated_count = 0
        skipped_count = 0

        for message in messages:
            title = extract_title_from_metadata(message)

            if title:
                logger.info(
                    f"Message {message.id}: {message.source} -> '{title}'"
                )
                if not dry_run:
                    message.title = title
                updated_count += 1
            else:
                skipped_count += 1

        if dry_run:
            logger.info(
                f"\nDRY RUN: Would update {updated_count} messages, "
                f"skip {skipped_count} messages"
            )
        else:
            # Commit changes
            session.commit()
            logger.info(
                f"\nSUCCESS: Updated {updated_count} messages, "
                f"skipped {skipped_count} messages"
            )

    except Exception as e:
        session.rollback()
        logger.error(f"Error during migration: {str(e)}")
        raise

    finally:
        session.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Populate message titles from metadata"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute the migration (default is dry-run)"
    )

    args = parser.parse_args()

    if args.execute:
        logger.info("Running migration in EXECUTE mode...")
        populate_titles(dry_run=False)
    else:
        logger.info("Running migration in DRY-RUN mode...")
        populate_titles(dry_run=True)
        logger.info("\nTo actually update the database, run with --execute flag:")
        logger.info("  python scripts/populate_message_titles.py --execute")

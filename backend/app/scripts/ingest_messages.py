#!/usr/bin/env python3
"""
Message ingestion script for HeadwayHQ

This script fetches messages from connected integrations (currently Slack)
and stores them in the database for AI processing.

Usage:
    python -m app.scripts.ingest_messages --integration-id <uuid>
    python -m app.scripts.ingest_messages --all
    python -m app.scripts.ingest_messages --workspace-id <uuid>
"""

import asyncio
import argparse
import logging
import sys
from typing import List, Optional
from sqlalchemy.orm import Session

# Add the parent directory to the path
sys.path.append('/Users/anurag/headway/backend')

from app.core.database import get_db
from app.models.integration import Integration
from app.models.workspace import Workspace
from app.services.message_ingestion_service import message_ingestion_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def ingest_integration_messages(integration_id: str, hours_back: int = 24) -> bool:
    """
    Ingest messages for a specific integration
    
    Args:
        integration_id: Integration UUID
        hours_back: How many hours back to fetch messages
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get database session
        db: Session = next(get_db())
        
        logger.info(f"Starting message ingestion for integration {integration_id}")
        
        # Check if integration exists
        integration = db.query(Integration).filter(Integration.id == integration_id).first()
        if not integration:
            logger.error(f"Integration {integration_id} not found")
            return False
        
        if not integration.is_active:
            logger.warning(f"Integration {integration_id} is not active, skipping")
            return False
        
        logger.info(f"Found integration: {integration.name} ({integration.provider})")
        
        # Ingest messages based on provider
        if integration.provider == "slack":
            count = await message_ingestion_service.ingest_slack_messages(
                integration_id=str(integration.id),
                db=db,
                hours_back=hours_back
            )
            logger.info(f"Successfully ingested {count} messages for integration {integration_id}")
            return True
        else:
            logger.warning(f"Provider {integration.provider} not supported yet")
            return False
            
    except Exception as e:
        logger.error(f"Error ingesting messages for integration {integration_id}: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


async def ingest_workspace_messages(workspace_id: str, hours_back: int = 24) -> bool:
    """
    Ingest messages for all integrations in a workspace
    
    Args:
        workspace_id: Workspace UUID
        hours_back: How many hours back to fetch messages
        
    Returns:
        True if at least one integration succeeded
    """
    try:
        # Get database session
        db: Session = next(get_db())
        
        logger.info(f"Starting message ingestion for workspace {workspace_id}")
        
        # Get all active integrations for the workspace
        integrations = db.query(Integration).filter(
            Integration.workspace_id == workspace_id,
            Integration.is_active == True
        ).all()
        
        if not integrations:
            logger.warning(f"No active integrations found for workspace {workspace_id}")
            return False
        
        logger.info(f"Found {len(integrations)} active integrations")
        
        success_count = 0
        for integration in integrations:
            logger.info(f"Processing integration: {integration.name} ({integration.provider})")
            
            if integration.provider == "slack":
                count = await message_ingestion_service.ingest_slack_messages(
                    integration_id=str(integration.id),
                    db=db,
                    hours_back=hours_back
                )
                if count > 0:
                    success_count += 1
                    logger.info(f"Ingested {count} messages from {integration.name}")
            else:
                logger.warning(f"Provider {integration.provider} not supported yet")
        
        logger.info(f"Successfully processed {success_count}/{len(integrations)} integrations")
        return success_count > 0
        
    except Exception as e:
        logger.error(f"Error ingesting messages for workspace {workspace_id}: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


async def ingest_all_messages(hours_back: int = 24) -> bool:
    """
    Ingest messages for all active integrations in all workspaces
    
    Args:
        hours_back: How many hours back to fetch messages
        
    Returns:
        True if at least one integration succeeded
    """
    try:
        # Get database session
        db: Session = next(get_db())
        
        logger.info("Starting message ingestion for ALL active integrations")
        
        # Get all active integrations
        integrations = db.query(Integration).filter(
            Integration.is_active == True
        ).all()
        
        if not integrations:
            logger.warning("No active integrations found")
            return False
        
        logger.info(f"Found {len(integrations)} active integrations across all workspaces")
        
        success_count = 0
        for integration in integrations:
            logger.info(f"Processing integration: {integration.name} ({integration.provider}) in workspace {integration.workspace_id}")
            
            if integration.provider == "slack":
                count = await message_ingestion_service.ingest_slack_messages(
                    integration_id=str(integration.id),
                    db=db,
                    hours_back=hours_back
                )
                if count > 0:
                    success_count += 1
                    logger.info(f"Ingested {count} messages from {integration.name}")
            else:
                logger.warning(f"Provider {integration.provider} not supported yet")
        
        logger.info(f"Successfully processed {success_count}/{len(integrations)} integrations")
        return success_count > 0
        
    except Exception as e:
        logger.error(f"Error in ingest_all_messages: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


async def main():
    """Main function to handle command line arguments and run ingestion"""
    parser = argparse.ArgumentParser(description="Ingest messages from connected integrations")
    
    # Mutually exclusive group for target selection
    target_group = parser.add_mutually_exclusive_group(required=True)
    target_group.add_argument("--integration-id", help="Specific integration ID to ingest")
    target_group.add_argument("--workspace-id", help="Workspace ID to ingest all integrations for")
    target_group.add_argument("--all", action="store_true", help="Ingest from all active integrations")
    
    # Optional arguments
    parser.add_argument("--hours-back", type=int, default=24, help="How many hours back to fetch messages (default: 24)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")
    
    logger.info(f"Starting message ingestion (looking back {args.hours_back} hours)")
    
    success = False
    
    try:
        if args.integration_id:
            success = await ingest_integration_messages(args.integration_id, args.hours_back)
        elif args.workspace_id:
            success = await ingest_workspace_messages(args.workspace_id, args.hours_back)
        elif args.all:
            success = await ingest_all_messages(args.hours_back)
        
        if success:
            logger.info("Message ingestion completed successfully!")
            sys.exit(0)
        else:
            logger.error("Message ingestion failed or no messages found")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Message ingestion interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
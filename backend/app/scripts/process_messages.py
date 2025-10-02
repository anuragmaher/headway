#!/usr/bin/env python3
"""
Message processing script for HeadwayHQ

This script processes ingested messages using AI to extract feature requests
and insights for product teams.

Usage:
    python -m app.scripts.process_messages --first-message-only
    python -m app.scripts.process_messages --integration-id <uuid>
    python -m app.scripts.process_messages --workspace-id <uuid>
    python -m app.scripts.process_messages --unprocessed --limit 10
"""

import asyncio
import argparse
import logging
import sys
import json
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# Add the parent directory to the path
sys.path.append('/Users/anurag/headway/backend')

from app.core.database import get_db
from app.models.message import Message
from app.models.integration import Integration
from app.models.workspace import Workspace
from app.services.ai_processing_service import ai_processing_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def process_first_message_only() -> bool:
    """
    Process only the first unprocessed message (for testing)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get database session
        db: Session = next(get_db())
        
        logger.info("Finding first unprocessed message...")
        
        # Get the first unprocessed message
        message = db.query(Message).filter(
            Message.is_processed == False
        ).first()
        
        if not message:
            logger.warning("No unprocessed messages found")
            return False
        
        logger.info(f"Processing message ID: {message.id}")
        logger.info(f"Message content preview: {message.content[:200]}...")
        
        # Process the message
        result = ai_processing_service.process_message(message)
        
        # Print the result
        print("\n" + "="*60)
        print("AI PROCESSING RESULT")
        print("="*60)
        print(json.dumps(result, indent=2, default=str))
        print("="*60)
        
        # Mark message as processed (for now just log, don't update DB)
        logger.info(f"Message {message.id} processed successfully!")
        logger.info(f"Feature request detected: {result.get('is_feature_request', False)}")
        logger.info(f"Confidence: {result.get('confidence', 0):.2f}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error processing first message: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


async def process_integration_messages(integration_id: str, limit: int = 10) -> bool:
    """
    Process messages for a specific integration
    
    Args:
        integration_id: Integration UUID
        limit: Maximum number of messages to process
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get database session
        db: Session = next(get_db())
        
        logger.info(f"Processing messages for integration {integration_id}")
        
        # Get unprocessed messages for the integration
        messages = db.query(Message).filter(
            and_(
                Message.integration_id == integration_id,
                Message.is_processed == False
            )
        ).limit(limit).all()
        
        if not messages:
            logger.warning(f"No unprocessed messages found for integration {integration_id}")
            return False
        
        logger.info(f"Found {len(messages)} unprocessed messages")
        
        # Process messages in batch
        results = []
        for i, message in enumerate(messages, 1):
            logger.info(f"Processing message {i}/{len(messages)}: {message.id}")
            
            try:
                result = ai_processing_service.process_message(message)
                results.append(result)
                
                # Log key insights
                if result.get('is_feature_request', False):
                    logger.info(f"  ✅ Feature request detected - {result.get('feature_title', 'No title')}")
                else:
                    logger.info(f"  ❌ Not a feature request")
                    
            except Exception as e:
                logger.error(f"  ⚠️ Failed to process message {message.id}: {e}")
        
        # Print summary statistics
        stats = ai_processing_service.get_processing_stats(results)
        print("\n" + "="*60)
        print("PROCESSING SUMMARY")
        print("="*60)
        print(json.dumps(stats, indent=2))
        print("="*60)
        
        return True
        
    except Exception as e:
        logger.error(f"Error processing integration messages: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


async def process_workspace_messages(workspace_id: str, limit: int = 10) -> bool:
    """
    Process messages for all integrations in a workspace
    
    Args:
        workspace_id: Workspace UUID
        limit: Maximum number of messages to process per integration
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get database session
        db: Session = next(get_db())
        
        logger.info(f"Processing messages for workspace {workspace_id}")
        
        # Get all integrations for the workspace
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
            logger.info(f"Processing integration: {integration.name}")
            
            success = await process_integration_messages(str(integration.id), limit)
            if success:
                success_count += 1
        
        logger.info(f"Successfully processed {success_count}/{len(integrations)} integrations")
        return success_count > 0
        
    except Exception as e:
        logger.error(f"Error processing workspace messages: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


async def process_unprocessed_messages(limit: int = 10) -> bool:
    """
    Process unprocessed messages across all integrations
    
    Args:
        limit: Maximum number of messages to process
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get database session
        db: Session = next(get_db())
        
        logger.info("Processing unprocessed messages across all integrations")
        
        # Get unprocessed messages
        messages = db.query(Message).filter(
            Message.is_processed == False
        ).limit(limit).all()
        
        if not messages:
            logger.warning("No unprocessed messages found")
            return False
        
        logger.info(f"Found {len(messages)} unprocessed messages")
        
        # Process messages
        results = []
        for i, message in enumerate(messages, 1):
            logger.info(f"Processing message {i}/{len(messages)}: {message.id}")
            
            try:
                result = ai_processing_service.process_message(message)
                results.append(result)
                
                # Log key insights
                if result.get('is_feature_request', False):
                    logger.info(f"  ✅ Feature request: {result.get('feature_title', 'No title')}")
                    logger.info(f"     Category: {result.get('category', 'Unknown')}")
                    logger.info(f"     Priority: {result.get('priority', 'Unknown')}")
                else:
                    logger.info(f"  ❌ Not a feature request")
                    
            except Exception as e:
                logger.error(f"  ⚠️ Failed to process message {message.id}: {e}")
        
        # Print summary
        stats = ai_processing_service.get_processing_stats(results)
        print("\n" + "="*60)
        print("PROCESSING SUMMARY")
        print("="*60)
        print(json.dumps(stats, indent=2))
        print("="*60)
        
        return True
        
    except Exception as e:
        logger.error(f"Error processing unprocessed messages: {e}")
        return False
    finally:
        if 'db' in locals():
            db.close()


async def main():
    """Main function to handle command line arguments and run processing"""
    parser = argparse.ArgumentParser(description="Process messages with AI to extract feature requests")
    
    # Mutually exclusive group for target selection
    target_group = parser.add_mutually_exclusive_group(required=True)
    target_group.add_argument("--first-message-only", action="store_true", help="Process only the first unprocessed message (for testing)")
    target_group.add_argument("--integration-id", help="Specific integration ID to process")
    target_group.add_argument("--workspace-id", help="Workspace ID to process all integrations for")
    target_group.add_argument("--unprocessed", action="store_true", help="Process unprocessed messages across all integrations")
    
    # Optional arguments
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of messages to process (default: 10)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")
    
    logger.info("Starting message processing with AI...")
    
    success = False
    
    try:
        if args.first_message_only:
            success = await process_first_message_only()
        elif args.integration_id:
            success = await process_integration_messages(args.integration_id, args.limit)
        elif args.workspace_id:
            success = await process_workspace_messages(args.workspace_id, args.limit)
        elif args.unprocessed:
            success = await process_unprocessed_messages(args.limit)
        
        if success:
            logger.info("Message processing completed successfully!")
            sys.exit(0)
        else:
            logger.error("Message processing failed or no messages found")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Message processing interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
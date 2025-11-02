#!/usr/bin/env python3
"""
Fathom session ingestion script for HeadwayHQ

This script fetches session recordings from Fathom and stores them in the database
for AI processing. It extracts user behavior patterns and generates insights.

Usage:
    python -m app.scripts.ingest_fathom_sessions --workspace-id <uuid> --project-id <id> --limit 10
    python -m app.scripts.ingest_fathom_sessions --workspace-id <uuid> --project-id <id> --days-back 7
"""

import asyncio
import argparse
import logging
import sys
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import and_

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.core.config import settings
from app.models.integration import Integration
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.models.customer import Customer
from app.services.fathom_ingestion_service import get_fathom_ingestion_service
from app.services.transcript_ingestion_service import get_transcript_ingestion_service
from app.services.workspace_service import WorkspaceService
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _get_or_create_customer_from_invitees(
    db: Session,
    workspace_id: str,
    calendar_invitees: List[Dict[str, Any]]
) -> Optional[Customer]:
    """
    Get or create a customer from Fathom calendar invitees.

    Uses the is_external flag to identify external participants (customers)
    and creates customer records based on their email domain.

    Args:
        db: Database session
        workspace_id: Workspace UUID
        calendar_invitees: List of calendar invitee objects from Fathom

    Returns:
        Customer instance for the first external invitee, or None if no external invitees
    """
    if not calendar_invitees:
        return None

    # Find first external invitee (customer)
    external_invitees = [
        invitee for invitee in calendar_invitees
        if invitee.get('is_external', False)
    ]

    if not external_invitees:
        logger.debug("No external invitees found - all participants are internal")
        return None

    # Use the first external invitee as the customer
    invitee = external_invitees[0]

    email = invitee.get('email')
    name = invitee.get('name', '')
    domain = invitee.get('email_domain')

    if not email or not domain:
        logger.warning(f"External invitee missing email or domain: {invitee}")
        return None

    domain = domain.lower()

    # Try to find existing customer by domain
    customer = db.query(Customer).filter(
        and_(
            Customer.workspace_id == workspace_id,
            Customer.domain == domain
        )
    ).first()

    if customer:
        # Update last activity timestamp
        customer.last_activity_at = datetime.now(timezone.utc)

        # Update contact info if not already set
        if not customer.contact_name and name:
            customer.contact_name = name
        if not customer.contact_email and email:
            customer.contact_email = email

        logger.debug(f"Found existing customer: {customer.name} ({domain})")
        return customer

    # Create new customer from invitee data
    # Use domain as company name (e.g., "acme.com" -> "Acme")
    company_name = domain.split('.')[0].capitalize()

    customer = Customer(
        workspace_id=workspace_id,
        name=company_name,
        domain=domain,
        contact_name=name,  # Store contact person's name
        contact_email=email,  # Store contact person's email
        external_system='fathom',
        external_id=domain,  # Use domain as unique ID for Fathom
        last_activity_at=datetime.now(timezone.utc)
    )
    db.add(customer)
    logger.info(f"Created new customer from external invitee: {company_name} ({domain}) - Contact: {name} ({email})")

    return customer


async def ingest_fathom_sessions(
    workspace_id: str,
    project_id: Optional[str] = None,
    limit: int = 10,
    days_back: int = 7,
    min_duration_seconds: int = 0,
    extract_features: bool = True,
    api_token: Optional[str] = None
) -> int:
    """
    Ingest sessions from Fathom for a specific workspace

    Args:
        workspace_id: Workspace UUID
        project_id: Fathom project ID (optional, can come from config)
        limit: Maximum number of sessions to fetch
        days_back: How many days back to fetch sessions
        min_duration_seconds: Minimum session duration to include
        extract_features: Whether to run AI extraction
        api_token: Fathom API token (optional, uses connector if not provided)

    Returns:
        Number of sessions ingested
    """
    try:
        # Get database session
        db: Session = next(get_db())

        # Verify workspace exists
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            logger.error(f"Workspace {workspace_id} not found")
            return 0

        # Use provided credentials or get from workspace connector
        if not api_token:
            workspace_service = WorkspaceService(db)
            fathom_connector = workspace_service.get_connector_by_type(workspace_id, "fathom")

            if not fathom_connector:
                logger.error(f"Fathom connector not configured for workspace {workspace_id}")
                logger.error("Please configure Fathom credentials in workspace settings")
                return 0

            # Extract credentials from JSONB
            credentials = fathom_connector.credentials or {}
            api_token = credentials.get('api_token')

        fathom_project_id = project_id  # Use provided project_id or fall back to settings

        if not api_token:
            logger.error(f"Fathom API token not configured for workspace {workspace_id}")
            return 0

        if not fathom_project_id:
            # Try to get from settings as fallback
            fathom_project_id = settings.FATHOM_PROJECT_ID or os.getenv('FATHOM_PROJECT_ID')
            if not fathom_project_id:
                logger.error("Fathom project ID not found. Please provide --project-id or set FATHOM_PROJECT_ID")
                return 0

        logger.info(f"Using Fathom credentials from workspace connector")

        # Initialize Fathom service
        fathom_service = get_fathom_ingestion_service(api_token)

        try:

            logger.info(f"Starting Fathom session ingestion for workspace: {workspace.name}")

            # Get or create Fathom integration
            integration = db.query(Integration).filter(
                and_(
                    Integration.workspace_id == workspace_id,
                    Integration.provider == "fathom"
                )
            ).first()

            if not integration:
                logger.info("Creating new Fathom integration record")
                integration = Integration(
                    name="Fathom",
                    provider="fathom",
                    is_active=True,
                    workspace_id=workspace_id,
                    provider_metadata={
                        "ingestion_method": "api",
                        "project_id": fathom_project_id
                    },
                    sync_status="pending"
                )
                db.add(integration)
                db.commit()
                db.refresh(integration)
                logger.info(f"Created integration with ID: {integration.id}")

            # Calculate date range
            to_date = datetime.now(timezone.utc)
            from_date = to_date - timedelta(days=days_back)

            # Fetch sessions from Fathom
            logger.info(f"Fetching up to {limit} sessions from last {days_back} days")
            sessions = fathom_service.fetch_sessions(
                project_id=fathom_project_id,
                from_date=from_date,
                to_date=to_date,
                limit=limit,
                min_duration_seconds=min_duration_seconds
            )

            if not sessions:
                logger.warning("No sessions found in the specified date range")
                return 0

            # Initialize transcript ingestion service
            transcript_service = get_transcript_ingestion_service(db)

            # Process and store sessions
            ingested_count = 0
            skipped_count = 0

            for session_data in sessions:
                try:
                    # Fathom uses recording_id as unique identifier
                    session_id = str(session_data.get('recording_id'))

                    if not session_id or session_id == 'None':
                        logger.warning("Session has no recording_id, skipping")
                        continue

                    # Extract session information
                    title = session_data.get('title') or f"Session {session_id}"
                    # Get user info from recorded_by
                    recorded_by = session_data.get('recorded_by', {})
                    user_email = recorded_by.get('email')
                    user_name = recorded_by.get('name') or user_email or 'Unknown'

                    # Store calendar invitees for later customer creation (only if message is ingested)
                    calendar_invitees = session_data.get('calendar_invitees', [])

                    # Calculate duration from recording timestamps
                    recording_start = session_data.get('recording_start_time')
                    recording_end = session_data.get('recording_end_time')
                    duration_seconds = 0
                    try:
                        if recording_start and recording_end:
                            start = datetime.fromisoformat(recording_start.replace('Z', '+00:00'))
                            end = datetime.fromisoformat(recording_end.replace('Z', '+00:00'))
                            duration_seconds = int((end - start).total_seconds())
                    except (ValueError, AttributeError):
                        pass
                    recording_url = session_data.get('share_url')
                    created_at = session_data.get('created_at')

                    # Parse session timestamp
                    try:
                        if created_at:
                            session_time = datetime.fromisoformat(
                                created_at.replace('Z', '+00:00') if isinstance(created_at, str) else str(created_at)
                            )
                        else:
                            session_time = datetime.now(timezone.utc)
                    except (ValueError, AttributeError):
                        session_time = datetime.now(timezone.utc)

                    # Extract transcript from session data (already included with include_transcript=true)
                    transcript_text = ""
                    transcript_data = session_data.get('transcript')

                    if transcript_data:
                        # Transcript comes as a list of speaker objects with text and timestamps
                        if isinstance(transcript_data, list):
                            # Convert transcript list to readable text format
                            transcript_parts = []
                            for item in transcript_data:
                                speaker_name = item.get('speaker', {}).get('display_name', 'Unknown')
                                text = item.get('text', '')
                                if text:
                                    transcript_parts.append(f"{speaker_name}: {text}")
                            transcript_text = "\n".join(transcript_parts)
                            logger.debug(f"Extracted transcript for session {session_id}: {len(transcript_parts)} speaker turns")
                        elif isinstance(transcript_data, str):
                            transcript_text = transcript_data
                            logger.debug(f"Retrieved transcript for session {session_id}")
                    else:
                        logger.debug(f"No transcript available for session {session_id}")

                    # Extract key features and metadata
                    session_features = fathom_service.extract_session_features(session_data)

                    # Try to get interaction events
                    events = []
                    try:
                        events = fathom_service.fetch_session_events(session_id) or []
                    except Exception as e:
                        logger.debug(f"Could not fetch events for session {session_id}: {e}")

                    # Prepare message metadata with Fathom-specific data
                    message_metadata = {
                        "session_id": session_id,
                        "title": title,
                        "recording_url": recording_url,
                        "user_email": user_email,
                        "user_name": user_name,
                        "duration_seconds": duration_seconds,
                        "created_at": created_at,
                        "page_url": session_data.get('page_url'),
                        "device_type": session_data.get('device_type'),
                        "browser": session_data.get('browser'),
                        "os": session_data.get('os'),
                        "rage_clicks": session_data.get('rage_clicks', 0),
                        "error_clicks": session_data.get('error_clicks', 0),
                        "dead_clicks": session_data.get('dead_clicks', 0),
                        "frustrated_gestures": session_data.get('frustrated_gestures', 0),
                        "events_count": len(events),
                        "tags": session_data.get('tags', []),
                        "has_transcript": bool(transcript_text),
                        "raw_session_data": session_data,
                        "calendar_invitees": calendar_invitees  # Pass for customer creation if message is ingested
                    }

                    # Use transcript ingestion service to handle processing
                    # Customer will be created inside if message is actually ingested
                    message_id = transcript_service.ingest_transcript(
                        workspace_id=workspace_id,
                        external_id=session_id,
                        transcript_text=transcript_text,
                        source="fathom",
                        metadata=message_metadata,
                        channel_name="Fathom Sessions",
                        channel_id="fathom_sessions",
                        author_name=user_name,
                        author_email=user_email,
                        author_id=None,
                        customer_id=None,  # Will be created inside if message is ingested
                        sent_at=session_time,
                        integration_id=integration.id,
                        extract_features=extract_features
                    )

                    if message_id:
                        ingested_count += 1
                        logger.info(f"Ingested session: {title} (ID: {session_id})")
                    else:
                        skipped_count += 1

                except Exception as e:
                    logger.error(f"Error processing session {session_data.get('id', 'unknown')}: {e}")
                    db.rollback()  # Rollback on error to keep connection healthy
                    continue

            # Log final summary
            if ingested_count > 0:
                logger.info(f"Successfully ingested {ingested_count} sessions to database")

            if skipped_count > 0:
                logger.info(f"Skipped {skipped_count} sessions that were already ingested")

            # Update integration sync status
            integration.last_synced_at = datetime.now(timezone.utc)
            integration.sync_status = "success"
            integration.sync_error = None
            db.commit()

            return ingested_count

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error in ingest_fathom_sessions: {e}")
        import traceback
        traceback.print_exc()
        return 0


async def main():
    """Main function to handle command line arguments and run ingestion"""
    parser = argparse.ArgumentParser(description="Ingest sessions from Fathom")

    parser.add_argument("--workspace-id", required=True, help="Workspace ID to ingest sessions for")
    parser.add_argument("--project-id", help="Fathom project ID (optional, can use FATHOM_PROJECT_ID env var)")
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of sessions to fetch (default: 10)")
    parser.add_argument("--days-back", type=int, default=7, help="How many days back to fetch sessions (default: 7)")
    parser.add_argument("--min-duration", type=int, default=0, help="Minimum session duration in seconds (default: 0)")
    parser.add_argument("--no-extract-features", action="store_true", help="Skip AI feature extraction (faster)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")

    logger.info("Starting Fathom session ingestion")
    logger.info(f"Workspace ID: {args.workspace_id}")
    logger.info(f"Project ID: {args.project_id or 'from environment'}")
    logger.info(f"Limit: {args.limit} sessions")
    logger.info(f"Looking back: {args.days_back} days")
    logger.info(f"Minimum duration: {args.min_duration} seconds")
    logger.info(f"Extract features with AI: {not args.no_extract_features}")

    try:
        count = await ingest_fathom_sessions(
            workspace_id=args.workspace_id,
            project_id=args.project_id,
            limit=args.limit,
            days_back=args.days_back,
            min_duration_seconds=args.min_duration,
            extract_features=not args.no_extract_features
        )

        if count > 0:
            logger.info(f"✅ Successfully ingested {count} sessions from Fathom!")
            sys.exit(0)
        else:
            logger.warning("⚠️  No sessions were ingested")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Fathom ingestion interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

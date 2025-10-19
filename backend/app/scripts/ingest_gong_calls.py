#!/usr/bin/env python3
"""
Gong call ingestion script for HeadwayHQ

This script fetches call recordings from Gong and stores them in the database
for AI processing. It fetches both call metadata and transcripts.

Usage:
    python -m app.scripts.ingest_gong_calls --workspace-id <uuid> --limit 10
    python -m app.scripts.ingest_gong_calls --workspace-id <uuid> --days-back 7
"""

import asyncio
import argparse
import logging
import sys
import os
import requests
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import and_

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.integration import Integration
from app.models.message import Message
from app.models.workspace import Workspace
from app.models.customer import Customer
from app.models.theme import Theme
from app.services.ai_extraction_service import get_ai_extraction_service
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GongIngestionService:
    """Service for ingesting calls from Gong"""

    def __init__(self, access_key: str, secret_key: str, base_url: str):
        self.access_key = access_key
        self.secret_key = secret_key
        self.base_url = base_url.rstrip('/')
        self.auth = (access_key, secret_key)

    def fetch_calls(
        self,
        from_date: datetime,
        to_date: datetime,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Fetch calls from Gong API with participant details

        Args:
            from_date: Start date for call retrieval
            to_date: End date for call retrieval
            limit: Maximum number of calls to retrieve

        Returns:
            List of call objects with participant information
        """
        try:
            # Format dates in ISO 8601 format as required by Gong
            from_datetime = from_date.strftime('%Y-%m-%dT%H:%M:%S-00:00')
            to_datetime = to_date.strftime('%Y-%m-%dT%H:%M:%S-00:00')

            # Use /v2/calls/extensive to get participant names
            url = f"{self.base_url}/v2/calls/extensive"

            headers = {
                "Content-Type": "application/json"
            }

            # Request body with contentSelector to include parties
            payload = {
                "filter": {
                    "fromDateTime": from_datetime,
                    "toDateTime": to_datetime
                },
                "contentSelector": {
                    "context": "Extended",
                    "exposedFields": {
                        "parties": True,  # This returns participant names
                        "content": {
                            "structure": True
                        },
                        "interaction": {
                            "speakers": True
                        }
                    }
                }
            }

            logger.info(f"Fetching calls from Gong API: {url}")
            logger.info(f"Date range: {from_datetime} to {to_datetime}")

            response = requests.post(
                url,
                auth=self.auth,
                headers=headers,
                json=payload,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            # Gong API returns calls in a 'calls' array
            calls = data.get('calls', [])

            # Limit the number of calls
            calls = calls[:limit]

            logger.info(f"Successfully fetched {len(calls)} calls from Gong")
            return calls

        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching calls from Gong API: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            raise

    def fetch_call_transcript(self, call_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch transcript for a specific call

        Args:
            call_id: Gong call ID

        Returns:
            Transcript data or None if not available
        """
        try:
            url = f"{self.base_url}/v2/calls/transcript"

            headers = {
                "Content-Type": "application/json"
            }

            payload = {
                "filter": {
                    "callIds": [call_id]
                }
            }

            logger.debug(f"Fetching transcript for call {call_id}")

            response = requests.post(
                url,
                auth=self.auth,
                headers=headers,
                json=payload,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            # Get the first transcript (should only be one)
            transcripts = data.get('callTranscripts', [])
            if transcripts:
                return transcripts[0]

            return None

        except requests.exceptions.RequestException as e:
            logger.warning(f"Could not fetch transcript for call {call_id}: {e}")
            return None


def _get_or_create_customer(
    db: Session,
    workspace_id: str,
    hubspot_data: Dict[str, Any]
) -> Optional[Customer]:
    """
    Get or create a Customer record from HubSpot context data

    Args:
        db: Database session
        workspace_id: Workspace UUID
        hubspot_data: Extracted HubSpot context

    Returns:
        Customer instance or None if no account data
    """
    accounts = hubspot_data.get('accounts', [])
    deals = hubspot_data.get('deals', [])

    if not accounts:
        return None

    # Use the first account (primary)
    account = accounts[0]

    # Try to find existing customer by external_id or domain
    external_id = account.get('object_id')
    domain = account.get('domain')

    customer = None
    if external_id:
        customer = db.query(Customer).filter(
            and_(
                Customer.workspace_id == workspace_id,
                Customer.external_system == 'hubspot',
                Customer.external_id == external_id
            )
        ).first()

    if not customer and domain:
        customer = db.query(Customer).filter(
            and_(
                Customer.workspace_id == workspace_id,
                Customer.domain == domain
            )
        ).first()

    # Get deal information if available
    deal_amount = None
    deal_stage = None
    deal_close_date = None
    deal_probability = None
    mrr = None
    arr = None

    if deals:
        deal = deals[0]  # Use first deal
        deal_amount = deal.get('amount')
        deal_stage = deal.get('stage')
        deal_close_date = deal.get('close_date')
        deal_probability = deal.get('probability')

        # Parse close_date if it's a timestamp
        if deal_close_date and isinstance(deal_close_date, (int, float)):
            deal_close_date = datetime.fromtimestamp(deal_close_date, timezone.utc)

    # Look for MRR/ARR in account custom fields (common in HubSpot)
    account_fields = account.get('all_fields', {})

    # Try different common field names for MRR
    mrr_field_names = ['mrr', 'monthly_recurring_revenue', 'monthly_revenue', 'MRR']
    for field_name in mrr_field_names:
        if field_name in account_fields:
            try:
                mrr = float(account_fields[field_name])
                break
            except (ValueError, TypeError):
                pass

    # Try different common field names for ARR
    arr_field_names = ['arr', 'annual_recurring_revenue', 'annual_revenue', 'ARR',
                       'annualized_contract_value', 'acv']
    for field_name in arr_field_names:
        if field_name in account_fields:
            try:
                arr = float(account_fields[field_name])
                break
            except (ValueError, TypeError):
                pass

    if customer:
        # Update existing customer
        customer.name = account.get('name') or customer.name
        customer.domain = domain or customer.domain
        customer.industry = account.get('industry') or customer.industry
        customer.website = account.get('website') or customer.website
        customer.phone = account.get('phone') or customer.phone
        customer.mrr = mrr if mrr is not None else customer.mrr
        customer.arr = arr if arr is not None else customer.arr
        customer.deal_amount = deal_amount if deal_amount else customer.deal_amount
        customer.deal_stage = deal_stage or customer.deal_stage
        customer.deal_probability = deal_probability if deal_probability else customer.deal_probability
        customer.customer_metadata = {
            'accounts': accounts,
            'deals': deals
        }
        customer.updated_at = datetime.now(timezone.utc)
        customer.last_activity_at = datetime.now(timezone.utc)
    else:
        # Create new customer
        customer = Customer(
            workspace_id=workspace_id,
            name=account.get('name', 'Unknown'),
            domain=domain,
            industry=account.get('industry'),
            website=account.get('website'),
            phone=account.get('phone'),
            external_system='hubspot',
            external_id=external_id,
            mrr=mrr,
            arr=arr,
            deal_amount=deal_amount,
            deal_stage=deal_stage,
            deal_close_date=deal_close_date,
            deal_probability=deal_probability,
            customer_metadata={
                'accounts': accounts,
                'deals': deals
            },
            last_activity_at=datetime.now(timezone.utc)
        )
        db.add(customer)

    return customer


def _extract_hubspot_context(call_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract HubSpot context data from Gong call

    Args:
        call_data: Full call data from Gong extensive endpoint

    Returns:
        Dictionary with extracted HubSpot account and deal information
    """
    hubspot_data = {
        "accounts": [],
        "deals": [],
        "contacts": []
    }

    context = call_data.get('context', [])

    for ctx in context:
        if ctx.get('system') == 'HubSpot':
            objects = ctx.get('objects', [])

            for obj in objects:
                object_type = obj.get('objectType', '').lower()
                fields = obj.get('fields', [])

                # Convert fields array to dictionary
                field_dict = {field['name']: field['value'] for field in fields}

                # Extract based on object type
                if object_type == 'account':
                    hubspot_data['accounts'].append({
                        'object_id': obj.get('objectId'),
                        'name': field_dict.get('name') or field_dict.get('Name'),
                        'domain': field_dict.get('domain'),
                        'website': field_dict.get('website') or field_dict.get('Website'),
                        'industry': field_dict.get('industry') or field_dict.get('Industry'),
                        'phone': field_dict.get('phone'),
                        'all_fields': field_dict
                    })

                elif object_type == 'deal':
                    hubspot_data['deals'].append({
                        'object_id': obj.get('objectId'),
                        'name': field_dict.get('dealname') or field_dict.get('Name'),
                        'amount': field_dict.get('amount') or field_dict.get('Amount'),
                        'stage': field_dict.get('dealstage') or field_dict.get('StageName'),
                        'close_date': field_dict.get('closedate') or field_dict.get('CloseDate'),
                        'probability': field_dict.get('hs_deal_stage_probability') or field_dict.get('Probability'),
                        'pipeline': field_dict.get('pipeline'),
                        'all_fields': field_dict
                    })

                elif object_type == 'contact':
                    hubspot_data['contacts'].append({
                        'object_id': obj.get('objectId'),
                        'all_fields': field_dict
                    })

    return hubspot_data


async def ingest_gong_calls(
    workspace_id: str,
    limit: int = 10,
    days_back: int = 7,
    fetch_transcripts: bool = True,
    extract_features: bool = True
) -> int:
    """
    Ingest calls from Gong for a specific workspace

    Args:
        workspace_id: Workspace UUID
        limit: Maximum number of calls to fetch
        days_back: How many days back to fetch calls
        fetch_transcripts: Whether to fetch full transcripts

    Returns:
        Number of calls ingested
    """
    try:
        # Get Gong credentials from environment
        access_key = os.getenv('GONG_ACCESS_KEY')
        secret_key = os.getenv('GONG_SECRET_KEY')
        base_url = os.getenv('GONG_API_BASE_URL', 'https://api.gong.io')

        if not access_key or not secret_key:
            logger.error("Gong credentials not found in environment variables")
            logger.error("Please set GONG_ACCESS_KEY and GONG_SECRET_KEY in .env file")
            return 0

        # Initialize Gong service
        gong_service = GongIngestionService(access_key, secret_key, base_url)

        # Get database session
        db: Session = next(get_db())

        try:
            # Verify workspace exists
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                logger.error(f"Workspace {workspace_id} not found")
                return 0

            logger.info(f"Starting Gong call ingestion for workspace: {workspace.name}")

            # Load themes for context-aware feature extraction
            themes = db.query(Theme).filter(
                Theme.workspace_id == workspace_id,
                Theme.is_default == False  # Exclude "Unclassified" theme
            ).all()

            themes_list = [
                {"name": theme.name, "description": theme.description}
                for theme in themes
            ]

            if themes_list:
                logger.info(f"Loaded {len(themes_list)} themes for AI context")
                for theme in themes_list:
                    logger.info(f"  - {theme['name']}")
            else:
                logger.warning("No themes found - features will be extracted without theme context")

            # Get or create Gong integration
            integration = db.query(Integration).filter(
                and_(
                    Integration.workspace_id == workspace_id,
                    Integration.provider == "gong"
                )
            ).first()

            if not integration:
                logger.info("Creating new Gong integration record")
                integration = Integration(
                    name="Gong",
                    provider="gong",
                    is_active=True,
                    workspace_id=workspace_id,
                    provider_metadata={
                        "ingestion_method": "api",
                        "has_transcripts": fetch_transcripts
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

            # Fetch calls from Gong
            logger.info(f"Fetching up to {limit} calls from last {days_back} days")
            calls = gong_service.fetch_calls(from_date, to_date, limit)

            if not calls:
                logger.warning("No calls found in the specified date range")
                return 0

            # Process and store calls
            ingested_count = 0

            for call_data in calls:
                try:
                    # Extract from metaData (extensive endpoint structure)
                    metadata = call_data.get('metaData', {})
                    call_id = metadata.get('id')

                    if not call_id:
                        logger.warning("Call has no ID, skipping")
                        continue

                    # Check if call already exists
                    existing_message = db.query(Message).filter(
                        and_(
                            Message.external_id == call_id,
                            Message.integration_id == integration.id,
                            Message.source == "gong"
                        )
                    ).first()

                    if existing_message:
                        logger.debug(f"Call {call_id} already exists, skipping")
                        continue

                    # Extract call information from metaData
                    title = metadata.get('title', 'Untitled Call')
                    scheduled = metadata.get('scheduled')
                    started = metadata.get('started')
                    duration_seconds = metadata.get('duration')

                    # Get participants from parties field
                    parties = call_data.get('parties', [])
                    participants = []
                    primary_party = None

                    for party in parties:
                        party_info = {
                            'name': party.get('name', 'Unknown'),
                            'email': party.get('emailAddress'),
                            'role': party.get('affiliation')  # 'Internal' or 'External'
                        }
                        participants.append(party_info)

                        # Use first internal party as the "author"
                        if not primary_party and party.get('affiliation') == 'Internal':
                            primary_party = party_info

                    # If no internal party, use first party
                    if not primary_party and participants:
                        primary_party = participants[0]

                    # Build content from call metadata
                    content = f"Call: {title}\n"
                    if duration_seconds:
                        minutes = duration_seconds // 60
                        content += f"Duration: {minutes} minutes\n"
                    if participants:
                        participant_names = [p['name'] for p in participants]
                        content += f"Participants: {', '.join(participant_names)}\n"

                    # Fetch transcript if requested
                    transcript_data = None
                    transcript_text = ""
                    if fetch_transcripts:
                        transcript_data = gong_service.fetch_call_transcript(call_id)
                        if transcript_data:
                            # Extract transcript text - Gong structure has nested sentences
                            transcript_items = transcript_data.get('transcript', [])

                            # Build speaker ID to name mapping from participants
                            speaker_map = {}
                            for party in parties:
                                party_id = party.get('speakerId')
                                party_name = party.get('name', 'Unknown')
                                if party_id:
                                    speaker_map[party_id] = party_name

                            if transcript_items:
                                content += "\n--- Conversation ---\n\n"

                                last_speaker = None
                                for item in transcript_items:
                                    speaker_id = item.get('speakerId', 'Unknown')
                                    # Get speaker name from mapping, fallback to ID
                                    speaker_name = speaker_map.get(speaker_id, f'Speaker {speaker_id}')

                                    # Extract sentences from the nested array
                                    sentences = item.get('sentences', [])
                                    for sentence_obj in sentences:
                                        text = sentence_obj.get('text', '').strip()
                                        if text:
                                            # Add extra newline when speaker changes for better readability
                                            if last_speaker and last_speaker != speaker_name:
                                                content += "\n"
                                                transcript_text += "\n"

                                            content += f"{speaker_name}: {text}\n"
                                            transcript_text += f"{speaker_name}: {text}\n"
                                            last_speaker = speaker_name

                    # Parse the call timestamp
                    call_time = datetime.fromisoformat(started.replace('Z', '+00:00')) if started else datetime.now(timezone.utc)

                    # Extract HubSpot context data
                    hubspot_data = _extract_hubspot_context(call_data)

                    # Get or create customer from HubSpot data
                    customer = _get_or_create_customer(db, workspace_id, hubspot_data)
                    if customer:
                        # Flush to get customer ID
                        db.flush()

                    # Extract features and insights using AI
                    ai_insights = None
                    if extract_features and transcript_text:
                        try:
                            logger.info(f"Extracting features from call: {title}")
                            ai_service = get_ai_extraction_service()

                            # Pass customer context for better extraction
                            customer_name = customer.name if customer else None
                            customer_mrr = customer.mrr if customer else None

                            ai_insights = ai_service.extract_insights(
                                transcript=transcript_text,
                                customer_name=customer_name,
                                customer_mrr=customer_mrr,
                                themes=themes_list if themes_list else None
                            )

                            logger.info(
                                f"Extracted {len(ai_insights.get('feature_requests', []))} features, "
                                f"{len(ai_insights.get('bug_reports', []))} bugs from call {call_id}"
                            )

                        except Exception as e:
                            logger.warning(f"Failed to extract AI insights for call {call_id}: {e}")
                            ai_insights = None

                    # Create message object
                    message = Message(
                        external_id=call_id,
                        content=content,
                        source="gong",
                        channel_name="Gong Calls",
                        channel_id="gong_calls",
                        author_name=primary_party['name'] if primary_party else 'Unknown',
                        author_id=None,
                        author_email=primary_party.get('email') if primary_party else None,
                        customer_id=customer.id if customer else None,  # Link to customer
                        message_metadata={
                            "call_id": call_id,
                            "title": title,
                            "scheduled": scheduled,
                            "started": started,
                            "duration_seconds": duration_seconds,
                            "participants": participants,
                            "has_transcript": transcript_data is not None,
                            "transcript_text": transcript_text,  # Clean conversation text
                            "hubspot_context": hubspot_data,  # Extracted HubSpot data
                            "raw_call_data": call_data,
                            "transcript_data": transcript_data  # Full JSON response
                        },
                        ai_insights=ai_insights,  # AI-extracted features and bugs in separate column
                        thread_id=None,
                        is_thread_reply=False,
                        workspace_id=workspace_id,
                        integration_id=integration.id,
                        sent_at=call_time,
                        is_processed=False
                    )

                    db.add(message)
                    ingested_count += 1
                    logger.info(f"Ingested call: {title} (ID: {call_id})")

                except Exception as e:
                    logger.error(f"Error processing call {call_data.get('id', 'unknown')}: {e}")
                    continue

            # Commit all messages
            if ingested_count > 0:
                db.commit()
                logger.info(f"Successfully committed {ingested_count} calls to database")

            # Update integration sync status
            integration.last_synced_at = datetime.now(timezone.utc)
            integration.sync_status = "success"
            integration.sync_error = None
            db.commit()

            return ingested_count

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error in ingest_gong_calls: {e}")
        import traceback
        traceback.print_exc()
        return 0


async def main():
    """Main function to handle command line arguments and run ingestion"""
    parser = argparse.ArgumentParser(description="Ingest calls from Gong")

    parser.add_argument("--workspace-id", required=True, help="Workspace ID to ingest calls for")
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of calls to fetch (default: 10)")
    parser.add_argument("--days-back", type=int, default=7, help="How many days back to fetch calls (default: 7)")
    parser.add_argument("--no-transcripts", action="store_true", help="Skip fetching transcripts (faster)")
    parser.add_argument("--no-extract-features", action="store_true", help="Skip AI feature extraction (faster)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")

    logger.info(f"Starting Gong call ingestion")
    logger.info(f"Workspace ID: {args.workspace_id}")
    logger.info(f"Limit: {args.limit} calls")
    logger.info(f"Looking back: {args.days_back} days")
    logger.info(f"Fetch transcripts: {not args.no_transcripts}")
    logger.info(f"Extract features with AI: {not args.no_extract_features}")

    try:
        count = await ingest_gong_calls(
            workspace_id=args.workspace_id,
            limit=args.limit,
            days_back=args.days_back,
            fetch_transcripts=not args.no_transcripts,
            extract_features=not args.no_extract_features
        )

        if count > 0:
            logger.info(f"✅ Successfully ingested {count} calls from Gong!")
            sys.exit(0)
        else:
            logger.warning("⚠️  No calls were ingested")
            sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Gong ingestion interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

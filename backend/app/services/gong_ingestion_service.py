"""
Optimized Gong Ingestion Service - Fast batch data storage without AI extraction.

This service focuses on:
1. Fast fetching of Gong calls and transcripts
2. Batch insertion into the database
3. Deferred AI processing (marked as is_processed=False)

AI extraction happens in a separate batch processing task.

Usage:
    from app.services.gong_ingestion_service import gong_ingestion_service

    result = await gong_ingestion_service.ingest_calls(
        db=db,
        workspace_id="...",
        limit=50,
        days_back=1
    )
"""

import logging
import os
import requests
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.models.integration import Integration
from app.models.customer import Customer
from app.services.batch_db_service import batch_db_service

logger = logging.getLogger(__name__)


class GongIngestionService:
    """
    Optimized Gong ingestion service.

    Key optimizations:
    - Batch API calls where possible
    - No inline AI extraction (deferred to batch processing)
    - Batch database inserts
    - Minimal memory footprint
    """

    def __init__(self):
        self.base_url = os.getenv('GONG_API_BASE_URL', 'https://api.gong.io')

    async def ingest_calls(
        self,
        db: Session,
        workspace_id: str,
        limit: int = 50,
        days_back: int = 1,
        fetch_transcripts: bool = True
    ) -> Dict[str, int]:
        """
        Ingest Gong calls with optimized batch processing.

        This method:
        1. Fetches calls from Gong API
        2. Fetches transcripts (if enabled)
        3. Batch inserts into Message table with is_processed=False
        4. Returns counts for sync tracking

        AI extraction is NOT performed here - it happens in a separate task.

        Args:
            db: Database session
            workspace_id: Workspace UUID string
            limit: Maximum calls to fetch
            days_back: How many days back to look
            fetch_transcripts: Whether to fetch full transcripts

        Returns:
            Dict with 'total_checked', 'new_added', 'duplicates_skipped', 'inserted_ids'
        """
        try:
            # Validate workspace
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                logger.error(f"Workspace {workspace_id} not found")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            # Get Gong credentials from connector
            credentials = self._get_credentials(db, workspace_id)
            if not credentials:
                logger.error(f"Gong credentials not found for workspace {workspace_id}")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            # Get or create integration record
            integration = self._get_or_create_integration(db, workspace_id)

            # Calculate date range
            to_date = datetime.now(timezone.utc)
            from_date = to_date - timedelta(days=days_back)

            # Fetch calls from Gong
            logger.info(f"Fetching up to {limit} Gong calls from last {days_back} days")
            calls = self._fetch_calls(credentials, from_date, to_date, limit)

            if not calls:
                logger.info("No Gong calls found in date range")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            # Prepare messages for batch insert
            messages = []
            for call_data in calls:
                try:
                    message = self._prepare_message(
                        call_data=call_data,
                        credentials=credentials,
                        fetch_transcript=fetch_transcripts,
                        workspace_id=workspace_id,
                        workspace=workspace
                    )
                    if message:
                        messages.append(message)
                except Exception as e:
                    logger.error(f"Error preparing call {call_data.get('metaData', {}).get('id')}: {e}")
                    continue

            # Batch insert all messages
            result = batch_db_service.batch_insert_messages(
                db=db,
                messages=messages,
                workspace_id=workspace_id,
                integration_id=str(integration.id),
                source="gong"
            )

            # Update integration sync status
            integration.last_synced_at = datetime.now(timezone.utc)
            integration.sync_status = "success"
            db.commit()

            logger.info(
                f"Gong ingestion complete: {result['new_added']} new, "
                f"{result['duplicates_skipped']} skipped"
            )

            return result

        except Exception as e:
            logger.error(f"Error in Gong ingestion: {e}")
            import traceback
            traceback.print_exc()
            return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

    def _get_credentials(self, db: Session, workspace_id: str) -> Optional[Dict[str, str]]:
        """Get Gong API credentials from workspace connector."""
        connector = db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == UUID(workspace_id),
                WorkspaceConnector.connector_type == "gong",
                WorkspaceConnector.is_active == True
            )
        ).first()

        if not connector:
            return None

        creds = connector.credentials or {}
        access_key = creds.get('access_key')
        secret_key = creds.get('secret_key')

        if not access_key or not secret_key:
            return None

        return {
            "access_key": access_key,
            "secret_key": secret_key
        }

    def _get_or_create_integration(self, db: Session, workspace_id: str) -> Integration:
        """Get or create Gong integration record."""
        integration = db.query(Integration).filter(
            and_(
                Integration.workspace_id == UUID(workspace_id),
                Integration.provider == "gong"
            )
        ).first()

        if not integration:
            integration = Integration(
                name="Gong",
                provider="gong",
                is_active=True,
                workspace_id=UUID(workspace_id),
                provider_metadata={"ingestion_method": "api"},
                sync_status="pending"
            )
            db.add(integration)
            db.flush()

        return integration

    def _fetch_calls(
        self,
        credentials: Dict[str, str],
        from_date: datetime,
        to_date: datetime,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Fetch calls from Gong API."""
        try:
            from_datetime = from_date.strftime('%Y-%m-%dT%H:%M:%S-00:00')
            to_datetime = to_date.strftime('%Y-%m-%dT%H:%M:%S-00:00')

            url = f"{self.base_url}/v2/calls/extensive"
            auth = (credentials["access_key"], credentials["secret_key"])

            payload = {
                "filter": {
                    "fromDateTime": from_datetime,
                    "toDateTime": to_datetime
                },
                "contentSelector": {
                    "context": "Extended",
                    "exposedFields": {
                        "parties": True,
                        "content": {"structure": True},
                        "interaction": {"speakers": True}
                    }
                }
            }

            response = requests.post(
                url,
                auth=auth,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=60
            )
            response.raise_for_status()

            calls = response.json().get('calls', [])
            return calls[:limit]

        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching Gong calls: {e}")
            return []

    def _fetch_transcript(
        self,
        credentials: Dict[str, str],
        call_id: str
    ) -> Optional[Dict[str, Any]]:
        """Fetch transcript for a single call."""
        try:
            url = f"{self.base_url}/v2/calls/transcript"
            auth = (credentials["access_key"], credentials["secret_key"])

            payload = {"filter": {"callIds": [call_id]}}

            response = requests.post(
                url,
                auth=auth,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30
            )
            response.raise_for_status()

            transcripts = response.json().get('callTranscripts', [])
            return transcripts[0] if transcripts else None

        except Exception as e:
            logger.warning(f"Could not fetch transcript for call {call_id}: {e}")
            return None

    def _prepare_message(
        self,
        call_data: Dict[str, Any],
        credentials: Dict[str, str],
        fetch_transcript: bool,
        workspace_id: str,
        workspace: Workspace
    ) -> Optional[Dict[str, Any]]:
        """Prepare a call as a message dict for batch insert."""
        metadata = call_data.get('metaData', {})
        call_id = metadata.get('id')

        if not call_id:
            return None

        # Extract call info
        title = metadata.get('title', 'Untitled Call')
        started = metadata.get('started')
        duration_seconds = metadata.get('duration')

        # Get parties
        parties = call_data.get('parties', [])

        # Build speaker map
        speaker_map = {}
        for party in parties:
            party_id = party.get('speakerId')
            if party_id:
                speaker_map[party_id] = party.get('name', 'Unknown')

        # Find primary author (first internal party)
        author_name = "Unknown"
        author_email = None
        for party in parties:
            if party.get('affiliation') == 'Internal':
                author_name = party.get('name', 'Unknown')
                author_email = party.get('emailAddress')
                break

        # Fetch transcript if requested
        transcript_text = ""
        transcript_data = None
        if fetch_transcript:
            transcript_data = self._fetch_transcript(credentials, call_id)
            if transcript_data:
                transcript_text = self._format_transcript(transcript_data, speaker_map)

        # Parse timestamp
        sent_at = datetime.now(timezone.utc)
        if started:
            try:
                sent_at = datetime.fromisoformat(started.replace('Z', '+00:00'))
            except ValueError:
                pass

        # Extract external customer info
        customer_domain = None
        customer_name = None
        for party in parties:
            if party.get('affiliation') == 'External':
                email = party.get('emailAddress', '')
                if '@' in email:
                    customer_domain = email.split('@')[1]
                    customer_name = party.get('name')
                    break

        # Prepare metadata (store everything for later AI processing)
        message_metadata = {
            "call_id": call_id,
            "title": title,
            "duration_seconds": duration_seconds,
            "parties": [
                {
                    "name": p.get("name"),
                    "email": p.get("emailAddress"),
                    "affiliation": p.get("affiliation")
                }
                for p in parties
            ],
            "has_transcript": transcript_data is not None,
            "customer_domain": customer_domain,
            "customer_name": customer_name,
            # Store raw data for later if needed
            "raw_metadata": metadata,
        }

        # Don't store full transcript_data to save space
        # The transcript_text in content is sufficient

        return {
            "external_id": call_id,
            "content": transcript_text or f"[Call: {title}]",
            "title": title,
            "channel_name": "Gong Calls",
            "channel_id": "gong_calls",
            "author_name": author_name,
            "author_email": author_email,
            "metadata": message_metadata,
            "sent_at": sent_at,
        }

    def _format_transcript(
        self,
        transcript_data: Dict[str, Any],
        speaker_map: Dict[str, str]
    ) -> str:
        """Format transcript into readable text."""
        lines = []
        last_speaker = None

        for item in transcript_data.get('transcript', []):
            speaker_id = item.get('speakerId', 'Unknown')
            speaker_name = speaker_map.get(speaker_id, f'Speaker {speaker_id}')

            for sentence in item.get('sentences', []):
                text = sentence.get('text', '').strip()
                if text:
                    if last_speaker and last_speaker != speaker_name:
                        lines.append("")  # Add blank line on speaker change
                    lines.append(f"{speaker_name}: {text}")
                    last_speaker = speaker_name

        return "\n".join(lines)


# Global service instance
gong_ingestion_service = GongIngestionService()

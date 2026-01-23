"""
Optimized Fathom Batch Ingestion Service - Fast batch data storage without AI extraction.

This service focuses on:
1. Fast fetching of Fathom sessions and transcripts
2. Batch insertion into the database
3. Deferred AI processing (marked as is_processed=False)

AI extraction happens in a separate batch processing task.

Usage:
    from app.services.fathom_batch_ingestion_service import fathom_batch_ingestion_service

    result = await fathom_batch_ingestion_service.ingest_sessions(
        db=db,
        workspace_id="...",
        limit=100,
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
from app.models.customer import Customer
from app.services.batch_db_service import batch_db_service

logger = logging.getLogger(__name__)


class FathomBatchIngestionService:
    """
    Optimized Fathom ingestion service.

    Key optimizations:
    - Batch API calls where possible
    - No inline AI extraction (deferred to batch processing)
    - Batch database inserts
    - Minimal memory footprint
    """

    def __init__(self):
        self.base_url = os.getenv('FATHOM_API_BASE_URL', 'https://api.fathom.ai')

    async def ingest_sessions(
        self,
        db: Session,
        workspace_id: str,
        limit: int = 100,
        days_back: int = 1,
        min_duration_seconds: int = 0
    ) -> Dict[str, int]:
        """
        Ingest Fathom sessions with optimized batch processing.

        This method:
        1. Fetches sessions from Fathom API
        2. Batch inserts into Message table with is_processed=False
        3. Returns counts for sync tracking

        AI extraction is NOT performed here - it happens in a separate task.

        Args:
            db: Database session
            workspace_id: Workspace UUID string
            limit: Maximum sessions to fetch
            days_back: How many days back to look
            min_duration_seconds: Minimum session duration to include

        Returns:
            Dict with 'total_checked', 'new_added', 'duplicates_skipped', 'inserted_ids'
        """
        try:
            # Validate workspace
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                logger.error(f"Workspace {workspace_id} not found")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            # Get Fathom credentials from connector
            credentials = self._get_credentials(db, workspace_id)
            if not credentials:
                logger.error(f"Fathom credentials not found for workspace {workspace_id}")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            # Get connector record
            connector = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.workspace_id == UUID(workspace_id),
                    WorkspaceConnector.connector_type == "fathom",
                    WorkspaceConnector.is_active == True
                )
            ).first()

            if not connector:
                logger.error(f"Fathom connector not found for workspace {workspace_id}")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            # Calculate date range
            to_date = datetime.now(timezone.utc)
            from_date = to_date - timedelta(days=days_back)

            # Fetch sessions from Fathom
            logger.info(f"Fetching up to {limit} Fathom sessions from last {days_back} days")
            sessions = self._fetch_sessions(
                credentials=credentials,
                from_date=from_date,
                to_date=to_date,
                limit=limit,
                min_duration_seconds=min_duration_seconds
            )

            if not sessions:
                logger.info("No Fathom sessions found in date range")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            # Prepare messages for batch insert
            messages = []
            for session_data in sessions:
                try:
                    message = self._prepare_message(
                        session_data=session_data,
                        workspace_id=workspace_id,
                        workspace=workspace
                    )
                    if message:
                        messages.append(message)
                except Exception as e:
                    logger.error(f"Error preparing session {session_data.get('recording_id')}: {e}")
                    continue

            # Batch insert all messages
            result = batch_db_service.batch_insert_messages(
                db=db,
                messages=messages,
                workspace_id=workspace_id,
                connector_id=str(connector.id),
                source="fathom"
            )

            # Update connector sync status
            connector.last_synced_at = datetime.now(timezone.utc)
            connector.sync_status = "success"
            db.commit()

            logger.info(
                f"Fathom ingestion complete: {result['new_added']} new, "
                f"{result['duplicates_skipped']} skipped"
            )

            return result

        except Exception as e:
            logger.error(f"Error in Fathom ingestion: {e}")
            import traceback
            traceback.print_exc()
            return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

    def _get_credentials(self, db: Session, workspace_id: str) -> Optional[Dict[str, str]]:
        """Get Fathom API credentials from workspace connector."""
        connector = db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == UUID(workspace_id),
                WorkspaceConnector.connector_type == "fathom",
                WorkspaceConnector.is_active == True
            )
        ).first()

        if not connector:
            return None

        creds = connector.credentials or {}
        api_token = creds.get('api_token')

        if not api_token:
            return None

        return {
            "api_token": api_token
        }

    def _fetch_sessions(
        self,
        credentials: Dict[str, str],
        from_date: datetime,
        to_date: datetime,
        limit: int,
        min_duration_seconds: int = 0
    ) -> List[Dict[str, Any]]:
        """Fetch sessions from Fathom API with pagination."""
        try:
            url = f"{self.base_url}/external/v1/meetings"
            headers = {
                "X-Api-Key": credentials["api_token"],
                "Content-Type": "application/json"
            }

            all_sessions = []
            cursor = None
            page = 0

            while True:
                page += 1

                params = {
                    "limit": min(100, limit) if limit > 0 else 100,
                    "include_transcript": "true"
                }
                if cursor:
                    params["cursor"] = cursor

                response = requests.get(
                    url,
                    headers=headers,
                    params=params,
                    timeout=60
                )
                response.raise_for_status()
                data = response.json()

                items = data.get('items', [])
                all_sessions.extend(items)

                logger.debug(f"Page {page}: Fetched {len(items)} sessions (Total: {len(all_sessions)})")

                # Check if we have enough
                if limit > 0 and len(all_sessions) >= limit:
                    all_sessions = all_sessions[:limit]
                    break

                # Get next cursor
                cursor = data.get('next_cursor')
                if not cursor:
                    break

            # Filter by minimum duration if specified
            if min_duration_seconds > 0:
                all_sessions = [
                    s for s in all_sessions
                    if self._get_duration(s) >= min_duration_seconds
                ]

            return all_sessions

        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching Fathom sessions: {e}")
            return []

    def _get_duration(self, session_data: Dict[str, Any]) -> int:
        """Calculate session duration in seconds."""
        try:
            recording_start = session_data.get('recording_start_time')
            recording_end = session_data.get('recording_end_time')
            if recording_start and recording_end:
                start = datetime.fromisoformat(recording_start.replace('Z', '+00:00'))
                end = datetime.fromisoformat(recording_end.replace('Z', '+00:00'))
                return int((end - start).total_seconds())
        except (ValueError, AttributeError):
            pass
        return 0

    def _prepare_message(
        self,
        session_data: Dict[str, Any],
        workspace_id: str,
        workspace: Workspace
    ) -> Optional[Dict[str, Any]]:
        """Prepare a session as a message dict for batch insert."""
        session_id = str(session_data.get('recording_id'))

        if not session_id or session_id == 'None':
            return None

        # Extract session info
        title = session_data.get('title') or f"Session {session_id}"
        recorded_by = session_data.get('recorded_by', {})
        user_email = recorded_by.get('email')
        user_name = recorded_by.get('name') or user_email or 'Unknown'

        # Get calendar invitees
        calendar_invitees = session_data.get('calendar_invitees', [])

        # Calculate duration
        duration_seconds = self._get_duration(session_data)

        # Format transcript
        transcript_text = self._format_transcript(session_data.get('transcript'))

        # Parse timestamp
        sent_at = datetime.now(timezone.utc)
        created_at = session_data.get('created_at')
        if created_at:
            try:
                sent_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except ValueError:
                pass

        # Extract external customer info from invitees
        customer_domain = None
        customer_name = None
        for invitee in calendar_invitees:
            if invitee.get('is_external', False):
                email = invitee.get('email', '')
                if '@' in email:
                    customer_domain = invitee.get('email_domain') or email.split('@')[1]
                    customer_name = invitee.get('name')
                    break

        # Prepare metadata (store everything for later AI processing)
        message_metadata = {
            "session_id": session_id,
            "title": title,
            "duration_seconds": duration_seconds,
            "recording_url": session_data.get('share_url'),
            "user_email": user_email,
            "user_name": user_name,
            "page_url": session_data.get('page_url'),
            "device_type": session_data.get('device_type'),
            "browser": session_data.get('browser'),
            "os": session_data.get('os'),
            "rage_clicks": session_data.get('rage_clicks', 0),
            "error_clicks": session_data.get('error_clicks', 0),
            "dead_clicks": session_data.get('dead_clicks', 0),
            "frustrated_gestures": session_data.get('frustrated_gestures', 0),
            "tags": session_data.get('tags', []),
            "has_transcript": bool(transcript_text),
            "customer_domain": customer_domain,
            "customer_name": customer_name,
            "calendar_invitees": [
                {
                    "name": inv.get("name"),
                    "email": inv.get("email"),
                    "is_external": inv.get("is_external", False)
                }
                for inv in calendar_invitees
            ],
        }

        return {
            "external_id": session_id,
            "content": transcript_text or f"[Session: {title}]",
            "title": title,
            "channel_name": "Fathom Sessions",
            "channel_id": "fathom_sessions",
            "author_name": user_name,
            "author_email": user_email,
            "metadata": message_metadata,
            "sent_at": sent_at,
        }

    def _format_transcript(self, transcript_data: Any) -> str:
        """Format transcript into readable text."""
        if not transcript_data:
            return ""

        if isinstance(transcript_data, str):
            return transcript_data

        if isinstance(transcript_data, list):
            lines = []
            for item in transcript_data:
                speaker_name = item.get('speaker', {}).get('display_name', 'Unknown')
                text = item.get('text', '').strip()
                if text:
                    lines.append(f"{speaker_name}: {text}")
            return "\n".join(lines)

        return ""


# Global service instance
fathom_batch_ingestion_service = FathomBatchIngestionService()

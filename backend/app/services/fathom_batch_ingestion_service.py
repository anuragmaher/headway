"""
Optimized Fathom Batch Ingestion Service - Fast batch data storage for raw transcripts.

This service focuses on:
1. Fast fetching of Fathom sessions and transcripts
2. Batch insertion into raw_transcripts table
3. Deferred AI processing (ai_processed=False)

AI extraction happens in a separate Celery task (transcript_processing).

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
from app.services.batch_db_service import batch_db_service

logger = logging.getLogger(__name__)


class FathomBatchIngestionService:
    """
    Optimized Fathom ingestion service for raw transcripts.

    Key optimizations:
    - Batch API calls where possible
    - No inline AI extraction (deferred to batch processing)
    - Batch database inserts to raw_transcripts
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
        2. Batch inserts into raw_transcripts table with ai_processed=False
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

            # Prepare raw transcripts for batch insert
            transcripts = []
            for session_data in sessions:
                try:
                    transcript = self._prepare_raw_transcript(session_data=session_data)
                    if transcript:
                        transcripts.append(transcript)
                except Exception as e:
                    logger.error(f"Error preparing session {session_data.get('recording_id')}: {e}")
                    continue

            # Batch insert all raw transcripts
            result = batch_db_service.batch_insert_raw_transcripts(
                db=db,
                transcripts=transcripts,
                workspace_id=workspace_id,
                source_type="fathom"
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

    def _prepare_raw_transcript(
        self,
        session_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Prepare a session as a raw transcript dict for batch insert."""
        session_id = str(session_data.get('recording_id'))

        if not session_id or session_id == 'None':
            return None

        # Extract session info
        title = session_data.get('title') or f"Session {session_id}"

        # Calculate duration
        duration_seconds = self._get_duration(session_data)

        # Parse timestamp
        transcript_date = datetime.now(timezone.utc)
        created_at = session_data.get('created_at')
        if created_at:
            try:
                transcript_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except ValueError:
                pass

        # Count participants from calendar_invitees
        calendar_invitees = session_data.get('calendar_invitees', [])
        participant_count = len(calendar_invitees) + 1  # +1 for recorded_by

        # Store complete raw data as-is
        raw_data = session_data

        return {
            "source_id": session_id,
            "raw_data": raw_data,
            "title": title,
            "duration_seconds": duration_seconds,
            "transcript_date": transcript_date,
            "participant_count": participant_count,
        }


# Global service instance
fathom_batch_ingestion_service = FathomBatchIngestionService()

"""
Fathom session ingestion service

Handles fetching session recordings and metadata from Fathom API.
This service is specialized for Fathom but follows the same pattern
as GongIngestionService for consistency.
"""

import logging
import requests
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class FathomIngestionService:
    """Service for fetching sessions from Fathom API"""

    def __init__(self, api_token: str, base_url: str = "https://api.fathom.ai"):
        """
        Initialize Fathom ingestion service

        Args:
            api_token: Fathom API authentication token
            base_url: Base URL for Fathom API (default: https://api.fathom.ai)
        """
        self.api_token = api_token
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "X-Api-Key": api_token,
            "Content-Type": "application/json"
        }

    def fetch_sessions(
        self,
        project_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        limit: int = 10,
        min_duration_seconds: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Fetch session recordings from Fathom API with pagination support

        Args:
            project_id: Fathom project ID
            from_date: Start date for session retrieval (default: 7 days ago)
            to_date: End date for session retrieval (default: now)
            limit: Maximum number of sessions to retrieve (0 = all)
            min_duration_seconds: Minimum session duration to include (default: 0)

        Returns:
            List of session objects
        """
        try:
            # Set default date range
            if to_date is None:
                to_date = datetime.now(timezone.utc)
            if from_date is None:
                from_date = to_date - timedelta(days=7)

            # Fathom API endpoint for getting meetings/recordings
            # Using the Fathom external API: https://api.fathom.ai/external/v1/meetings
            url = f"{self.base_url}/external/v1/meetings"

            all_sessions = []
            cursor = None
            page = 0
            fetched_count = 0

            logger.info(f"Fetching sessions from Fathom API: {url}")
            logger.info(f"Limit: {'All available' if limit == 0 else limit} sessions")

            while True:
                page += 1

                # Build query parameters - use limit of 100 per page for efficiency
                params = {
                    "limit": 100,
                    "include_transcript": "true"  # Request transcript data
                }
                if cursor:
                    params["cursor"] = cursor

                response = requests.get(
                    url,
                    headers=self.headers,
                    params=params,
                    timeout=30
                )

                response.raise_for_status()
                data = response.json()

                # Fathom API returns meetings in 'items' array
                items = data.get('items', [])
                all_sessions.extend(items)
                fetched_count += len(items)

                logger.debug(f"Page {page}: Fetched {len(items)} sessions (Total: {fetched_count})")

                # Check if we have enough or should stop
                if limit > 0 and fetched_count >= limit:
                    # Trim to exact limit
                    all_sessions = all_sessions[:limit]
                    logger.info(f"Reached limit of {limit} sessions")
                    break

                # Get next cursor for pagination
                cursor = data.get('next_cursor')
                if not cursor:
                    logger.debug(f"No more pages. Total sessions fetched: {fetched_count}")
                    break

            # Filter by minimum duration if specified
            if min_duration_seconds > 0:
                original_count = len(all_sessions)
                all_sessions = [
                    s for s in all_sessions
                    if s.get('duration', 0) >= min_duration_seconds
                ]
                logger.info(f"Filtered {original_count} sessions to {len(all_sessions)} (min duration: {min_duration_seconds}s)")

            logger.info(f"Successfully fetched {len(all_sessions)} sessions from Fathom")
            return all_sessions

        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching sessions from Fathom API: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            raise

    def fetch_session_details(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch detailed information for a specific session

        Args:
            session_id: Fathom session ID

        Returns:
            Session details or None if not available
        """
        try:
            url = f"{self.base_url}/rest/v1/videos/{session_id}"

            logger.debug(f"Fetching details for session {session_id}")

            response = requests.get(
                url,
                headers=self.headers,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            # API might return the session in 'data' or directly
            session = data.get('data', data) if isinstance(data, dict) else data

            return session

        except requests.exceptions.RequestException as e:
            logger.warning(f"Could not fetch details for session {session_id}: {e}")
            return None

    def fetch_session_events(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch interaction events for a specific session

        Args:
            session_id: Fathom session ID

        Returns:
            List of user interaction events or None if not available
        """
        try:
            url = f"{self.base_url}/rest/v1/videos/{session_id}/events"

            logger.debug(f"Fetching events for session {session_id}")

            response = requests.get(
                url,
                headers=self.headers,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            # API might return events in 'data' or directly
            events = data.get('data', data) if isinstance(data, dict) and 'data' in data else data

            return events if isinstance(events, list) else []

        except requests.exceptions.RequestException as e:
            logger.warning(f"Could not fetch events for session {session_id}: {e}")
            return None

    def fetch_session_transcript(self, session_id: str) -> Optional[str]:
        """
        Fetch AI-generated transcript for a session

        NOTE: This assumes Fathom provides transcript API or stores transcripts.
        If Fathom doesn't provide transcripts, this will need to use
        speech-to-text on the video recording.

        Args:
            session_id: Fathom session ID

        Returns:
            Transcript text or None if not available
        """
        try:
            url = f"{self.base_url}/rest/v1/videos/{session_id}/transcript"

            logger.debug(f"Fetching transcript for session {session_id}")

            response = requests.get(
                url,
                headers=self.headers,
                timeout=60  # Longer timeout for transcript generation
            )

            response.raise_for_status()
            data = response.json()

            # Check if transcript exists in response
            transcript = data.get('transcript') or data.get('text') or data.get('data', {}).get('transcript')

            if transcript:
                if isinstance(transcript, str):
                    return transcript
                elif isinstance(transcript, dict):
                    # If transcript is structured, join the parts
                    if 'text' in transcript:
                        return transcript['text']
                    # Try to build from parts if available
                    parts = transcript.get('parts', [])
                    if parts:
                        return "\n".join(p.get('text', '') for p in parts)

            return None

        except requests.exceptions.RequestException as e:
            logger.warning(f"Could not fetch transcript for session {session_id}: {e}")
            return None

    def extract_session_features(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract key features and metadata from session data

        Args:
            session_data: Session object from Fathom API

        Returns:
            Extracted session features
        """
        # Calculate duration from recording timestamps
        duration_seconds = 0
        recording_start = session_data.get('recording_start_time')
        recording_end = session_data.get('recording_end_time')
        try:
            if recording_start and recording_end:
                from datetime import datetime
                start = datetime.fromisoformat(recording_start.replace('Z', '+00:00'))
                end = datetime.fromisoformat(recording_end.replace('Z', '+00:00'))
                duration_seconds = int((end - start).total_seconds())
        except (ValueError, AttributeError):
            pass

        # Get user info from recorded_by
        recorded_by = session_data.get('recorded_by', {})

        # Extract standard session properties
        features = {
            "session_id": str(session_data.get('recording_id')),
            "recording_url": session_data.get('share_url'),
            "user_email": recorded_by.get('email'),
            "user_name": recorded_by.get('name'),
            "page_url": session_data.get('page_url'),
            "duration_seconds": duration_seconds,
            "recording_date": session_data.get('created_at'),
            "device_type": session_data.get('device_type'),
            "browser": session_data.get('browser'),
            "os": session_data.get('os'),

            # Frustration signals (if Fathom provides these)
            "rage_clicks": session_data.get('rage_clicks', 0),
            "error_clicks": session_data.get('error_clicks', 0),
            "dead_clicks": session_data.get('dead_clicks', 0),
            "frustrated_gestures": session_data.get('frustrated_gestures', 0),

            # Additional metadata
            "metadata": session_data.get('metadata', {}),
            "tags": session_data.get('tags', []),
            "session_attributes": session_data.get('attributes', {})
        }

        return features


def get_fathom_ingestion_service(api_token: str) -> FathomIngestionService:
    """Factory function to get FathomIngestionService instance"""
    return FathomIngestionService(api_token)

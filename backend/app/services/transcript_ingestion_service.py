"""
Generic transcript ingestion and processing service - Stub Version

NOTE: This service is currently disabled as part of the database schema redesign.
The Feature model has been replaced by CustomerAsk.
Full implementation will be restored after schema migration is complete.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class TranscriptIngestionService:
    """
    Service for ingesting transcripts from any source and processing them
    through AI extraction and intelligent feature matching.

    NOTE: Currently disabled - stub implementation only.
    """

    def __init__(self, db: Session):
        """Initialize the ingestion service"""
        self.db = db
        logger.debug("TranscriptIngestionService initialized (stub mode)")

    def ingest_transcript(
        self,
        workspace_id: str,
        external_id: str,
        transcript_text: str,
        source: str,
        metadata: Dict[str, Any],
        channel_name: str = "Default",
        channel_id: str = "default",
        author_name: Optional[str] = None,
        author_email: Optional[str] = None,
        author_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        sent_at: Optional[datetime] = None,
        integration_id: Optional[str] = None,
        extract_features: bool = True
    ) -> Optional[str]:
        """
        Ingest a transcript - stub implementation.

        Returns:
            None - stub implementation does not process transcripts
        """
        logger.info(
            f"TranscriptIngestionService (stub): Skipping transcript ingestion for "
            f"{source} {external_id} - service disabled during schema migration"
        )
        return None


def get_transcript_ingestion_service(db: Session) -> TranscriptIngestionService:
    """Factory function to get TranscriptIngestionService instance"""
    return TranscriptIngestionService(db)

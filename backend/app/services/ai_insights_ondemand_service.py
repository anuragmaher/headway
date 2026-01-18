"""
On-Demand AI Insights Service

This service handles AI insights extraction when users click on messages.
It implements a smart caching strategy:
1. Check Redis cache first (fast, short TTL)
2. Check database for persisted insights
3. Extract insights via AI API if not found
4. Cache the result and persist to database

Architecture:
- Redis cache: Short-lived cache for frequently accessed messages (5 min TTL)
- Database persistence: Permanent storage for all extracted insights
- Async-friendly design for non-blocking API calls
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.services.ai_insights_service import get_ai_insights_service, AIInsightsService
from app.services.cache_service import get_cache_service, CacheService
from app.models.message import Message
from app.models.gmail import GmailThread
from app.models.theme import Theme

logger = logging.getLogger(__name__)

# Cache configuration
AI_INSIGHTS_CACHE_TTL = timedelta(minutes=5)  # Short TTL for hot cache
AI_INSIGHTS_NAMESPACE = "ai_insights"


class OnDemandAIInsightsService:
    """
    Service for on-demand AI insights extraction with multi-tier caching.

    Caching Strategy:
    1. Redis Cache (L1): Fast access, 5-minute TTL
    2. Database (L2): Persistent storage, no TTL
    3. AI API (L3): Generate if not cached/persisted

    Usage:
        service = get_ondemand_ai_insights_service(db)
        insights = service.get_or_extract_insights(
            workspace_id="...",
            message_id="...",
            message_type="message"  # or "gmail_thread"
        )
    """

    def __init__(self, db: Session):
        self.db = db
        self._ai_service: Optional[AIInsightsService] = None
        self._cache_service: Optional[CacheService] = None

    @property
    def ai_service(self) -> AIInsightsService:
        """Lazy-load AI insights service."""
        if self._ai_service is None:
            self._ai_service = get_ai_insights_service()
        return self._ai_service

    @property
    def cache_service(self) -> CacheService:
        """Lazy-load cache service."""
        if self._cache_service is None:
            self._cache_service = get_cache_service()
        return self._cache_service

    def get_or_extract_insights(
        self,
        workspace_id: UUID,
        message_id: UUID,
        message_type: str = "message",
        force_refresh: bool = False,
    ) -> Tuple[Dict[str, Any], str]:
        """
        Get AI insights for a message, extracting if necessary.

        This method implements a multi-tier caching strategy:
        1. Check Redis cache (if not force_refresh)
        2. Check database for persisted insights
        3. Extract new insights via AI API
        4. Cache and persist the result

        Args:
            workspace_id: Workspace UUID
            message_id: Message or GmailThread UUID
            message_type: "message" or "gmail_thread"
            force_refresh: If True, bypass cache and re-extract

        Returns:
            Tuple of (insights_dict, source) where source is:
            - "cache": From Redis cache
            - "database": From database
            - "extracted": Newly extracted via AI
            - "error": Extraction failed
        """
        cache_key = self._make_cache_key(workspace_id, message_id)

        # Step 1: Check Redis cache (unless force_refresh)
        if not force_refresh:
            cached = self._get_from_cache(cache_key)
            if cached:
                logger.debug(f"AI insights cache hit: {message_id}")
                return cached, "cache"

        # Step 2: Get the record from database
        record, model_class = self._get_record(message_id, message_type)

        if not record:
            logger.warning(f"Record not found: {message_type}/{message_id}")
            return self._error_response("Record not found"), "error"

        # Verify workspace ownership
        if str(record.workspace_id) != str(workspace_id):
            logger.warning(f"Workspace mismatch for {message_type}/{message_id}")
            return self._error_response("Access denied"), "error"

        # Step 3: Check database for existing insights (unless force_refresh)
        if not force_refresh and record.ai_insights:
            # Validate insights structure
            if self._is_valid_insights(record.ai_insights):
                # Cache it for faster future access
                self._set_in_cache(cache_key, record.ai_insights)
                logger.debug(f"AI insights from database: {message_id}")
                return record.ai_insights, "database"

        # Step 4: Extract new insights
        insights = self._extract_insights(record, message_type)

        if insights and not insights.get("error"):
            # Persist to database
            self._persist_insights(record, insights)

            # Cache for fast access
            self._set_in_cache(cache_key, insights)

            logger.info(f"AI insights extracted: {message_id}")
            return insights, "extracted"

        logger.error(f"AI insights extraction failed: {message_id}")
        return insights or self._error_response("Extraction failed"), "error"

    def invalidate_cache(self, workspace_id: UUID, message_id: UUID) -> bool:
        """
        Invalidate cached AI insights for a message.

        Use this when message content changes and insights need re-extraction.
        """
        cache_key = self._make_cache_key(workspace_id, message_id)
        return self.cache_service.delete(AI_INSIGHTS_NAMESPACE, cache_key)

    def batch_preload_cache(
        self,
        workspace_id: UUID,
        message_ids: list[UUID],
    ) -> Dict[str, bool]:
        """
        Preload cache with existing database insights.

        Useful for preloading a page of messages.
        Does NOT extract new insights, only caches existing ones.

        Args:
            workspace_id: Workspace UUID
            message_ids: List of message UUIDs to preload

        Returns:
            Dict mapping message_id to True (cached) or False (no insights)
        """
        results = {}

        for message_id in message_ids:
            cache_key = self._make_cache_key(workspace_id, message_id)

            # Skip if already cached
            if self._get_from_cache(cache_key):
                results[str(message_id)] = True
                continue

            # Try to get from database and cache
            # First try Message table
            record = self.db.query(Message).filter(
                Message.id == message_id,
                Message.workspace_id == workspace_id
            ).first()

            if not record:
                # Try GmailThread table
                record = self.db.query(GmailThread).filter(
                    GmailThread.id == message_id,
                    GmailThread.workspace_id == workspace_id
                ).first()

            if record and record.ai_insights and self._is_valid_insights(record.ai_insights):
                self._set_in_cache(cache_key, record.ai_insights)
                results[str(message_id)] = True
            else:
                results[str(message_id)] = False

        return results

    def _make_cache_key(self, workspace_id: UUID, message_id: UUID) -> str:
        """Create cache key for message insights."""
        return f"{workspace_id}:{message_id}"

    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get insights from Redis cache."""
        return self.cache_service.get(AI_INSIGHTS_NAMESPACE, cache_key)

    def _set_in_cache(self, cache_key: str, insights: Dict[str, Any]) -> bool:
        """Set insights in Redis cache."""
        return self.cache_service.set(
            AI_INSIGHTS_NAMESPACE,
            cache_key,
            value=insights,
            ttl=AI_INSIGHTS_CACHE_TTL
        )

    def _get_record(
        self,
        message_id: UUID,
        message_type: str
    ) -> Tuple[Optional[Message | GmailThread], Optional[type]]:
        """Get message record from appropriate table."""
        if message_type == "gmail_thread":
            record = self.db.query(GmailThread).filter(
                GmailThread.id == message_id
            ).first()
            return record, GmailThread
        else:
            # Try Message table first
            record = self.db.query(Message).filter(
                Message.id == message_id
            ).first()

            if record:
                return record, Message

            # Fall back to GmailThread
            record = self.db.query(GmailThread).filter(
                GmailThread.id == message_id
            ).first()

            return record, GmailThread if record else None

    def _is_valid_insights(self, insights: Any) -> bool:
        """Check if insights structure is valid and not empty."""
        if not isinstance(insights, dict):
            return False

        # Check for error markers
        if insights.get("error") or insights.get("extraction_metadata", {}).get("error"):
            return False

        # Check for meaningful content
        has_content = (
            insights.get("classified_themes") or
            insights.get("feature_requests") or
            insights.get("pain_points") or
            insights.get("summary") or
            insights.get("key_topics")
        )

        # Empty but valid (just no actionable content)
        if insights.get("extraction_metadata", {}).get("skip_reason"):
            return True

        return bool(has_content)

    def _extract_insights(
        self,
        record: Message | GmailThread,
        message_type: str
    ) -> Dict[str, Any]:
        """Extract AI insights from message content."""
        try:
            # Validate content
            if not record.content:
                return self._skip_response("no_content")

            # Determine source type
            if message_type == "gmail_thread":
                source_type = "gmail"
            else:
                source_type = getattr(record, "source", "unknown")

            # Get workspace themes for context-aware extraction
            themes = self._get_workspace_themes(record.workspace_id)

            # Build metadata for context
            metadata = self._build_metadata(record, message_type)

            # Extract insights via AI service
            insights = self.ai_service.extract_insights(
                content=record.content,
                source_type=source_type,
                themes=themes,
                metadata=metadata,
            )

            # Add on-demand metadata
            insights["extraction_metadata"] = insights.get("extraction_metadata", {})
            insights["extraction_metadata"]["extraction_mode"] = "on_demand"
            insights["extraction_metadata"]["requested_at"] = datetime.now(timezone.utc).isoformat()

            return insights

        except Exception as e:
            logger.error(f"AI extraction error for {record.id}: {e}")
            return self._error_response(str(e))

    def _get_workspace_themes(self, workspace_id: UUID) -> list[Dict[str, str]]:
        """Get themes for workspace."""
        return self.ai_service.get_workspace_themes(self.db, workspace_id)

    def _build_metadata(
        self,
        record: Message | GmailThread,
        message_type: str
    ) -> Dict[str, Any]:
        """Build metadata for AI extraction."""
        if message_type == "gmail_thread":
            return {
                "sender": getattr(record, "from_name", None) or getattr(record, "from_email", None),
                "subject": getattr(record, "subject", None),
                "source_type": "gmail",
            }
        else:
            return {
                "sender": getattr(record, "author_name", None) or getattr(record, "author_email", None),
                "subject": getattr(record, "title", None),
                "source_type": getattr(record, "source", "unknown"),
            }

    def _persist_insights(
        self,
        record: Message | GmailThread,
        insights: Dict[str, Any]
    ) -> None:
        """Persist insights to database."""
        try:
            record.ai_insights = insights
            record.ai_processed_at = datetime.now(timezone.utc)
            record.is_processed = True
            record.ai_processing_error = None
            self.db.commit()
            logger.debug(f"Persisted AI insights for {record.id}")
        except Exception as e:
            logger.error(f"Failed to persist insights for {record.id}: {e}")
            self.db.rollback()

    def _error_response(self, error: str) -> Dict[str, Any]:
        """Create error response structure."""
        return {
            "error": error,
            "classified_themes": [],
            "feature_requests": [],
            "pain_points": [],
            "sentiment": {"overall": "neutral", "score": 0.5},
            "summary": None,
            "key_topics": [],
            "extraction_metadata": {
                "error": error,
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "extraction_mode": "on_demand",
            }
        }

    def _skip_response(self, reason: str) -> Dict[str, Any]:
        """Create skip response structure."""
        return {
            "classified_themes": [],
            "feature_requests": [],
            "pain_points": [],
            "sentiment": {"overall": "neutral", "score": 0.5},
            "summary": None,
            "key_topics": [],
            "extraction_metadata": {
                "skipped": True,
                "skip_reason": reason,
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "extraction_mode": "on_demand",
            }
        }


# Factory function
def get_ondemand_ai_insights_service(db: Session) -> OnDemandAIInsightsService:
    """Create an on-demand AI insights service instance."""
    return OnDemandAIInsightsService(db)

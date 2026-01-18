"""
Sync Items Service - Handles retrieval of synced items with caching.

This service:
- Retrieves items synced during a specific sync operation
- Supports all source types (Gmail, Slack, Gong, Fathom)
- Uses Redis caching for fast retrieval
- Falls back to database when cache misses
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.feature import Feature
from app.models.sync_history import SyncHistory
from app.models.gmail import GmailThread
from app.services.cache_service import (
    cache_sync_items,
    get_cached_sync_items,
    invalidate_sync_items_cache,
)

logger = logging.getLogger(__name__)


class SyncItemsService:
    """Service for retrieving synced items with caching support."""

    def __init__(self, db: Session):
        self.db = db

    def get_synced_items(
        self,
        workspace_id: UUID,
        sync_id: UUID,
        page: int = 1,
        page_size: int = 20,
        use_cache: bool = True,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Get items that were synced in a specific sync operation.

        Args:
            workspace_id: Workspace UUID
            sync_id: Sync history UUID
            page: Page number
            page_size: Items per page
            use_cache: Whether to use caching (default True)
            force_refresh: Force bypass cache and fetch fresh data

        Returns:
            Dict with synced items and metadata
        """
        # Get sync record first to check status
        sync_record = self.db.query(SyncHistory).filter(
            SyncHistory.id == sync_id,
            SyncHistory.workspace_id == workspace_id
        ).first()

        if not sync_record:
            return self._empty_response(None, None)

        # Don't use cache for in-progress syncs or when force_refresh is True
        should_use_cache = use_cache and not force_refresh and sync_record.status == 'success'

        # Try cache first (only for completed syncs)
        if should_use_cache:
            cached = get_cached_sync_items(str(workspace_id), str(sync_id), page)
            if cached:
                logger.debug(f"Cache hit for sync items: {sync_id}, page {page}")
                return cached

        # Route to appropriate handler based on sync type
        if sync_record.sync_type == 'source' and sync_record.source_type:
            result = self._get_source_items(sync_record, workspace_id, page, page_size)
        elif sync_record.sync_type == 'theme':
            result = self._get_theme_items(sync_record, workspace_id, page, page_size)
        else:
            result = self._empty_response(sync_record.sync_type, sync_record.source_type)

        # Only cache completed syncs with items
        if should_use_cache and result.get('items'):
            cache_sync_items(str(workspace_id), str(sync_id), page, result)

        return result

    def _empty_response(
        self,
        sync_type: Optional[str],
        source_type: Optional[str]
    ) -> Dict[str, Any]:
        """Return an empty response structure."""
        return {
            'items': [],
            'total': 0,
            'page': 1,
            'page_size': 20,
            'total_pages': 1,
            'has_next': False,
            'has_prev': False,
            'sync_type': sync_type,
            'source_type': source_type,
        }

    def _paginate_response(
        self,
        items: List[Dict],
        total: int,
        page: int,
        page_size: int,
        sync_type: str,
        source_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Build a paginated response."""
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        return {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1,
            'sync_type': sync_type,
            'source_type': source_type,
        }

    def _get_source_items(
        self,
        sync_record: SyncHistory,
        workspace_id: UUID,
        page: int,
        page_size: int
    ) -> Dict[str, Any]:
        """Get items for source syncs (Gmail, Slack, Gong, Fathom)."""
        source_type = sync_record.source_type

        handlers = {
            'gmail': self._get_gmail_items,
            'slack': self._get_slack_items,
            'gong': self._get_gong_items,
            'fathom': self._get_fathom_items,
        }

        handler = handlers.get(source_type)
        if handler:
            return handler(sync_record, workspace_id, page, page_size)

        logger.warning(f"Unknown source type: {source_type}")
        return self._empty_response('source', source_type)

    def _get_time_window(self, sync_record: SyncHistory) -> tuple:
        """
        Get time window for querying synced items with tolerance.

        Uses tolerance to account for:
        - Database transaction timing
        - Clock skew
        - Items committed slightly before/after sync boundaries

        Returns:
            Tuple of (start_time, end_time) with tolerances applied
        """
        # Start 2 seconds before to catch items created right at sync start
        start_time = sync_record.started_at - timedelta(seconds=2)

        if sync_record.completed_at:
            # Add 10 second tolerance after completion for items committed slightly after
            end_time = sync_record.completed_at + timedelta(seconds=10)
        else:
            # Sync still in progress - use current time with some buffer
            end_time = datetime.now(timezone.utc) + timedelta(seconds=5)

        return start_time, end_time

    def _get_gmail_items(
        self,
        sync_record: SyncHistory,
        workspace_id: UUID,
        page: int,
        page_size: int
    ) -> Dict[str, Any]:
        """Get Gmail threads synced during this operation."""
        start_time, end_time = self._get_time_window(sync_record)

        query = self.db.query(GmailThread).filter(
            GmailThread.workspace_id == workspace_id,
            GmailThread.created_at >= start_time,
            GmailThread.created_at <= end_time
        )

        total = query.count()
        offset = (page - 1) * page_size
        threads = query.order_by(desc(GmailThread.thread_date)).offset(offset).limit(page_size).all()

        items = [{
            'id': str(thread.id),
            'type': 'gmail_thread',
            'title': thread.subject,
            'subject': thread.subject,
            'from_name': thread.from_name,
            'from_email': thread.from_email,
            'to_emails': thread.to_emails,
            'snippet': thread.snippet,
            'content': thread.content[:500] if thread.content else None,  # Limit content size
            'message_count': thread.message_count,
            'thread_date': thread.thread_date.isoformat() if thread.thread_date else None,
            'label_name': thread.label_name,
            'created_at': thread.created_at.isoformat() if thread.created_at else None,
        } for thread in threads]

        return self._paginate_response(items, total, page, page_size, 'source', 'gmail')

    def _get_slack_items(
        self,
        sync_record: SyncHistory,
        workspace_id: UUID,
        page: int,
        page_size: int
    ) -> Dict[str, Any]:
        """Get Slack messages synced during this operation."""
        start_time, end_time = self._get_time_window(sync_record)

        query = self.db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == 'slack',
            Message.created_at >= start_time,
            Message.created_at <= end_time
        )

        total = query.count()
        offset = (page - 1) * page_size
        messages = query.order_by(desc(Message.sent_at)).offset(offset).limit(page_size).all()

        items = [{
            'id': str(msg.id),
            'type': 'slack_message',
            'title': msg.title,
            'author_name': msg.author_name,
            'author_email': msg.author_email,
            'channel_name': msg.channel_name,
            'content': msg.content[:500] if msg.content else None,  # Limit content size
            'sent_at': msg.sent_at.isoformat() if msg.sent_at else None,
            'created_at': msg.created_at.isoformat() if msg.created_at else None,
        } for msg in messages]

        return self._paginate_response(items, total, page, page_size, 'source', 'slack')

    def _get_gong_items(
        self,
        sync_record: SyncHistory,
        workspace_id: UUID,
        page: int,
        page_size: int
    ) -> Dict[str, Any]:
        """Get Gong calls synced during this operation."""
        start_time, end_time = self._get_time_window(sync_record)

        query = self.db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == 'gong',
            Message.created_at >= start_time,
            Message.created_at <= end_time
        )

        total = query.count()
        offset = (page - 1) * page_size
        calls = query.order_by(desc(Message.sent_at)).offset(offset).limit(page_size).all()

        items = []
        for call in calls:
            metadata = call.message_metadata or {}
            duration_secs = metadata.get('duration_seconds') or metadata.get('duration')
            items.append({
                'id': str(call.id),
                'type': 'gong_call',
                'title': call.title or metadata.get('title', 'Gong Call'),
                'author_name': call.author_name,
                'author_email': call.author_email,
                'channel_name': call.channel_name or 'Gong Calls',
                'content': call.content[:500] if call.content else None,  # Limit content
                'duration': duration_secs,
                'duration_formatted': self._format_duration(duration_secs),
                'parties': metadata.get('parties', []),
                'has_transcript': metadata.get('has_transcript', False),
                'customer_info': {
                    'name': metadata.get('customer_name'),
                    'email': metadata.get('customer_domain'),
                } if metadata.get('customer_name') else None,
                'call_id': metadata.get('call_id') or call.external_id,
                'sent_at': call.sent_at.isoformat() if call.sent_at else None,
                'created_at': call.created_at.isoformat() if call.created_at else None,
            })

        return self._paginate_response(items, total, page, page_size, 'source', 'gong')

    def _get_fathom_items(
        self,
        sync_record: SyncHistory,
        workspace_id: UUID,
        page: int,
        page_size: int
    ) -> Dict[str, Any]:
        """Get Fathom sessions synced during this operation."""
        start_time, end_time = self._get_time_window(sync_record)

        query = self.db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.source == 'fathom',
            Message.created_at >= start_time,
            Message.created_at <= end_time
        )

        total = query.count()
        offset = (page - 1) * page_size
        sessions = query.order_by(desc(Message.sent_at)).offset(offset).limit(page_size).all()

        items = []
        for session in sessions:
            metadata = session.message_metadata or {}
            duration_secs = metadata.get('duration_seconds') or metadata.get('duration')
            # Get participants from calendar_invitees
            calendar_invitees = metadata.get('calendar_invitees', [])
            participants = [
                {'name': inv.get('name'), 'email': inv.get('email')}
                for inv in calendar_invitees if inv.get('name') or inv.get('email')
            ]
            items.append({
                'id': str(session.id),
                'type': 'fathom_session',
                'title': session.title or metadata.get('title', 'Fathom Session'),
                'author_name': session.author_name,
                'author_email': session.author_email,
                'channel_name': session.channel_name or 'Fathom Sessions',
                'content': session.content[:500] if session.content else None,  # Limit content
                'duration': duration_secs,
                'duration_formatted': self._format_duration(duration_secs),
                'recording_url': metadata.get('recording_url'),
                'session_id': metadata.get('session_id') or session.external_id,
                'participants': participants,
                'has_transcript': metadata.get('has_transcript', False),
                'customer_info': {
                    'name': metadata.get('customer_name'),
                    'email': metadata.get('customer_email'),
                } if metadata.get('customer_name') else None,
                'sent_at': session.sent_at.isoformat() if session.sent_at else None,
                'created_at': session.created_at.isoformat() if session.created_at else None,
            })

        return self._paginate_response(items, total, page, page_size, 'source', 'fathom')

    def _get_theme_items(
        self,
        sync_record: SyncHistory,
        workspace_id: UUID,
        page: int,
        page_size: int
    ) -> Dict[str, Any]:
        """Get features updated during theme sync."""
        start_time, end_time = self._get_time_window(sync_record)

        query = self.db.query(Feature).filter(
            Feature.workspace_id == workspace_id,
            Feature.updated_at >= start_time,
            Feature.updated_at <= end_time
        )

        total = query.count()
        offset = (page - 1) * page_size
        features = query.order_by(desc(Feature.updated_at)).offset(offset).limit(page_size).all()

        items = [{
            'id': str(feature.id),
            'type': 'feature',
            'title': feature.title,
            'description': feature.description,
            'theme_id': str(feature.theme_id) if feature.theme_id else None,
            'theme_name': feature.theme.name if feature.theme else None,
            'message_count': feature.message_count,
            'updated_at': feature.updated_at.isoformat() if feature.updated_at else None,
        } for feature in features]

        return self._paginate_response(items, total, page, page_size, 'theme', None)

    def _format_duration(self, seconds: Optional[int]) -> Optional[str]:
        """Format duration in seconds to human-readable string."""
        if not seconds:
            return None
        minutes, secs = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m {secs}s"


def get_sync_items_service(db: Session) -> SyncItemsService:
    """Factory function to get SyncItemsService instance."""
    return SyncItemsService(db)

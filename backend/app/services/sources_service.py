"""
Sources Service - Business logic for data sources and sync operations

Uses the new unified schema:
- WorkspaceConnector: All data sources (Slack, Gmail, Gong, Fathom)
- Message: All messages from all sources (including Gmail)
- CustomerAsk: Feature requests (replaces Feature)
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, and_, or_, func

from app.models.message import Message
from app.models.workspace_connector import WorkspaceConnector
from app.models.theme import Theme
from app.models.customer_ask import CustomerAsk
from app.models.sync_history import SyncHistory
from app.schemas.sources import (
    MessageResponse,
    MessageListResponse,
    SyncHistoryResponse,
    SyncHistoryListResponse,
    DataSourceStatus,
    DataSourcesStatusResponse,
    SyncOperationResponse,
)

logger = logging.getLogger(__name__)


class SourcesService:
    """Service for managing data sources and sync operations"""

    def __init__(self, db: Session):
        self.db = db

    # ============ Message Operations ============

    def get_messages_paginated(
        self,
        workspace_id: UUID,
        page: int = 1,
        page_size: int = 5,
        source_filter: Optional[str] = None,
        sort_by: Optional[str] = "timestamp",
        sort_order: Optional[str] = "desc",
    ) -> MessageListResponse:
        """
        Get paginated list of messages from all sources.

        All sources (Slack, Gmail, Gong, Fathom) are stored in the unified Message table.

        Args:
            workspace_id: Workspace UUID
            page: Page number (1-indexed)
            page_size: Number of items per page
            source_filter: Optional filter by source type (gmail, slack, gong, fathom)
            sort_by: Field to sort by (timestamp, sender, source)
            sort_order: Sort order (asc, desc)

        Returns:
            Paginated message list response
        """
        query = self.db.query(Message).filter(Message.workspace_id == workspace_id)

        # Apply source filter
        if source_filter and source_filter != 'all':
            query = query.filter(Message.source == source_filter)

        # Get total count
        total = query.count()
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size

        # Determine sort column
        if sort_by == "sender":
            sort_col = Message.author_name
        elif sort_by == "source":
            sort_col = Message.source
        else:
            sort_col = Message.sent_at

        # Apply sort order
        if sort_order == "asc":
            order_clause = asc(sort_col)
        else:
            order_clause = desc(sort_col)

        # Get paginated results
        messages = query.order_by(order_clause).offset(offset).limit(page_size).all()

        # Convert to response
        message_responses = []
        for msg in messages:
            source_type = self._get_message_type(msg.source)
            preview = self._get_preview(msg.content)
            sender = msg.author_name or msg.author_email or msg.from_email or "Unknown"

            message_responses.append(MessageResponse(
                id=str(msg.id),
                title=msg.title or self._generate_title(msg),
                sender=sender,
                sender_email=msg.author_email or msg.from_email,
                source_type=source_type,
                source=msg.source,
                preview=preview,
                content=msg.content,
                timestamp=msg.sent_at,
                channel_name=msg.channel_name or msg.label_name,
                tier1_processed=msg.tier1_processed,
                tier2_processed=msg.tier2_processed,
            ))

        return MessageListResponse(
            messages=message_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )

    def _get_default_title(self, source: str) -> str:
        """Get default title based on source type"""
        titles = {
            'slack': 'Slack Message',
            'gmail': 'Email Thread',
            'gong': 'Gong Call',
            'fathom': 'Fathom Meeting',
        }
        return titles.get(source, 'Message')

    def _get_message_type(self, source: str) -> str:
        """Map source to message type"""
        mapping = {
            'gmail': 'email',
            'outlook': 'email',
            'slack': 'slack',
            'gong': 'transcript',
            'fathom': 'meeting',
        }
        return mapping.get(source, 'email')

    def _get_preview(self, content: Optional[str], max_length: int = 150) -> str:
        """Generate preview from content"""
        if not content:
            return ""
        # Remove newlines and extra whitespace
        preview = ' '.join(content.split())
        if len(preview) > max_length:
            return preview[:max_length] + "..."
        return preview

    def _generate_title(self, msg: Message) -> str:
        """Generate title from message if not present"""
        if msg.title:
            return msg.title
        if msg.channel_name:
            return f"Message from {msg.channel_name}"
        if msg.label_name:
            return f"Email from {msg.label_name}"
        if msg.source == 'gmail':
            return "Email Thread"
        if msg.source == 'slack':
            return "Slack Message"
        if msg.source == 'gong':
            return "Gong Call"
        if msg.source == 'fathom':
            return "Fathom Meeting"
        return "Message"

    def get_message_details(
        self,
        workspace_id: UUID,
        message_id: UUID,
    ) -> Dict[str, Any]:
        """
        Get full details of a specific message.

        Args:
            workspace_id: Workspace UUID
            message_id: Message UUID

        Returns:
            Complete message details

        Raises:
            HTTPException: If message not found
        """
        from fastapi import HTTPException, status

        message = self.db.query(Message).filter(
            Message.id == message_id,
            Message.workspace_id == workspace_id,
        ).first()

        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )

        return self._format_message_details(message)

    def _format_message_details(self, msg: Message) -> Dict[str, Any]:
        """Format Message model to detailed response"""
        metadata = msg.message_metadata or {}

        # Extract duration for Gong/Fathom
        duration_secs = metadata.get('duration_seconds') or metadata.get('duration')
        duration_formatted = None
        if duration_secs:
            try:
                duration_secs = int(duration_secs)
                mins, secs = divmod(duration_secs, 60)
                hours, mins = divmod(mins, 60)
                if hours > 0:
                    duration_formatted = f"{hours}h {mins}m"
                else:
                    duration_formatted = f"{mins}m {secs}s"
            except (ValueError, TypeError):
                duration_secs = None

        # Get related customer_ask if linked
        related_customer_asks = []
        classified_themes = []
        if msg.customer_ask_id:
            customer_ask = self.db.query(CustomerAsk).filter(
                CustomerAsk.id == msg.customer_ask_id
            ).first()
            if customer_ask:
                related_customer_asks.append({
                    'id': str(customer_ask.id),
                    'name': customer_ask.name,
                    'sub_theme_id': str(customer_ask.sub_theme_id) if customer_ask.sub_theme_id else None,
                    'confidence': customer_ask.match_confidence,
                })

        # AI insights
        ai_insights = {}
        if isinstance(ai_insights, dict) and 'classified_themes' not in ai_insights and classified_themes:
            ai_insights = {**ai_insights, 'classified_themes': classified_themes}

        # Parse to_emails for Gmail messages
        to_emails_list = []
        if msg.to_emails:
            raw_emails = msg.to_emails.replace('\n', ',').replace(';', ',')
            to_emails_list = [e.strip() for e in raw_emails.split(',') if e.strip()]

        return {
            'id': str(msg.id),
            'type': self._get_message_type(msg.source),
            'source': msg.source,
            'title': msg.title or self._generate_title(msg),
            'content': msg.content,
            'sender': msg.author_name or msg.author_email or msg.from_email or 'Unknown',
            'sender_email': msg.author_email or msg.from_email,
            'channel_name': msg.channel_name or msg.label_name,
            'sent_at': msg.sent_at.isoformat() if msg.sent_at else None,
            'created_at': msg.created_at.isoformat() if msg.created_at else None,
            'tier1_processed': msg.tier1_processed,
            'tier2_processed': msg.tier2_processed,
            'processed_at': msg.processed_at.isoformat() if msg.processed_at else None,
            # Metadata fields
            'metadata': metadata,
            'ai_insights': ai_insights,
            'thread_id': msg.thread_id,
            # Gong/Fathom specific fields
            'duration': duration_secs,
            'duration_formatted': duration_formatted,
            'parties': metadata.get('parties', []),
            'participants': metadata.get('participants', []),
            'customer_info': {
                'name': metadata.get('customer_name'),
                'email': metadata.get('customer_email') or metadata.get('customer_domain'),
            } if metadata.get('customer_name') else None,
            'recording_url': metadata.get('recording_url'),
            'has_transcript': metadata.get('has_transcript', False),
            'call_id': metadata.get('call_id') or msg.external_id,
            'session_id': metadata.get('session_id') or msg.external_id,
            # Gmail specific fields
            'subject': msg.title if msg.source == 'gmail' else None,
            'from_name': msg.author_name if msg.source == 'gmail' else None,
            'from_email': msg.from_email,
            'to_emails': to_emails_list if msg.source == 'gmail' else [],
            'snippet': metadata.get('snippet'),
            'message_count': msg.message_count,
            'thread_date': msg.sent_at.isoformat() if msg.sent_at and msg.source == 'gmail' else None,
            'label_name': msg.label_name,
            # Related customer asks
            'related_customer_asks': related_customer_asks,
        }

    # ============ Sync History Operations ============

    def get_sync_history_paginated(
        self,
        workspace_id: UUID,
        page: int = 1,
        page_size: int = 10,
        source_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        sort_by: Optional[str] = "started_at",
        sort_order: Optional[str] = "desc",
    ) -> SyncHistoryListResponse:
        """
        Get paginated sync history.

        Args:
            workspace_id: Workspace UUID
            page: Page number (1-indexed)
            page_size: Number of items per page
            source_filter: Optional filter by source type
            type_filter: Optional filter by sync type ('source' or 'theme')
            sort_by: Field to sort by (type, status, started_at)
            sort_order: Sort order (asc, desc)

        Returns:
            Paginated sync history response
        """
        query = self.db.query(
            SyncHistory.id,
            SyncHistory.sync_type,
            SyncHistory.source_type,
            SyncHistory.source_name,
            SyncHistory.theme_name,
            SyncHistory.theme_sources,
            SyncHistory.status,
            SyncHistory.trigger_type,
            SyncHistory.started_at,
            SyncHistory.completed_at,
            SyncHistory.items_processed,
            SyncHistory.items_new,
            SyncHistory.error_message,
        ).filter(SyncHistory.workspace_id == workspace_id)

        # Apply filters
        if source_filter and source_filter != 'all':
            query = query.filter(SyncHistory.source_type == source_filter)

        if type_filter and type_filter != 'all':
            query = query.filter(SyncHistory.sync_type == type_filter)

        # Get total count
        count_query = self.db.query(func.count(SyncHistory.id)).filter(
            SyncHistory.workspace_id == workspace_id
        )
        if source_filter and source_filter != 'all':
            count_query = count_query.filter(SyncHistory.source_type == source_filter)
        if type_filter and type_filter != 'all':
            count_query = count_query.filter(SyncHistory.sync_type == type_filter)
        total = count_query.scalar() or 0

        # Calculate pagination
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size

        # Determine sort column
        sort_column_map = {
            "type": SyncHistory.sync_type,
            "status": SyncHistory.status,
            "started_at": SyncHistory.started_at,
        }
        sort_column = sort_column_map.get(sort_by, SyncHistory.started_at)

        # Apply sort order
        if sort_order == "asc":
            order_clause = asc(sort_column)
        else:
            order_clause = desc(sort_column)

        # Get paginated results
        items = query.order_by(order_clause).offset(offset).limit(page_size).all()

        # Convert to response format
        history_responses = [
            SyncHistoryResponse(
                id=str(item[0]),
                sync_type=item[1],
                source_type=item[2],
                source_name=item[3],
                theme_name=item[4],
                theme_sources=item[5],
                status=item[6],
                trigger_type=item[7] or "manual",
                started_at=item[8],
                completed_at=item[9],
                items_processed=item[10],
                items_new=item[11],
                error_message=item[12],
            )
            for item in items
        ]

        return SyncHistoryListResponse(
            items=history_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )

    # ============ Data Source Status ============

    def get_data_sources_status(self, workspace_id: UUID) -> DataSourcesStatusResponse:
        """
        Get status of all connected data sources for a workspace.

        Uses the unified WorkspaceConnector model for all sources.

        Args:
            workspace_id: Workspace UUID

        Returns:
            Status of all data sources
        """
        from sqlalchemy import text

        sources: List[DataSourceStatus] = []
        workspace_str = str(workspace_id)

        # Batch query: Get all message counts by source in a single query
        message_counts_query = text("""
            SELECT source, COUNT(*) as count
            FROM messages
            WHERE workspace_id = :workspace_id
            GROUP BY source
        """)
        self.db.execute(message_counts_query, {"workspace_id": workspace_str})

        # Batch query: Get message counts by connector_id
        connector_counts_query = text("""
            SELECT connector_id::text, COUNT(*) as count
            FROM messages
            WHERE workspace_id = :workspace_id AND connector_id IS NOT NULL
            GROUP BY connector_id
        """)
        connector_counts_result = self.db.execute(
            connector_counts_query, {"workspace_id": workspace_str}
        )
        connector_message_counts = {row[0]: row[1] for row in connector_counts_result}

        # Get all connectors for the workspace
        connectors = self.db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == workspace_id,
                WorkspaceConnector.is_active == True
            )
        ).all()

        for connector in connectors:
            connector_id_str = str(connector.id)
            message_count = connector_message_counts.get(connector_id_str, 0)

            # Use external_name or name as display name
            display_name = connector.external_name or connector.name or connector.connector_type.capitalize()

            sources.append(DataSourceStatus(
                source_type=connector.connector_type,
                source_name=display_name,
                is_active=connector.is_active,
                last_synced_at=connector.last_synced_at,
                sync_status=connector.sync_status,
                message_count=message_count,
            ))

        # Calculate totals
        total_messages = sum(s.message_count for s in sources)
        last_sync = None
        for s in sources:
            if s.last_synced_at:
                if last_sync is None or s.last_synced_at > last_sync:
                    last_sync = s.last_synced_at

        return DataSourcesStatusResponse(
            sources=sources,
            total_messages=total_messages,
            last_sync_at=last_sync,
        )

    # ============ Sync Operations ============

    def create_sync_record(
        self,
        workspace_id: UUID,
        sync_type: str,
        source_type: Optional[str] = None,
        source_name: Optional[str] = None,
        theme_id: Optional[UUID] = None,
        theme_name: Optional[str] = None,
        theme_sources: Optional[List[str]] = None,
        connector_id: Optional[UUID] = None,
    ) -> SyncHistory:
        """
        Create a new sync history record.

        Args:
            workspace_id: Workspace UUID
            sync_type: 'source' or 'theme'
            source_type: Type of source being synced
            source_name: Display name of source
            theme_id: Theme UUID (for theme syncs)
            theme_name: Theme name (for theme syncs)
            theme_sources: List of sources contributing to theme
            connector_id: WorkspaceConnector UUID

        Returns:
            Created SyncHistory record
        """
        sync_record = SyncHistory(
            workspace_id=workspace_id,
            sync_type=sync_type,
            source_type=source_type,
            source_name=source_name,
            theme_id=theme_id,
            theme_name=theme_name,
            theme_sources=theme_sources,
            connector_id=connector_id,
            status="pending",
        )

        self.db.add(sync_record)
        self.db.commit()
        self.db.refresh(sync_record)

        return sync_record

    def update_sync_record(
        self,
        sync_id: UUID,
        status: str,
        items_processed: int = 0,
        items_new: int = 0,
        items_updated: int = 0,
        error_message: Optional[str] = None,
    ) -> Optional[SyncHistory]:
        """
        Update a sync history record.

        Args:
            sync_id: Sync record UUID
            status: New status
            items_processed: Number of items processed
            items_new: Number of new items
            items_updated: Number of updated items
            error_message: Error message if failed

        Returns:
            Updated SyncHistory record
        """
        sync_record = self.db.query(SyncHistory).filter(SyncHistory.id == sync_id).first()
        if not sync_record:
            return None

        sync_record.status = status
        sync_record.items_processed = items_processed
        sync_record.items_new = items_new
        sync_record.items_updated = items_updated
        sync_record.error_message = error_message

        if status in ['success', 'failed']:
            sync_record.completed_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(sync_record)

        return sync_record

    def get_connected_sources(self, workspace_id: UUID) -> List[Dict[str, Any]]:
        """
        Get list of connected data sources with their details.

        Returns list of dicts with source info for syncing.
        """
        sources = []

        # Get all active connectors
        connectors = self.db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == workspace_id,
                WorkspaceConnector.is_active == True
            )
        ).all()

        for connector in connectors:
            display_name = connector.external_name or connector.name or connector.connector_type.capitalize()
            sources.append({
                'type': connector.connector_type,
                'name': display_name,
                'connector_id': connector.id,
            })

        return sources

    def get_workspace_themes(self, workspace_id: UUID) -> List[Theme]:
        """Get all themes for a workspace"""
        return self.db.query(Theme).filter(Theme.workspace_id == workspace_id).all()

    def get_synced_items(
        self,
        workspace_id: UUID,
        sync_id: UUID,
        page: int = 1,
        page_size: int = 20,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Get items that were synced in a specific sync operation.

        Delegates to SyncItemsService which handles caching and
        supports all source types (Gmail, Slack, Gong, Fathom).

        Args:
            workspace_id: Workspace UUID
            sync_id: Sync history UUID
            page: Page number
            page_size: Items per page
            force_refresh: Force bypass cache and fetch fresh data

        Returns:
            Dict with synced items and metadata
        """
        from app.services.sync_items_service import get_sync_items_service
        sync_items_service = get_sync_items_service(self.db)
        return sync_items_service.get_synced_items(
            workspace_id=workspace_id,
            sync_id=sync_id,
            page=page,
            page_size=page_size,
            force_refresh=force_refresh,
        )


def get_sources_service(db: Session) -> SourcesService:
    """Factory function to get SourcesService instance"""
    return SourcesService(db)

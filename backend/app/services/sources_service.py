"""
Sources Service - Business logic for data sources and sync operations
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_, func

from app.models.message import Message
from app.models.integration import Integration
from app.models.gmail import GmailAccounts, GmailThread
from app.models.workspace_connector import WorkspaceConnector
from app.models.theme import Theme
from app.models.feature import Feature
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
    ) -> MessageListResponse:
        """
        Get paginated list of messages from all sources.

        This includes:
        - Messages from the Message table (Slack, processed Gmail, Gong, Fathom)
        - Gmail threads from the GmailThread table (raw Gmail data)

        Args:
            workspace_id: Workspace UUID
            page: Page number (1-indexed)
            page_size: Number of items per page
            source_filter: Optional filter by source type (gmail, slack, gong, fathom)

        Returns:
            Paginated message list response
        """
        message_responses = []

        # If filtering for gmail only, get from GmailThread table
        if source_filter == 'gmail':
            return self._get_gmail_threads_paginated(workspace_id, page, page_size)

        # If no filter or filter is not gmail, include regular messages
        if source_filter != 'gmail':
            # Build base query for Message table
            query = self.db.query(Message).filter(Message.workspace_id == workspace_id)

            # Apply source filter if provided (exclude gmail from Message table as we fetch from GmailThread)
            if source_filter and source_filter != 'all':
                query = query.filter(Message.source == source_filter)
            else:
                # When showing all, exclude gmail from Message table to avoid duplicates
                query = query.filter(Message.source != 'gmail')

            # Get messages from Message table
            messages = query.order_by(desc(Message.sent_at)).all()

            for msg in messages:
                source_type = self._get_message_type(msg.source)
                preview = self._get_preview(msg.content)
                sender = msg.author_name or msg.author_email or "Unknown"

                message_responses.append({
                    'id': str(msg.id),
                    'title': msg.title or self._generate_title(msg),
                    'sender': sender,
                    'sender_email': msg.author_email,
                    'source_type': source_type,
                    'source': msg.source,
                    'preview': preview,
                    'content': msg.content,
                    'timestamp': msg.sent_at,
                    'channel_name': msg.channel_name,
                    'is_processed': msg.is_processed,
                })

        # If no filter (all) or filter is gmail, also include Gmail threads
        if not source_filter or source_filter == 'all':
            gmail_threads = self.db.query(GmailThread).filter(
                GmailThread.workspace_id == workspace_id
            ).order_by(desc(GmailThread.thread_date)).all()

            for thread in gmail_threads:
                preview = self._get_preview(thread.content or thread.snippet)
                sender = thread.from_name or thread.from_email or "Unknown"

                message_responses.append({
                    'id': str(thread.id),
                    'title': thread.subject or "Email Thread",
                    'sender': sender,
                    'sender_email': thread.from_email,
                    'source_type': 'email',
                    'source': 'gmail',
                    'preview': preview,
                    'content': thread.content,
                    'timestamp': thread.thread_date,
                    'channel_name': thread.label_name,
                    'is_processed': thread.is_processed,
                })

        # Sort all items by timestamp descending
        message_responses.sort(key=lambda x: x['timestamp'] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

        # Get total count and paginate
        total = len(message_responses)
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size

        # Slice for current page
        paginated_items = message_responses[offset:offset + page_size]

        # Convert to response objects
        final_responses = [
            MessageResponse(
                id=item['id'],
                title=item['title'],
                sender=item['sender'],
                sender_email=item['sender_email'],
                source_type=item['source_type'],
                source=item['source'],
                preview=item['preview'],
                content=item['content'],
                timestamp=item['timestamp'],
                channel_name=item['channel_name'],
                is_processed=item['is_processed'],
            )
            for item in paginated_items
        ]

        return MessageListResponse(
            messages=final_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )

    def _get_gmail_threads_paginated(
        self,
        workspace_id: UUID,
        page: int = 1,
        page_size: int = 5,
    ) -> MessageListResponse:
        """Get paginated Gmail threads only."""
        query = self.db.query(GmailThread).filter(
            GmailThread.workspace_id == workspace_id
        )

        total = query.count()
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size

        threads = query.order_by(desc(GmailThread.thread_date)).offset(offset).limit(page_size).all()

        message_responses = []
        for thread in threads:
            preview = self._get_preview(thread.content or thread.snippet)
            sender = thread.from_name or thread.from_email or "Unknown"

            message_responses.append(MessageResponse(
                id=str(thread.id),
                title=thread.subject or "Email Thread",
                sender=sender,
                sender_email=thread.from_email,
                source_type='email',
                source='gmail',
                preview=preview,
                content=thread.content,
                timestamp=thread.thread_date,
                channel_name=thread.label_name,
                is_processed=thread.is_processed,
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
        if msg.source == 'gmail':
            return "Email Thread"
        if msg.source == 'slack':
            return "Slack Message"
        if msg.source == 'gong':
            return "Gong Call"
        if msg.source == 'fathom':
            return "Fathom Meeting"
        return "Message"
    
    # ============ Sync History Operations ============
    
    def get_sync_history_paginated(
        self,
        workspace_id: UUID,
        page: int = 1,
        page_size: int = 10,
        source_filter: Optional[str] = None,
        type_filter: Optional[str] = None,  # 'source' or 'theme'
    ) -> SyncHistoryListResponse:
        """
        Get paginated sync history.

        Args:
            workspace_id: Workspace UUID
            page: Page number (1-indexed)
            page_size: Number of items per page
            source_filter: Optional filter by source type
            type_filter: Optional filter by sync type ('source' or 'theme')

        Returns:
            Paginated sync history response
        """
        # Build base query - select only columns we need to avoid relationship loading
        query = self.db.query(
            SyncHistory.id,
            SyncHistory.sync_type,
            SyncHistory.source_type,
            SyncHistory.source_name,
            SyncHistory.theme_name,
            SyncHistory.theme_sources,
            SyncHistory.status,
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

        # Get total count (need separate query for count)
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

        # Get paginated results ordered by started_at descending
        items = query.order_by(desc(SyncHistory.started_at)).offset(offset).limit(page_size).all()

        # Convert to response format (items are tuples now, not ORM objects)
        history_responses = [
            SyncHistoryResponse(
                id=str(item[0]),  # id
                sync_type=item[1],  # sync_type
                source_type=item[2],  # source_type
                source_name=item[3],  # source_name
                theme_name=item[4],  # theme_name
                theme_sources=item[5],  # theme_sources
                status=item[6],  # status
                started_at=item[7],  # started_at
                completed_at=item[8],  # completed_at
                items_processed=item[9],  # items_processed
                items_new=item[10],  # items_new
                error_message=item[11],  # error_message
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
        
        Args:
            workspace_id: Workspace UUID
            
        Returns:
            Status of all data sources
        """
        sources: List[DataSourceStatus] = []
        
        # Check Slack integrations
        slack_integrations = self.db.query(Integration).filter(
            and_(
                Integration.workspace_id == workspace_id,
                Integration.provider == "slack",
                Integration.is_active == True
            )
        ).all()
        
        for integration in slack_integrations:
            message_count = self.db.query(func.count(Message.id)).filter(
                and_(
                    Message.workspace_id == workspace_id,
                    Message.integration_id == integration.id
                )
            ).scalar() or 0
            
            sources.append(DataSourceStatus(
                source_type="slack",
                source_name=integration.external_team_name or "Slack",
                is_active=integration.is_active,
                last_synced_at=integration.last_synced_at,
                sync_status=integration.sync_status,
                message_count=message_count,
            ))
        
        # Check Gmail accounts
        gmail_accounts = self.db.query(GmailAccounts).filter(
            and_(
                GmailAccounts.workspace_id == workspace_id,
                GmailAccounts.access_token.isnot(None)
            )
        ).all()
        
        for account in gmail_accounts:
            # Count Gmail threads
            thread_count = self.db.query(func.count(GmailThread.id)).filter(
                GmailThread.gmail_account_id == account.id
            ).scalar() or 0
            
            # Also count messages from gmail integration
            gmail_integration = self.db.query(Integration).filter(
                and_(
                    Integration.workspace_id == workspace_id,
                    Integration.provider == "gmail"
                )
            ).first()
            
            message_count = 0
            if gmail_integration:
                message_count = self.db.query(func.count(Message.id)).filter(
                    and_(
                        Message.workspace_id == workspace_id,
                        Message.source == "gmail"
                    )
                ).scalar() or 0
            
            sources.append(DataSourceStatus(
                source_type="gmail",
                source_name=account.gmail_email or "Gmail",
                is_active=True,
                last_synced_at=account.last_synced_at,
                sync_status=account.sync_status,
                message_count=message_count + thread_count,
            ))
        
        # Check Gong connectors
        gong_connectors = self.db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == workspace_id,
                WorkspaceConnector.connector_type == "gong",
                WorkspaceConnector.is_active == True
            )
        ).all()
        
        for connector in gong_connectors:
            message_count = self.db.query(func.count(Message.id)).filter(
                and_(
                    Message.workspace_id == workspace_id,
                    Message.source == "gong"
                )
            ).scalar() or 0
            
            sources.append(DataSourceStatus(
                source_type="gong",
                source_name="Gong",
                is_active=connector.is_active,
                last_synced_at=None,  # Connectors don't track this
                sync_status="active",
                message_count=message_count,
            ))
        
        # Check Fathom connectors
        fathom_connectors = self.db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == workspace_id,
                WorkspaceConnector.connector_type == "fathom",
                WorkspaceConnector.is_active == True
            )
        ).all()
        
        for connector in fathom_connectors:
            message_count = self.db.query(func.count(Message.id)).filter(
                and_(
                    Message.workspace_id == workspace_id,
                    Message.source == "fathom"
                )
            ).scalar() or 0
            
            sources.append(DataSourceStatus(
                source_type="fathom",
                source_name="Fathom",
                is_active=connector.is_active,
                last_synced_at=None,
                sync_status="active",
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
        integration_id: Optional[UUID] = None,
        gmail_account_id: Optional[UUID] = None,
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
            integration_id: Integration UUID
            gmail_account_id: Gmail account UUID
            connector_id: Connector UUID
            
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
            integration_id=integration_id,
            gmail_account_id=gmail_account_id,
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
        
        # Slack integrations
        slack_integrations = self.db.query(Integration).filter(
            and_(
                Integration.workspace_id == workspace_id,
                Integration.provider == "slack",
                Integration.is_active == True
            )
        ).all()
        
        for integration in slack_integrations:
            sources.append({
                'type': 'slack',
                'name': integration.external_team_name or 'Slack',
                'integration_id': integration.id,
            })
        
        # Gmail accounts
        gmail_accounts = self.db.query(GmailAccounts).filter(
            and_(
                GmailAccounts.workspace_id == workspace_id,
                GmailAccounts.access_token.isnot(None)
            )
        ).all()
        
        for account in gmail_accounts:
            sources.append({
                'type': 'gmail',
                'name': account.gmail_email or 'Gmail',
                'gmail_account_id': account.id,
            })
        
        # Gong connectors
        gong_connectors = self.db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == workspace_id,
                WorkspaceConnector.connector_type == "gong",
                WorkspaceConnector.is_active == True
            )
        ).all()
        
        for connector in gong_connectors:
            sources.append({
                'type': 'gong',
                'name': 'Gong',
                'connector_id': connector.id,
            })
        
        # Fathom connectors
        fathom_connectors = self.db.query(WorkspaceConnector).filter(
            and_(
                WorkspaceConnector.workspace_id == workspace_id,
                WorkspaceConnector.connector_type == "fathom",
                WorkspaceConnector.is_active == True
            )
        ).all()
        
        for connector in fathom_connectors:
            sources.append({
                'type': 'fathom',
                'name': 'Fathom',
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
    ) -> Dict[str, Any]:
        """
        Get items that were synced in a specific sync operation.

        Args:
            workspace_id: Workspace UUID
            sync_id: Sync history UUID
            page: Page number
            page_size: Items per page

        Returns:
            Dict with synced items and metadata
        """
        # Get sync record to determine type
        sync_record = self.db.query(SyncHistory).filter(
            SyncHistory.id == sync_id,
            SyncHistory.workspace_id == workspace_id
        ).first()

        if not sync_record:
            return {
                'items': [],
                'total': 0,
                'sync_type': None,
                'source_type': None,
            }

        items = []
        total = 0

        # For source syncs, get items created during the sync window
        if sync_record.sync_type == 'source' and sync_record.source_type:
            if sync_record.source_type == 'gmail':
                # Get Gmail threads created during this sync
                from app.models.gmail import GmailThread

                query = self.db.query(GmailThread).filter(
                    GmailThread.workspace_id == workspace_id,
                    GmailThread.created_at >= sync_record.started_at
                )

                if sync_record.completed_at:
                    query = query.filter(GmailThread.created_at <= sync_record.completed_at)

                total = query.count()
                offset = (page - 1) * page_size

                threads = query.order_by(desc(GmailThread.thread_date)).offset(offset).limit(page_size).all()

                items = [{
                    'id': str(thread.id),
                    'type': 'gmail_thread',
                    'subject': thread.subject,
                    'from_name': thread.from_name,
                    'from_email': thread.from_email,
                    'to_emails': thread.to_emails,
                    'snippet': thread.snippet,
                    'content': thread.content,
                    'message_count': thread.message_count,
                    'thread_date': thread.thread_date.isoformat() if thread.thread_date else None,
                    'label_name': thread.label_name,
                    'created_at': thread.created_at.isoformat() if thread.created_at else None,
                } for thread in threads]

            elif sync_record.source_type == 'slack':
                # Get messages created during this sync
                query = self.db.query(Message).filter(
                    Message.workspace_id == workspace_id,
                    Message.source == 'slack',
                    Message.created_at >= sync_record.started_at
                )

                if sync_record.completed_at:
                    query = query.filter(Message.created_at <= sync_record.completed_at)

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
                    'content': msg.content,
                    'sent_at': msg.sent_at.isoformat() if msg.sent_at else None,
                    'created_at': msg.created_at.isoformat() if msg.created_at else None,
                } for msg in messages]

        elif sync_record.sync_type == 'theme':
            # For theme syncs, get features updated during this sync
            query = self.db.query(Feature).filter(
                Feature.workspace_id == workspace_id,
                Feature.updated_at >= sync_record.started_at
            )

            if sync_record.completed_at:
                query = query.filter(Feature.updated_at <= sync_record.completed_at)

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

        total_pages = (total + page_size - 1) // page_size if total > 0 else 1

        return {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1,
            'sync_type': sync_record.sync_type,
            'source_type': sync_record.source_type,
        }


def get_sources_service(db: Session) -> SourcesService:
    """Factory function to get SourcesService instance"""
    return SourcesService(db)

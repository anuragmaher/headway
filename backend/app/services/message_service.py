"""
Message Service for managing messages and AI insights
"""
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc

from app.models.message import Message
from app.models.workspace_connector import WorkspaceConnector
from app.models.customer_ask import CustomerAsk
from app.schemas.message import (
    MessageCreate, MessageUpdate, MessageResponse, SourceType
)


class MessageService:
    """Service for managing messages"""

    def __init__(self, db: Session):
        self.db = db

    # === Message CRUD ===

    def create_message(self, workspace_id: UUID, data: MessageCreate) -> Message:
        """Create a new message"""
        message = Message(
            workspace_id=workspace_id,
            connector_id=data.connector_id,
            customer_ask_id=data.customer_ask_id,
            customer_id=data.customer_id,
            source=data.source.value,
            external_id=data.external_id,
            thread_id=data.thread_id,
            content=data.content,
            title=data.title,
            channel_name=data.channel_name,
            channel_id=data.channel_id,
            label_name=data.label_name,
            author_name=data.author_name,
            author_email=data.author_email,
            author_id=data.author_id,
            from_email=data.from_email,
            to_emails=data.to_emails,
            message_count=data.message_count,
            message_metadata=data.message_metadata,
            sent_at=data.sent_at,
            tier1_processed=False,
            tier2_processed=False,
        )
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def get_or_create_message(
        self,
        workspace_id: UUID,
        connector_id: UUID,
        external_id: str,
        data: MessageCreate
    ) -> Tuple[Message, bool]:
        """Get existing message or create new one. Returns (message, created)"""
        existing = self.get_message_by_external_id(workspace_id, connector_id, external_id)
        if existing:
            return existing, False

        message = self.create_message(workspace_id, data)
        return message, True

    def get_message(self, message_id: UUID) -> Optional[Message]:
        """Get a message by ID"""
        return self.db.query(Message).filter(Message.id == message_id).first()

    def get_message_by_external_id(
        self,
        workspace_id: UUID,
        connector_id: UUID,
        external_id: str
    ) -> Optional[Message]:
        """Get a message by workspace, connector, and external ID"""
        return self.db.query(Message).filter(
            and_(
                Message.workspace_id == workspace_id,
                Message.connector_id == connector_id,
                Message.external_id == external_id
            )
        ).first()

    def list_messages(
        self,
        workspace_id: UUID,
        source: Optional[str] = None,
        connector_id: Optional[UUID] = None,
        customer_ask_id: Optional[UUID] = None,
        tier1_processed: Optional[bool] = None,
        tier2_processed: Optional[bool] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[Message], int]:
        """List messages with pagination and filters"""
        query = self.db.query(Message).filter(Message.workspace_id == workspace_id)

        if source:
            query = query.filter(Message.source == source)
        if connector_id:
            query = query.filter(Message.connector_id == connector_id)
        if customer_ask_id:
            query = query.filter(Message.customer_ask_id == customer_ask_id)
        if tier1_processed is not None:
            query = query.filter(Message.tier1_processed == tier1_processed)
        if tier2_processed is not None:
            query = query.filter(Message.tier2_processed == tier2_processed)

        total = query.count()
        messages = query.order_by(desc(Message.sent_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return messages, total

    def list_unprocessed_messages(
        self,
        workspace_id: UUID,
        limit: int = 100
    ) -> List[Message]:
        """Get messages pending Tier 1 AI processing"""
        return self.db.query(Message).filter(
            and_(
                Message.workspace_id == workspace_id,
                Message.tier1_processed == False
            )
        ).order_by(Message.created_at).limit(limit).all()

    def update_message(self, message_id: UUID, data: MessageUpdate) -> Optional[Message]:
        """Update a message"""
        message = self.get_message(message_id)
        if not message:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(message, field, value)

        message.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(message)
        return message

    def mark_tier1_processed(
        self,
        message_id: UUID,
        feature_score: Optional[float] = None
    ) -> Optional[Message]:
        """Mark a message as Tier 1 processed (classification complete)"""
        message = self.get_message(message_id)
        if not message:
            return None

        message.tier1_processed = True
        message.processed_at = datetime.now(timezone.utc)
        if feature_score is not None:
            message.feature_score = feature_score

        message.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(message)
        return message

    def mark_tier2_processed(
        self,
        message_id: UUID,
    ) -> Optional[Message]:
        """Mark a message as Tier 2 processed (extraction complete)"""
        message = self.get_message(message_id)
        if not message:
            return None

        message.tier2_processed = True
        message.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(message)
        return message

    def assign_to_customer_ask(
        self,
        message_id: UUID,
        customer_ask_id: UUID
    ) -> Optional[Message]:
        """Assign a message to a customer ask"""
        message = self.get_message(message_id)
        if not message:
            return None

        message.customer_ask_id = customer_ask_id
        message.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(message)
        return message

    def delete_message(self, message_id: UUID) -> bool:
        """Delete a message"""
        message = self.get_message(message_id)
        if not message:
            return False

        self.db.delete(message)
        self.db.commit()
        return True

    def bulk_create_messages(
        self,
        workspace_id: UUID,
        messages_data: List[MessageCreate]
    ) -> List[Message]:
        """Bulk create messages"""
        messages = []
        for data in messages_data:
            message = Message(
                workspace_id=workspace_id,
                connector_id=data.connector_id,
                customer_ask_id=data.customer_ask_id,
                customer_id=data.customer_id,
                source=data.source.value,
                external_id=data.external_id,
                thread_id=data.thread_id,
                content=data.content,
                title=data.title,
                channel_name=data.channel_name,
                channel_id=data.channel_id,
                label_name=data.label_name,
                author_name=data.author_name,
                author_email=data.author_email,
                author_id=data.author_id,
                from_email=data.from_email,
                to_emails=data.to_emails,
                message_count=data.message_count,
                message_metadata=data.message_metadata,
                sent_at=data.sent_at,
                tier1_processed=False,
                tier2_processed=False,
            )
            messages.append(message)

        self.db.bulk_save_objects(messages)
        self.db.commit()
        return messages

    def search_messages(
        self,
        workspace_id: UUID,
        query: str,
        limit: int = 50
    ) -> List[Message]:
        """Search messages by content"""
        return self.db.query(Message).filter(
            and_(
                Message.workspace_id == workspace_id,
                Message.content.ilike(f"%{query}%")
            )
        ).order_by(desc(Message.sent_at)).limit(limit).all()

    def get_message_stats(self, workspace_id: UUID) -> Dict[str, Any]:
        """Get message statistics for a workspace"""
        total = self.db.query(func.count(Message.id)).filter(
            Message.workspace_id == workspace_id
        ).scalar() or 0

        tier1_processed = self.db.query(func.count(Message.id)).filter(
            and_(
                Message.workspace_id == workspace_id,
                Message.tier1_processed == True
            )
        ).scalar() or 0

        tier2_processed = self.db.query(func.count(Message.id)).filter(
            and_(
                Message.workspace_id == workspace_id,
                Message.tier2_processed == True
            )
        ).scalar() or 0

        by_source = self.db.query(
            Message.source,
            func.count(Message.id)
        ).filter(
            Message.workspace_id == workspace_id
        ).group_by(Message.source).all()

        return {
            "total": total,
            "tier1_processed": tier1_processed,
            "tier2_processed": tier2_processed,
            "tier1_pending": total - tier1_processed,
            "tier2_pending": tier1_processed - tier2_processed,  # Only tier1 complete can be tier2 pending
            "by_source": {source: count for source, count in by_source}
        }



# NOTE: AIInsightService has been removed.
# AI insights are now handled via transcript_classifications table.
# See app.services.theme_service.TranscriptClassificationService for new functionality.

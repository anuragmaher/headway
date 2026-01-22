"""
Message Service for managing messages and AI insights
"""
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc

from app.models.message import Message
from app.models.ai_insight import AIInsight
from app.models.workspace_connector import WorkspaceConnector
from app.models.customer_ask import CustomerAsk
from app.schemas.message import (
    MessageCreate, MessageUpdate, MessageResponse,
    AIInsightCreate, AIInsightResponse, SourceType
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
            is_processed=False
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
        is_processed: Optional[bool] = None,
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
        if is_processed is not None:
            query = query.filter(Message.is_processed == is_processed)

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
        """Get unprocessed messages for AI processing"""
        return self.db.query(Message).filter(
            and_(
                Message.workspace_id == workspace_id,
                Message.is_processed == False
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

    def mark_processed(
        self,
        message_id: UUID,
        feature_score: Optional[float] = None
    ) -> Optional[Message]:
        """Mark a message as processed"""
        message = self.get_message(message_id)
        if not message:
            return None

        message.is_processed = True
        message.processed_at = datetime.now(timezone.utc)
        if feature_score is not None:
            message.feature_score = feature_score

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
                is_processed=False
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

        processed = self.db.query(func.count(Message.id)).filter(
            and_(
                Message.workspace_id == workspace_id,
                Message.is_processed == True
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
            "processed": processed,
            "unprocessed": total - processed,
            "by_source": {source: count for source, count in by_source}
        }


class AIInsightService:
    """Service for managing AI insights"""

    def __init__(self, db: Session):
        self.db = db

    # === AI Insight CRUD ===

    def create_insight(self, workspace_id: UUID, data: AIInsightCreate) -> AIInsight:
        """Create a new AI insight"""
        insight = AIInsight(
            message_id=data.message_id,
            workspace_id=workspace_id,
            theme_id=data.theme_id,
            sub_theme_id=data.sub_theme_id,
            customer_ask_id=data.customer_ask_id,
            model_version=data.model_version,
            summary=data.summary,
            pain_point=data.pain_point,
            pain_point_quote=data.pain_point_quote,
            feature_request=data.feature_request,
            customer_usecase=data.customer_usecase,
            sentiment=data.sentiment.value if data.sentiment else None,
            keywords=data.keywords,
            tokens_used=data.tokens_used
        )
        self.db.add(insight)
        self.db.commit()
        self.db.refresh(insight)
        return insight

    def get_or_create_insight(
        self,
        workspace_id: UUID,
        message_id: UUID,
        model_version: str,
        data: AIInsightCreate
    ) -> Tuple[AIInsight, bool]:
        """Get existing insight or create new one"""
        existing = self.get_insight_by_message(message_id, model_version)
        if existing:
            return existing, False

        insight = self.create_insight(workspace_id, data)
        return insight, True

    def get_insight(self, insight_id: UUID) -> Optional[AIInsight]:
        """Get an insight by ID"""
        return self.db.query(AIInsight).filter(AIInsight.id == insight_id).first()

    def get_insight_by_message(
        self,
        message_id: UUID,
        model_version: Optional[str] = None
    ) -> Optional[AIInsight]:
        """Get insight for a message"""
        query = self.db.query(AIInsight).filter(AIInsight.message_id == message_id)

        if model_version:
            query = query.filter(AIInsight.model_version == model_version)

        return query.first()

    def list_insights(
        self,
        workspace_id: UUID,
        theme_id: Optional[UUID] = None,
        sub_theme_id: Optional[UUID] = None,
        customer_ask_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[AIInsight], int]:
        """List AI insights with pagination and filters"""
        query = self.db.query(AIInsight).filter(AIInsight.workspace_id == workspace_id)

        if theme_id:
            query = query.filter(AIInsight.theme_id == theme_id)
        if sub_theme_id:
            query = query.filter(AIInsight.sub_theme_id == sub_theme_id)
        if customer_ask_id:
            query = query.filter(AIInsight.customer_ask_id == customer_ask_id)

        total = query.count()
        insights = query.order_by(desc(AIInsight.created_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return insights, total

    def update_insight(
        self,
        insight_id: UUID,
        theme_id: Optional[UUID] = None,
        sub_theme_id: Optional[UUID] = None,
        customer_ask_id: Optional[UUID] = None
    ) -> Optional[AIInsight]:
        """Update insight theme/customer_ask assignment"""
        insight = self.get_insight(insight_id)
        if not insight:
            return None

        if theme_id is not None:
            insight.theme_id = theme_id
        if sub_theme_id is not None:
            insight.sub_theme_id = sub_theme_id
        if customer_ask_id is not None:
            insight.customer_ask_id = customer_ask_id

        insight.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(insight)
        return insight

    def delete_insight(self, insight_id: UUID) -> bool:
        """Delete an AI insight"""
        insight = self.get_insight(insight_id)
        if not insight:
            return False

        self.db.delete(insight)
        self.db.commit()
        return True

    def get_insights_with_messages(
        self,
        workspace_id: UUID,
        limit: int = 100
    ) -> List[AIInsight]:
        """Get insights with loaded message relationships"""
        return self.db.query(AIInsight).options(
            joinedload(AIInsight.message)
        ).filter(
            AIInsight.workspace_id == workspace_id
        ).order_by(desc(AIInsight.created_at)).limit(limit).all()

"""
Theme Service for managing the theme hierarchy (Theme -> SubTheme -> CustomerAsk)
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func

from app.models.theme import Theme
from app.models.sub_theme import SubTheme
from app.models.customer_ask import CustomerAsk
from app.models.message import Message
from app.models.ai_insight import AIInsight
from app.schemas.theme import (
    ThemeCreate, ThemeUpdate, ThemeResponse, ThemeWithSubThemes, ThemeHierarchy,
    SubThemeCreate, SubThemeUpdate, SubThemeResponse, SubThemeWithCustomerAsks,
    CustomerAskCreate, CustomerAskUpdate, CustomerAskResponse
)
from app.schemas.mention import MentionResponse, AIInsightResponse


class ThemeService:
    """Service for managing themes"""

    def __init__(self, db: Session):
        self.db = db

    # === Theme CRUD ===

    def create_theme(self, workspace_id: UUID, data: ThemeCreate) -> Theme:
        """Create a new theme"""
        # Get max sort_order for the workspace
        max_order = self.db.query(func.max(Theme.sort_order)).filter(
            Theme.workspace_id == workspace_id
        ).scalar() or 0

        theme = Theme(
            workspace_id=workspace_id,
            name=data.name,
            description=data.description,
            sort_order=data.sort_order if data.sort_order > 0 else max_order + 1
        )
        self.db.add(theme)
        self.db.commit()
        self.db.refresh(theme)
        return theme

    def get_theme(self, theme_id: UUID) -> Optional[Theme]:
        """Get a theme by ID"""
        return self.db.query(Theme).filter(Theme.id == theme_id).first()

    def list_themes(self, workspace_id: UUID) -> List[Theme]:
        """List all themes for a workspace"""
        return self.db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).order_by(Theme.sort_order).all()

    def list_themes_with_counts(self, workspace_id: UUID) -> List[Dict[str, Any]]:
        """List themes with sub-theme and customer ask counts"""
        themes = self.list_themes(workspace_id)
        result = []

        for theme in themes:
            sub_theme_count = self.db.query(func.count(SubTheme.id)).filter(
                SubTheme.theme_id == theme.id
            ).scalar() or 0

            customer_ask_count = self.db.query(func.count(CustomerAsk.id)).join(
                SubTheme, CustomerAsk.sub_theme_id == SubTheme.id
            ).filter(SubTheme.theme_id == theme.id).scalar() or 0

            result.append({
                **theme.__dict__,
                "sub_theme_count": sub_theme_count,
                "customer_ask_count": customer_ask_count
            })

        return result

    def get_theme_hierarchy(self, workspace_id: UUID) -> List[Dict[str, Any]]:
        """Get full theme hierarchy with sub-themes and customer asks"""
        themes = self.db.query(Theme).options(
            joinedload(Theme.sub_themes).joinedload(SubTheme.customer_asks)
        ).filter(Theme.workspace_id == workspace_id).order_by(Theme.sort_order).all()

        return themes

    def update_theme(self, theme_id: UUID, data: ThemeUpdate) -> Optional[Theme]:
        """Update a theme"""
        theme = self.get_theme(theme_id)
        if not theme:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(theme, field, value)

        theme.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(theme)
        return theme

    def delete_theme(self, theme_id: UUID) -> bool:
        """Delete a theme (cascades to sub-themes and customer asks)"""
        theme = self.get_theme(theme_id)
        if not theme:
            return False

        self.db.delete(theme)
        self.db.commit()
        return True

    def reorder_themes(self, workspace_id: UUID, theme_ids: List[UUID]) -> List[Theme]:
        """Reorder themes by providing list of theme IDs in desired order"""
        themes = self.db.query(Theme).filter(
            and_(Theme.workspace_id == workspace_id, Theme.id.in_(theme_ids))
        ).all()

        theme_map = {t.id: t for t in themes}

        for index, theme_id in enumerate(theme_ids):
            if theme_id in theme_map:
                theme_map[theme_id].sort_order = index

        self.db.commit()
        return self.list_themes(workspace_id)


class SubThemeService:
    """Service for managing sub-themes"""

    def __init__(self, db: Session):
        self.db = db

    # === SubTheme CRUD ===

    def create_sub_theme(self, workspace_id: UUID, data: SubThemeCreate) -> SubTheme:
        """Create a new sub-theme"""
        # Get max sort_order for the theme
        max_order = self.db.query(func.max(SubTheme.sort_order)).filter(
            SubTheme.theme_id == data.theme_id
        ).scalar() or 0

        sub_theme = SubTheme(
            theme_id=data.theme_id,
            workspace_id=workspace_id,
            name=data.name,
            description=data.description,
            sort_order=data.sort_order if data.sort_order > 0 else max_order + 1
        )
        self.db.add(sub_theme)
        self.db.commit()
        self.db.refresh(sub_theme)
        return sub_theme

    def get_sub_theme(self, sub_theme_id: UUID) -> Optional[SubTheme]:
        """Get a sub-theme by ID"""
        return self.db.query(SubTheme).filter(SubTheme.id == sub_theme_id).first()

    def list_sub_themes(self, theme_id: UUID) -> List[SubTheme]:
        """List all sub-themes for a theme"""
        return self.db.query(SubTheme).filter(
            SubTheme.theme_id == theme_id
        ).order_by(SubTheme.sort_order).all()

    def list_sub_themes_by_workspace(self, workspace_id: UUID) -> List[SubTheme]:
        """List all sub-themes for a workspace"""
        return self.db.query(SubTheme).filter(
            SubTheme.workspace_id == workspace_id
        ).order_by(SubTheme.sort_order).all()

    def list_sub_themes_with_counts(self, theme_id: UUID) -> List[Dict[str, Any]]:
        """List sub-themes with customer ask counts"""
        sub_themes = self.list_sub_themes(theme_id)
        result = []

        for sub_theme in sub_themes:
            customer_ask_count = self.db.query(func.count(CustomerAsk.id)).filter(
                CustomerAsk.sub_theme_id == sub_theme.id
            ).scalar() or 0

            result.append({
                **sub_theme.__dict__,
                "customer_ask_count": customer_ask_count
            })

        return result

    def update_sub_theme(self, sub_theme_id: UUID, data: SubThemeUpdate) -> Optional[SubTheme]:
        """Update a sub-theme"""
        sub_theme = self.get_sub_theme(sub_theme_id)
        if not sub_theme:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(sub_theme, field, value)

        sub_theme.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(sub_theme)
        return sub_theme

    def delete_sub_theme(self, sub_theme_id: UUID) -> bool:
        """Delete a sub-theme (cascades to customer asks)"""
        sub_theme = self.get_sub_theme(sub_theme_id)
        if not sub_theme:
            return False

        self.db.delete(sub_theme)
        self.db.commit()
        return True

    def move_sub_theme(self, sub_theme_id: UUID, new_theme_id: UUID) -> Optional[SubTheme]:
        """Move a sub-theme to a different theme"""
        sub_theme = self.get_sub_theme(sub_theme_id)
        if not sub_theme:
            return None

        sub_theme.theme_id = new_theme_id
        sub_theme.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(sub_theme)
        return sub_theme


class CustomerAskService:
    """Service for managing customer asks"""

    def __init__(self, db: Session):
        self.db = db

    # === CustomerAsk CRUD ===

    def create_customer_ask(self, workspace_id: UUID, data: CustomerAskCreate) -> CustomerAsk:
        """Create a new customer ask"""
        customer_ask = CustomerAsk(
            sub_theme_id=data.sub_theme_id,
            workspace_id=workspace_id,
            name=data.name,
            description=data.description,
            urgency=data.urgency.value,
            status=data.status.value
        )
        self.db.add(customer_ask)
        self.db.commit()
        self.db.refresh(customer_ask)
        return customer_ask

    def get_customer_ask(self, customer_ask_id: UUID) -> Optional[CustomerAsk]:
        """Get a customer ask by ID"""
        return self.db.query(CustomerAsk).filter(
            CustomerAsk.id == customer_ask_id
        ).first()

    def list_customer_asks(
        self,
        workspace_id: UUID,
        sub_theme_id: Optional[UUID] = None,
        status: Optional[str] = None
    ) -> List[CustomerAsk]:
        """List customer asks with optional filters"""
        query = self.db.query(CustomerAsk).filter(
            CustomerAsk.workspace_id == workspace_id
        )

        if sub_theme_id:
            query = query.filter(CustomerAsk.sub_theme_id == sub_theme_id)

        if status:
            query = query.filter(CustomerAsk.status == status)

        return query.order_by(CustomerAsk.last_mentioned_at.desc().nullsfirst()).all()

    def list_customer_asks_with_message_counts(
        self,
        workspace_id: UUID,
        sub_theme_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """List customer asks with message counts"""
        customer_asks = self.list_customer_asks(workspace_id, sub_theme_id)
        result = []

        for ca in customer_asks:
            message_count = self.db.query(func.count(Message.id)).filter(
                Message.customer_ask_id == ca.id
            ).scalar() or 0

            result.append({
                **ca.__dict__,
                "message_count": message_count
            })

        return result

    def update_customer_ask(
        self,
        customer_ask_id: UUID,
        data: CustomerAskUpdate
    ) -> Optional[CustomerAsk]:
        """Update a customer ask"""
        customer_ask = self.get_customer_ask(customer_ask_id)
        if not customer_ask:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Convert enums to values
        if "urgency" in update_data and update_data["urgency"]:
            update_data["urgency"] = update_data["urgency"].value
        if "status" in update_data and update_data["status"]:
            update_data["status"] = update_data["status"].value

        for field, value in update_data.items():
            setattr(customer_ask, field, value)

        customer_ask.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(customer_ask)
        return customer_ask

    def delete_customer_ask(self, customer_ask_id: UUID) -> bool:
        """Delete a customer ask"""
        customer_ask = self.get_customer_ask(customer_ask_id)
        if not customer_ask:
            return False

        self.db.delete(customer_ask)
        self.db.commit()
        return True

    def increment_mention_count(
        self,
        customer_ask_id: UUID,
        mentioned_at: Optional[datetime] = None
    ) -> Optional[CustomerAsk]:
        """Increment mention count and update timestamps"""
        customer_ask = self.get_customer_ask(customer_ask_id)
        if not customer_ask:
            return None

        customer_ask.mention_count += 1
        timestamp = mentioned_at or datetime.now(timezone.utc)

        if not customer_ask.first_mentioned_at:
            customer_ask.first_mentioned_at = timestamp

        customer_ask.last_mentioned_at = timestamp
        customer_ask.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(customer_ask)
        return customer_ask

    def move_customer_ask(
        self,
        customer_ask_id: UUID,
        new_sub_theme_id: UUID
    ) -> Optional[CustomerAsk]:
        """Move a customer ask to a different sub-theme"""
        customer_ask = self.get_customer_ask(customer_ask_id)
        if not customer_ask:
            return None

        customer_ask.sub_theme_id = new_sub_theme_id
        customer_ask.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(customer_ask)
        return customer_ask

    def search_customer_asks(
        self,
        workspace_id: UUID,
        query: str,
        limit: int = 20
    ) -> List[CustomerAsk]:
        """Search customer asks by name or description"""
        return self.db.query(CustomerAsk).filter(
            and_(
                CustomerAsk.workspace_id == workspace_id,
                CustomerAsk.name.ilike(f"%{query}%") |
                CustomerAsk.description.ilike(f"%{query}%")
            )
        ).limit(limit).all()

    def get_mentions_for_customer_ask(
        self,
        customer_ask_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get mentions (messages) for a customer ask with AI insights.

        Returns messages linked to the customer ask along with their AI insights.
        """
        # Get total count
        total_count = self.db.query(func.count(Message.id)).filter(
            Message.customer_ask_id == customer_ask_id
        ).scalar() or 0

        # Get messages with eager loading of AI insights
        messages = self.db.query(Message).options(
            joinedload(Message.ai_insights)
        ).filter(
            Message.customer_ask_id == customer_ask_id
        ).order_by(
            Message.sent_at.desc().nullsfirst()
        ).offset(offset).limit(limit).all()

        # Transform to response format
        mentions = []
        for msg in messages:
            # Get the first AI insight (most recent by model version)
            ai_insight = None
            if msg.ai_insights:
                latest_insight = msg.ai_insights[0]
                ai_insight = AIInsightResponse(
                    id=latest_insight.id,
                    message_id=latest_insight.message_id,
                    model_version=latest_insight.model_version,
                    summary=latest_insight.summary,
                    pain_point=latest_insight.pain_point,
                    pain_point_quote=latest_insight.pain_point_quote,
                    feature_request=latest_insight.feature_request,
                    customer_usecase=latest_insight.customer_usecase,
                    sentiment=latest_insight.sentiment,
                    keywords=latest_insight.keywords or [],
                    tokens_used=latest_insight.tokens_used,
                    created_at=latest_insight.created_at
                )

            mentions.append(MentionResponse(
                id=msg.id,
                customer_ask_id=msg.customer_ask_id,
                workspace_id=msg.workspace_id,
                source=msg.source,
                external_id=msg.external_id,
                thread_id=msg.thread_id,
                content=msg.content,
                title=msg.title,
                channel_name=msg.channel_name,
                label_name=msg.label_name,
                author_name=msg.author_name,
                author_email=msg.author_email,
                from_email=msg.from_email,
                to_emails=msg.to_emails,
                message_count=msg.message_count,
                sent_at=msg.sent_at,
                is_processed=msg.is_processed,
                ai_insights=ai_insight
            ))

        has_more = (offset + limit) < total_count

        return {
            "mentions": mentions,
            "total": total_count,
            "has_more": has_more,
            "next_cursor": str(offset + limit) if has_more else None
        }

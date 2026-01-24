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
from app.models.message_customer_ask import MessageCustomerAsk
from app.schemas.theme import (
    ThemeCreate, ThemeUpdate, ThemeResponse, ThemeWithSubThemes, ThemeHierarchy,
    SubThemeCreate, SubThemeUpdate, SubThemeResponse, SubThemeWithCustomerAsks,
    CustomerAskCreate, CustomerAskUpdate, CustomerAskResponse
)
from app.schemas.mention import MentionResponse, AIInsightResponse, LinkedCustomerAsk


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
        """List themes with sub-theme and customer ask counts (optimized single query)"""
        from sqlalchemy.orm import aliased
        from sqlalchemy import outerjoin, select, literal_column

        # Single query with LEFT JOINs and aggregation - eliminates N+1 problem
        # This replaces 2N+1 queries with just 1 query
        sub_theme_count_subq = (
            self.db.query(
                SubTheme.theme_id,
                func.count(SubTheme.id).label('sub_theme_count')
            )
            .group_by(SubTheme.theme_id)
            .subquery()
        )

        customer_ask_count_subq = (
            self.db.query(
                SubTheme.theme_id,
                func.count(CustomerAsk.id).label('customer_ask_count')
            )
            .join(CustomerAsk, CustomerAsk.sub_theme_id == SubTheme.id)
            .group_by(SubTheme.theme_id)
            .subquery()
        )

        results = (
            self.db.query(
                Theme,
                func.coalesce(sub_theme_count_subq.c.sub_theme_count, 0).label('sub_theme_count'),
                func.coalesce(customer_ask_count_subq.c.customer_ask_count, 0).label('customer_ask_count')
            )
            .outerjoin(sub_theme_count_subq, Theme.id == sub_theme_count_subq.c.theme_id)
            .outerjoin(customer_ask_count_subq, Theme.id == customer_ask_count_subq.c.theme_id)
            .filter(Theme.workspace_id == workspace_id)
            .order_by(Theme.sort_order)
            .all()
        )

        return [
            {
                **theme.__dict__,
                "sub_theme_count": sub_theme_count,
                "customer_ask_count": customer_ask_count
            }
            for theme, sub_theme_count, customer_ask_count in results
        ]

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
        """List sub-themes with customer ask counts (optimized single query)"""
        # OPTIMIZATION: Filter subquery by theme_id first to reduce aggregation scope
        # This avoids counting ALL customer_asks across ALL themes
        customer_ask_count_subq = (
            self.db.query(
                CustomerAsk.sub_theme_id,
                func.count(CustomerAsk.id).label('customer_ask_count')
            )
            .join(SubTheme, CustomerAsk.sub_theme_id == SubTheme.id)
            .filter(SubTheme.theme_id == theme_id)  # Filter early!
            .group_by(CustomerAsk.sub_theme_id)
            .subquery()
        )

        results = (
            self.db.query(
                SubTheme,
                func.coalesce(customer_ask_count_subq.c.customer_ask_count, 0).label('customer_ask_count')
            )
            .outerjoin(customer_ask_count_subq, SubTheme.id == customer_ask_count_subq.c.sub_theme_id)
            .filter(SubTheme.theme_id == theme_id)
            .order_by(SubTheme.sort_order)
            .all()
        )

        return [
            {
                **sub_theme.__dict__,
                "customer_ask_count": customer_ask_count
            }
            for sub_theme, customer_ask_count in results
        ]

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
        """List customer asks with message counts (optimized single query via junction table)"""
        # OPTIMIZATION: Build subquery with filtering to reduce aggregation scope
        if sub_theme_id:
            # When sub_theme_id is provided, only count messages for customer_asks in that sub_theme
            message_count_subq = (
                self.db.query(
                    MessageCustomerAsk.customer_ask_id,
                    func.count(MessageCustomerAsk.id).label('message_count')
                )
                .join(CustomerAsk, MessageCustomerAsk.customer_ask_id == CustomerAsk.id)
                .filter(CustomerAsk.sub_theme_id == sub_theme_id)  # Filter early!
                .group_by(MessageCustomerAsk.customer_ask_id)
                .subquery()
            )
        else:
            # Without sub_theme_id, count all for workspace
            message_count_subq = (
                self.db.query(
                    MessageCustomerAsk.customer_ask_id,
                    func.count(MessageCustomerAsk.id).label('message_count')
                )
                .join(CustomerAsk, MessageCustomerAsk.customer_ask_id == CustomerAsk.id)
                .filter(CustomerAsk.workspace_id == workspace_id)
                .group_by(MessageCustomerAsk.customer_ask_id)
                .subquery()
            )

        query = (
            self.db.query(
                CustomerAsk,
                func.coalesce(message_count_subq.c.message_count, 0).label('message_count')
            )
            .outerjoin(message_count_subq, CustomerAsk.id == message_count_subq.c.customer_ask_id)
            .filter(CustomerAsk.workspace_id == workspace_id)
        )

        if sub_theme_id:
            query = query.filter(CustomerAsk.sub_theme_id == sub_theme_id)

        results = query.order_by(CustomerAsk.last_mentioned_at.desc().nullsfirst()).all()

        return [
            {
                **ca.__dict__,
                "message_count": message_count
            }
            for ca, message_count in results
        ]

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
        offset: int = 0,
        include_linked_asks: bool = True
    ) -> Dict[str, Any]:
        """
        Get mentions (messages) for a customer ask with AI insights.

        Returns messages linked to the customer ask along with their AI insights.
        Uses junction table (message_customer_asks) for many-to-many support.

        OPTIMIZED v2: Uses window function for count, eliminates unnecessary queries.
        - 1 query: Junction entries + count (using window function)
        - 1 query: Messages with AI insights
        - 1 query (optional): Other linked CustomerAsks (if include_linked_asks=True)

        Each mention includes:
        - customer_ask_id: The current context CustomerAsk (the one we're viewing)
        - customer_ask_ids: ALL CustomerAsk IDs this message is linked to
        - linked_customer_asks: Full info for UI display (names, sub_theme names)
        """
        from sqlalchemy import over

        # OPTIMIZED: Single query with window function for total count
        # Eliminates separate COUNT query
        count_window = func.count(MessageCustomerAsk.id).over().label('total_count')

        junction_query = self.db.query(
            MessageCustomerAsk,
            count_window
        ).filter(
            MessageCustomerAsk.customer_ask_id == customer_ask_id
        ).order_by(
            MessageCustomerAsk.created_at.desc()
        ).offset(offset).limit(limit).all()

        if not junction_query:
            return {
                "mentions": [],
                "total": 0,
                "has_more": False,
                "next_cursor": None
            }

        # Extract junction entries and total count from first row
        junction_entries = [row[0] for row in junction_query]
        total_count = junction_query[0][1] if junction_query else 0
        message_ids = [entry.message_id for entry in junction_entries]

        # Get messages with eager loading of AI insights (single query)
        messages = self.db.query(Message).options(
            joinedload(Message.ai_insights)
        ).filter(
            Message.id.in_(message_ids)
        ).all()

        # Create a map for quick lookup
        message_map = {msg.id: msg for msg in messages}

        # Initialize maps for linked CustomerAsks
        message_to_ca_ids: Dict[UUID, List[UUID]] = {msg_id: [customer_ask_id] for msg_id in message_ids}
        other_ca_map: Dict[UUID, CustomerAsk] = {}

        # Only fetch linked CustomerAsks if needed (skip for faster initial load)
        if include_linked_asks:
            # OPTIMIZATION: Batch fetch ALL links for ALL messages in one query
            all_links = self.db.query(MessageCustomerAsk).filter(
                MessageCustomerAsk.message_id.in_(message_ids)
            ).all()

            # Build map: message_id -> list of customer_ask_ids
            all_other_ca_ids = set()
            for link in all_links:
                if link.message_id not in message_to_ca_ids:
                    message_to_ca_ids[link.message_id] = []
                if link.customer_ask_id not in message_to_ca_ids[link.message_id]:
                    message_to_ca_ids[link.message_id].append(link.customer_ask_id)
                # Track other CustomerAsk IDs (not the current one) for batch loading
                if link.customer_ask_id != customer_ask_id:
                    all_other_ca_ids.add(link.customer_ask_id)

            # OPTIMIZATION: Batch fetch ALL other CustomerAsks in one query
            # Include sub_theme and theme for full hierarchy display
            if all_other_ca_ids:
                other_cas = self.db.query(CustomerAsk).options(
                    joinedload(CustomerAsk.sub_theme).joinedload(SubTheme.theme)
                ).filter(
                    CustomerAsk.id.in_(list(all_other_ca_ids))
                ).all()
                other_ca_map = {ca.id: ca for ca in other_cas}

        # Transform to response format (maintaining junction entry order)
        mentions = []
        for entry in junction_entries:
            msg = message_map.get(entry.message_id)
            if not msg:
                continue

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

            # Get ALL CustomerAsk IDs this message is linked to (from pre-fetched map)
            ca_ids_for_msg = message_to_ca_ids.get(msg.id, [customer_ask_id])

            # Get full info for linked CustomerAsks (from pre-fetched map)
            linked_customer_asks = []
            for ca_id in ca_ids_for_msg:
                if ca_id != customer_ask_id and ca_id in other_ca_map:
                    ca = other_ca_map[ca_id]
                    sub_theme = ca.sub_theme
                    linked_customer_asks.append(LinkedCustomerAsk(
                        id=ca.id,
                        name=ca.name,
                        sub_theme_id=sub_theme.id if sub_theme else None,
                        sub_theme_name=sub_theme.name if sub_theme else None,
                        theme_id=sub_theme.theme.id if sub_theme and sub_theme.theme else None,
                        theme_name=sub_theme.theme.name if sub_theme and sub_theme.theme else None
                    ))

            mentions.append(MentionResponse(
                id=msg.id,
                customer_ask_id=customer_ask_id,  # Current context
                customer_ask_ids=ca_ids_for_msg,  # All linked IDs
                linked_customer_asks=linked_customer_asks,  # Other CustomerAsks for UI
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

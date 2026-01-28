"""
Theme Service for managing the theme hierarchy (Theme -> SubTheme -> CustomerAsk)
"""
from typing import Optional, List, Dict, Any
from sqlalchemy import func
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func, or_, text

from app.models.theme import Theme
from app.models.sub_theme import SubTheme
from app.models.customer_ask import CustomerAsk
from app.models.message import Message
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

        # Get messages (single query)
        messages = self.db.query(Message).filter(
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

            # AI insights have been removed - transcript classifications are used instead
            ai_insight = None

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
                tier1_processed=msg.tier1_processed,
                tier2_processed=msg.tier2_processed,
                ai_insights=ai_insight
            ))

        has_more = (offset + limit) < total_count

        return {
            "mentions": mentions,
            "total": total_count,
            "has_more": has_more,
            "next_cursor": str(offset + limit) if has_more else None
        }


class TranscriptClassificationService:
    """Service for managing transcript classifications"""

    def __init__(self, db: Session):
        self.db = db

    def get_transcript_classification(self, classification_id: UUID) -> Optional["TranscriptClassification"]:
        """Get a transcript classification by ID"""
        from app.models.transcript_classification import TranscriptClassification
        return self.db.query(TranscriptClassification).filter(
            TranscriptClassification.id == classification_id
        ).first()

    def list_transcript_classifications(
        self,
        workspace_id: UUID,
        theme_id: Optional[UUID] = None,
        sub_theme_id: Optional[UUID] = None,
        source_type: Optional[str] = None,
        processing_status: Optional[str] = None
    ) -> List["TranscriptClassification"]:
        """List transcript classifications with optional filters
        
        Filters by theme_id/sub_theme_id check both:
        1. Top-level theme_id/sub_theme_id fields
        2. Mappings array in extracted_data JSONB field
        """
        from app.models.transcript_classification import TranscriptClassification
        from sqlalchemy import or_, text
        
        # Create the base query
        query = self.db.query(TranscriptClassification).filter(
            TranscriptClassification.workspace_id == workspace_id
        )

        if theme_id:
            # Check top-level theme_id OR theme_ids array
            # Performance: Uses GIN index on theme_ids array - @> operator is more index-friendly than ANY()
            query = query.filter(
                or_(
                    TranscriptClassification.theme_id == theme_id,
                    # Use @> (contains) operator - GIN index optimized for this, faster than ANY()
                    text("theme_ids @> ARRAY[:theme_id]::uuid[]").bindparams(theme_id=theme_id)
                )
            )

        if sub_theme_id:
            # Check top-level sub_theme_id OR sub_theme_ids array
            # Performance: Uses GIN index on sub_theme_ids array - @> operator is more index-friendly than ANY()
            query = query.filter(
                or_(
                    TranscriptClassification.sub_theme_id == sub_theme_id,
                    # Use @> (contains) operator - GIN index optimized for this, faster than ANY()
                    text("sub_theme_ids @> ARRAY[:sub_theme_id]::uuid[]").bindparams(sub_theme_id=sub_theme_id)
                )
            )

        if source_type:
            query = query.filter(TranscriptClassification.source_type == source_type)

        if processing_status:
            query = query.filter(TranscriptClassification.processing_status == processing_status)

        return query.order_by(TranscriptClassification.transcript_date.desc().nullsfirst()).all()

    def get_transcript_classification_counts(
        self,
        workspace_id: UUID
    ) -> Dict[str, Dict[str, int]]:
        """Get transcript classification counts grouped by theme_id and sub_theme_id
        
        Returns:
            {
                "theme_counts": { "theme_id": count, ... },
                "sub_theme_counts": { "sub_theme_id": count, ... }
            }
        
        This is a lightweight query that only counts, doesn't fetch full transcript data.
        Uses array columns for efficient counting.
        """
        from app.models.transcript_classification import TranscriptClassification
        from sqlalchemy import func, text
        
        # Get all transcript classifications (lightweight - only IDs and array columns)
        # This is still much faster than fetching full extracted_data
        classifications = self.db.query(
            TranscriptClassification.id,
            TranscriptClassification.theme_id,
            TranscriptClassification.sub_theme_id,
            TranscriptClassification.theme_ids,
            TranscriptClassification.sub_theme_ids
        ).filter(
            TranscriptClassification.workspace_id == workspace_id
        ).all()
        
        # Count unique transcripts per theme and sub-theme
        theme_counts: Dict[str, int] = {}
        sub_theme_counts: Dict[str, int] = {}
        
        for tc in classifications:
            # Track which themes/sub-themes this transcript is mapped to
            transcript_themes = set()
            transcript_sub_themes = set()
            
            # Add from theme_ids array
            if tc.theme_ids:
                for theme_id in tc.theme_ids:
                    if theme_id:
                        transcript_themes.add(str(theme_id))
            
            # Add from top-level theme_id
            if tc.theme_id:
                transcript_themes.add(str(tc.theme_id))
            
            # Add from sub_theme_ids array
            if tc.sub_theme_ids:
                for sub_theme_id in tc.sub_theme_ids:
                    if sub_theme_id:
                        transcript_sub_themes.add(str(sub_theme_id))
            
            # Add from top-level sub_theme_id
            if tc.sub_theme_id:
                transcript_sub_themes.add(str(tc.sub_theme_id))
            
            # Count this transcript once for each theme/sub-theme it's mapped to
            for theme_id in transcript_themes:
                theme_counts[theme_id] = theme_counts.get(theme_id, 0) + 1
            
            for sub_theme_id in transcript_sub_themes:
                sub_theme_counts[sub_theme_id] = sub_theme_counts.get(sub_theme_id, 0) + 1
        
        return {
            "theme_counts": theme_counts,
            "sub_theme_counts": sub_theme_counts
        }

    def search_transcript_classifications(
        self,
        workspace_id: UUID,
        q: str,
        limit: int = 20
    ) -> List["TranscriptClassification"]:
        """Search transcript classifications by source title or extracted data"""
        from app.models.transcript_classification import TranscriptClassification
        from sqlalchemy import or_
        
        search_term = f"%{q}%"
        return self.db.query(TranscriptClassification).filter(
            TranscriptClassification.workspace_id == workspace_id,
            or_(
                TranscriptClassification.source_title.ilike(search_term),
                TranscriptClassification.source_id.ilike(search_term)
            )
        ).limit(limit).all()

    def get_transcript_insights(
        self,
        workspace_id: UUID
    ) -> Dict:
        """Get aggregated insights from all transcript classifications
        
        Returns comprehensive analytics including:
        - Total transcripts analyzed
        - Sentiment distribution
        - Risk assessment breakdown
        - Top themes and companies
        - Timeline trends
        - Health signals
        - Feature request frequency
        """
        from app.models.transcript_classification import TranscriptClassification
        from app.models.theme import Theme
        from sqlalchemy import func, case
        from datetime import datetime, timedelta
        from collections import defaultdict
        import json
        
        # Get all completed transcript classifications
        classifications = self.db.query(
            TranscriptClassification.id,
            TranscriptClassification.source_type,
            TranscriptClassification.source_title,
            TranscriptClassification.extracted_data,
            TranscriptClassification.transcript_date,
            TranscriptClassification.created_at,
            TranscriptClassification.theme_ids,
            TranscriptClassification.sub_theme_ids,
        ).filter(
            TranscriptClassification.workspace_id == workspace_id,
            TranscriptClassification.processing_status == 'completed'
        ).all()
        
        total_transcripts = len(classifications)
        
        # Initialize aggregation structures
        sentiment_distribution = {'positive': 0, 'neutral': 0, 'negative': 0}
        deal_risk_distribution = defaultdict(int)
        churn_risk_distribution = defaultdict(int)
        expansion_signal_distribution = defaultdict(int)
        source_type_distribution = defaultdict(int)
        theme_mentions = defaultdict(int)
        company_mentions = defaultdict(int)
        health_signals = {'positive': 0, 'negative': 0}
        feature_mappings_count = 0
        total_speakers = 0
        transcripts_by_date = defaultdict(int)
        call_types = defaultdict(int)
        top_themes = []
        top_companies = []
        
        # Process each classification
        for tc in classifications:
            extracted_data = tc.extracted_data or {}
            
            # Source type
            source_type_distribution[tc.source_type or 'unknown'] += 1
            
            # Date tracking
            if tc.transcript_date:
                date_key = tc.transcript_date.date().isoformat()
                transcripts_by_date[date_key] += 1
            elif tc.created_at:
                date_key = tc.created_at.date().isoformat()
                transcripts_by_date[date_key] += 1
            
            # Sentiment from call_metadata
            call_metadata = extracted_data.get('call_metadata', {})
            overall_sentiment = call_metadata.get('overall_sentiment')
            if overall_sentiment is not None:
                if overall_sentiment > 0.1:
                    sentiment_distribution['positive'] += 1
                elif overall_sentiment < -0.1:
                    sentiment_distribution['negative'] += 1
                else:
                    sentiment_distribution['neutral'] += 1
            
            # Call type
            call_type = call_metadata.get('call_type')
            if call_type:
                call_types[call_type.replace('_', ' ').title()] += 1
            
            # Risk assessment
            risk_assessment = extracted_data.get('risk_assessment', {})
            if risk_assessment.get('deal_risk'):
                deal_risk_distribution[risk_assessment['deal_risk'].lower()] += 1
            if risk_assessment.get('churn_risk') and risk_assessment.get('churn_risk') != 'n/a':
                churn_risk_distribution[risk_assessment['churn_risk'].lower()] += 1
            if risk_assessment.get('expansion_signal'):
                expansion_signal_distribution[risk_assessment['expansion_signal'].lower()] += 1
            
            # Customer metadata
            customer_metadata = extracted_data.get('customer_metadata', {})
            company_name = customer_metadata.get('company_name')
            if company_name:
                company_mentions[company_name] += 1
            
            # Health signals
            key_insights = extracted_data.get('key_insights', {})
            health_signals_data = key_insights.get('health_signals', {})
            if health_signals_data:
                if health_signals_data.get('positive'):
                    health_signals['positive'] += len(health_signals_data.get('positive', []))
                if health_signals_data.get('negative'):
                    health_signals['negative'] += len(health_signals_data.get('negative', []))
            
            # Feature mappings
            mappings = extracted_data.get('mappings', [])
            feature_mappings_count += len(mappings)
            
            # Speakers
            speakers = extracted_data.get('speakers', [])
            total_speakers += len(speakers)
            
            # Theme mentions (from theme_ids array)
            if tc.theme_ids:
                for theme_id in tc.theme_ids:
                    theme_mentions[str(theme_id)] += 1
        
        # Get theme names for top themes
        theme_ids_list = list(theme_mentions.keys())
        if theme_ids_list:
            themes = self.db.query(Theme).filter(
                Theme.id.in_([UUID(tid) for tid in theme_ids_list if tid]),
                Theme.workspace_id == workspace_id
            ).all()
            theme_map = {str(t.id): t.name for t in themes}
            
            # Build top themes list
            top_themes_data = [
                {'theme_id': tid, 'name': theme_map.get(tid, tid), 'count': count}
                for tid, count in sorted(theme_mentions.items(), key=lambda x: x[1], reverse=True)[:10]
            ]
            top_themes = top_themes_data
        
        # Top companies
        top_companies = [
            {'name': name, 'count': count}
            for name, count in sorted(company_mentions.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        
        # Timeline data (last 30 days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
        timeline_data = []
        current_date = start_date
        while current_date <= end_date:
            date_key = current_date.isoformat()
            timeline_data.append({
                'date': date_key,
                'count': transcripts_by_date.get(date_key, 0)
            })
            current_date += timedelta(days=1)
        
        # Calculate averages
        avg_feature_mappings = feature_mappings_count / total_transcripts if total_transcripts > 0 else 0
        avg_speakers = total_speakers / total_transcripts if total_transcripts > 0 else 0
        
        return {
            'summary': {
                'total_transcripts': total_transcripts,
                'total_feature_mappings': feature_mappings_count,
                'total_speakers': total_speakers,
                'avg_feature_mappings_per_transcript': round(avg_feature_mappings, 2),
                'avg_speakers_per_transcript': round(avg_speakers, 2),
            },
            'sentiment_distribution': sentiment_distribution,
            'risk_assessment': {
                'deal_risk': dict(deal_risk_distribution),
                'churn_risk': dict(churn_risk_distribution),
                'expansion_signal': dict(expansion_signal_distribution),
            },
            'source_type_distribution': dict(source_type_distribution),
            'call_types': dict(call_types),
            'top_themes': top_themes,
            'top_companies': top_companies,
            'health_signals': health_signals,
            'timeline': timeline_data,
        }

    def get_raw_transcript(
        self,
        classification_id: UUID
    ) -> Optional[str]:
        """Get the formatted raw transcript for a transcript classification

        Fetches from raw_transcripts table by matching source_type and source_id,
        then formats it for display.

        Returns:
            Formatted transcript string or None if not found
        """
        from app.models.transcript_classification import TranscriptClassification
        from app.models.raw_transcript import RawTranscript

        # Get the classification to find source_type and source_id
        classification = self.db.query(TranscriptClassification).filter(
            TranscriptClassification.id == classification_id
        ).first()

        if not classification:
            return None

        # Find the raw transcript
        raw_transcript = self.db.query(RawTranscript).filter(
            RawTranscript.workspace_id == classification.workspace_id,
            RawTranscript.source_type == classification.source_type,
            RawTranscript.source_id == classification.source_id
        ).first()

        if not raw_transcript or not raw_transcript.raw_data:
            return None

        # Format the transcript
        return self._format_transcript_as_text(raw_transcript.raw_data)

    def _format_transcript_as_text(self, raw_data: Dict) -> str:
        """Format raw transcript data as readable text with speaker names and dialogue.

        Handles multiple raw_data formats:
        1. Nested format from gong_ingestion_service: {call_data: {..., parties: [...]}, transcript: {...}}
        2. Direct format: {parties: [...], transcript: [...], metaData: {...}}
        """
        if not raw_data:
            return "No transcript available."

        # Handle nested structure from gong_ingestion_service
        # raw_data = {"call_data": {...}, "transcript": {...}}
        call_data = raw_data.get('call_data', {})

        # Build speaker mapping from parties
        # Try nested location first (call_data.parties), then root level (parties)
        parties = call_data.get('parties', []) if call_data else []
        if not parties:
            parties = raw_data.get('parties', [])

        speaker_map = {}
        for party in parties:
            speaker_id = party.get('speakerId')
            if speaker_id:
                name = party.get('name', 'Unknown')
                email = party.get('emailAddress', '')
                speaker_map[str(speaker_id)] = {
                    'name': name,
                    'email': email
                }

        # Get transcript data - handle nested structure
        # In nested format: raw_data['transcript'] contains the transcript API response
        transcript_data = raw_data.get('transcript', {})
        if isinstance(transcript_data, dict):
            transcript_segments = transcript_data.get('transcript', [])
        elif isinstance(transcript_data, list):
            transcript_segments = transcript_data
        else:
            transcript_segments = []

        if not isinstance(transcript_segments, list):
            if 'content' in raw_data:
                return str(raw_data['content'])
            return "Transcript format not recognized."

        lines = []

        # Add header - try nested location first (call_data.metaData), then root level
        call_metadata = call_data.get('metaData', {}) if call_data else {}
        if not call_metadata:
            call_metadata = raw_data.get('call_metadata', raw_data.get('metaData', {}))
        title = call_metadata.get('title', 'Untitled Call')
        started = call_metadata.get('started', '')

        lines.append("=" * 80)
        lines.append(f"Call: {title}")
        if started:
            lines.append(f"Date: {started}")
        lines.append("=" * 80)
        lines.append("")

        for segment in transcript_segments:
            if not isinstance(segment, dict):
                continue

            speaker_id = str(segment.get('speakerId', ''))
            speaker_info = speaker_map.get(speaker_id, {'name': 'Unknown Speaker', 'email': ''})

            name = speaker_info['name']
            email = speaker_info['email']

            # Extract sentences
            sentences = segment.get('sentences', [])
            if not sentences:
                text = segment.get('text', '')
                if text:
                    sentences = [{'text': text}]
                else:
                    continue

            # Combine all sentences for this speaker segment
            text_parts = []
            for sentence in sentences:
                if isinstance(sentence, dict):
                    text = sentence.get('text', '').strip()
                    if text:
                        text_parts.append(text)
                elif isinstance(sentence, str):
                    text_parts.append(sentence.strip())

            if not text_parts:
                continue

            full_text = ' '.join(text_parts)

            # Format: Name (email): what they said
            if email:
                lines.append(f"{name} ({email}):")
            else:
                lines.append(f"{name}:")
            lines.append(f"  {full_text}")
            lines.append("")

        return "\n".join(lines) if lines else "No transcript content found."

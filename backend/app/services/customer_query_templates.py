"""
Customer Query Templates Service

Pre-built query templates for common customer insights questions.
These templates provide fast, reliable responses for the most frequent queries.
"""

from typing import Dict, Any, List, Optional, Callable
from sqlalchemy import select, func, and_, or_, desc, text
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging

from app.models.customer import Customer
from app.models.message import Message
from app.models.feature import Feature
from app.models.theme import Theme
from app.models.message import feature_messages

logger = logging.getLogger(__name__)


class QueryTemplate:
    """Base class for query templates"""

    def __init__(
        self,
        template_id: str,
        name: str,
        description: str,
        category: str,
        example_queries: List[str]
    ):
        self.template_id = template_id
        self.name = name
        self.description = description
        self.category = category
        self.example_queries = example_queries

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute the template query"""
        raise NotImplementedError


class CustomerQueryTemplates:
    """Service for executing customer query templates"""

    def __init__(self):
        self.templates: Dict[str, QueryTemplate] = {}
        self._register_templates()

    def _register_templates(self):
        """Register all available templates"""

        # Category 1: Customer Profile Templates
        self._register_template(GetCustomerOverviewTemplate())
        self._register_template(GetCustomerMetricsTemplate())
        self._register_template(GetCustomerContactInfoTemplate())
        self._register_template(GetCustomerUseCasesTemplate())

        # Category 2: Feature Request Templates
        self._register_template(ListAllFeatureRequestsTemplate())
        self._register_template(GetUrgentFeaturesTemplate())
        self._register_template(GetRecentFeatureRequestsTemplate())
        self._register_template(GetFeaturesByThemeTemplate())
        self._register_template(CountFeatureRequestsTemplate())
        self._register_template(GetTopMentionedFeaturesTemplate())

        # Category 3: Message Templates
        self._register_template(GetRecentMessagesTemplate())
        self._register_template(GetMessagesBySourceTemplate())
        self._register_template(GetMessageCountTemplate())
        self._register_template(GetLastConversationTemplate())

        # Category 4: Pain Points Templates
        self._register_template(GetPainPointsTemplate())
        self._register_template(GetSentimentSummaryTemplate())

    def _register_template(self, template: QueryTemplate):
        """Register a template"""
        self.templates[template.template_id] = template

    def get_template(self, template_id: str) -> Optional[QueryTemplate]:
        """Get a template by ID"""
        return self.templates.get(template_id)

    def list_templates(self) -> List[Dict[str, Any]]:
        """List all available templates"""
        return [
            {
                "template_id": t.template_id,
                "name": t.name,
                "description": t.description,
                "category": t.category,
                "example_queries": t.example_queries
            }
            for t in self.templates.values()
        ]

    def execute_template(
        self,
        db: Session,
        template_id: str,
        customer_id: str,
        params: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Execute a template query"""
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        try:
            result = template.execute(db, customer_id, params or {})
            return {
                "success": True,
                "template_id": template_id,
                "data": result
            }
        except Exception as e:
            logger.error(f"Error executing template {template_id}: {e}")
            return {
                "success": False,
                "template_id": template_id,
                "error": str(e)
            }


# ==================== CUSTOMER PROFILE TEMPLATES ====================

class GetCustomerOverviewTemplate(QueryTemplate):
    """Get comprehensive customer overview"""

    def __init__(self):
        super().__init__(
            template_id="get_customer_overview",
            name="Customer Overview",
            description="Get comprehensive customer information",
            category="customer_profile",
            example_queries=[
                "Tell me about this customer",
                "Customer summary",
                "Show me their profile"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return {"error": "Customer not found"}

        # Get message count
        message_count = db.query(func.count(Message.id))\
            .filter(Message.customer_id == customer_id)\
            .scalar()

        # Get feature request count
        feature_count = db.query(func.count(Feature.id.distinct()))\
            .join(feature_messages)\
            .join(Message)\
            .filter(Message.customer_id == customer_id)\
            .scalar()

        return {
            "customer": {
                "id": str(customer.id),
                "name": customer.name,
                "domain": customer.domain,
                "industry": customer.industry,
                "contact_name": customer.contact_name,
                "contact_email": customer.contact_email,
                "use_cases": customer.use_cases
            },
            "metrics": {
                "arr": customer.arr,
                "mrr": customer.mrr,
                "deal_stage": customer.deal_stage,
                "deal_amount": customer.deal_amount
            },
            "activity": {
                "message_count": message_count,
                "feature_request_count": feature_count,
                "last_activity": customer.last_activity_at.isoformat() if customer.last_activity_at else None
            }
        }


class GetCustomerMetricsTemplate(QueryTemplate):
    """Get customer business metrics"""

    def __init__(self):
        super().__init__(
            template_id="get_customer_metrics",
            name="Customer Metrics",
            description="Get ARR, MRR, deal value and other business metrics",
            category="customer_profile",
            example_queries=[
                "What's their ARR?",
                "Show me business metrics",
                "What's their deal value?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return {"error": "Customer not found"}

        return {
            "arr": customer.arr,
            "mrr": customer.mrr,
            "deal_stage": customer.deal_stage,
            "deal_amount": customer.deal_amount,
            "deal_close_date": customer.deal_close_date.isoformat() if customer.deal_close_date else None,
            "deal_probability": customer.deal_probability
        }


class GetCustomerContactInfoTemplate(QueryTemplate):
    """Get customer contact information"""

    def __init__(self):
        super().__init__(
            template_id="get_customer_contact_info",
            name="Contact Information",
            description="Get primary contact person and contact details",
            category="customer_profile",
            example_queries=[
                "Who's the contact person?",
                "Show me contact details",
                "How do I reach them?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return {"error": "Customer not found"}

        return {
            "contact_name": customer.contact_name,
            "contact_email": customer.contact_email,
            "phone": customer.phone,
            "website": customer.website,
            "domain": customer.domain
        }


class GetCustomerUseCasesTemplate(QueryTemplate):
    """Get how customer uses the product"""

    def __init__(self):
        super().__init__(
            template_id="get_customer_use_cases",
            name="Use Cases",
            description="How this customer uses the product",
            category="customer_profile",
            example_queries=[
                "How do they use our product?",
                "What are their use cases?",
                "Why do they use us?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return {"error": "Customer not found"}

        return {
            "use_cases": customer.use_cases,
            "industry": customer.industry
        }


# ==================== FEATURE REQUEST TEMPLATES ====================

class ListAllFeatureRequestsTemplate(QueryTemplate):
    """List all feature requests from customer"""

    def __init__(self):
        super().__init__(
            template_id="list_all_feature_requests",
            name="All Feature Requests",
            description="List all feature requests from this customer",
            category="feature_requests",
            example_queries=[
                "What features do they want?",
                "Show me their feature requests",
                "List all requests"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        # Get all features mentioned by this customer
        features = db.query(Feature, Theme.name.label('theme_name'))\
            .outerjoin(Theme, Feature.theme_id == Theme.id)\
            .join(feature_messages, Feature.id == feature_messages.c.feature_id)\
            .join(Message, feature_messages.c.message_id == Message.id)\
            .filter(Message.customer_id == customer_id)\
            .order_by(desc(Feature.last_mentioned))\
            .all()

        return {
            "features": [
                {
                    "id": str(f.Feature.id),
                    "name": f.Feature.name,
                    "description": f.Feature.description,
                    "urgency": f.Feature.urgency,
                    "status": f.Feature.status,
                    "mention_count": f.Feature.mention_count,
                    "theme_name": f.theme_name,
                    "last_mentioned": f.Feature.last_mentioned.isoformat() if f.Feature.last_mentioned else None
                }
                for f in features
            ],
            "total_count": len(features)
        }


class GetUrgentFeaturesTemplate(QueryTemplate):
    """Get urgent/critical feature requests"""

    def __init__(self):
        super().__init__(
            template_id="get_urgent_features",
            name="Urgent Feature Requests",
            description="Get critical and high priority feature requests",
            category="feature_requests",
            example_queries=[
                "What are their urgent requests?",
                "Show me critical features",
                "High priority requests?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        features = db.query(Feature, Theme.name.label('theme_name'))\
            .outerjoin(Theme, Feature.theme_id == Theme.id)\
            .join(feature_messages, Feature.id == feature_messages.c.feature_id)\
            .join(Message, feature_messages.c.message_id == Message.id)\
            .filter(
                Message.customer_id == customer_id,
                Feature.urgency.in_(['high', 'critical'])
            )\
            .order_by(desc(Feature.last_mentioned))\
            .all()

        return {
            "features": [
                {
                    "id": str(f.Feature.id),
                    "name": f.Feature.name,
                    "description": f.Feature.description,
                    "urgency": f.Feature.urgency,
                    "status": f.Feature.status,
                    "theme_name": f.theme_name,
                    "last_mentioned": f.Feature.last_mentioned.isoformat() if f.Feature.last_mentioned else None
                }
                for f in features
            ],
            "total_count": len(features)
        }


class GetRecentFeatureRequestsTemplate(QueryTemplate):
    """Get recent feature requests"""

    def __init__(self):
        super().__init__(
            template_id="get_recent_feature_requests",
            name="Recent Feature Requests",
            description="Get feature requests from the last N days",
            category="feature_requests",
            example_queries=[
                "What did they request recently?",
                "Latest feature requests?",
                "Recent requests from last 30 days"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        days = params.get('days', 30) if params else 30
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        features = db.query(Feature, Theme.name.label('theme_name'))\
            .outerjoin(Theme, Feature.theme_id == Theme.id)\
            .join(feature_messages, Feature.id == feature_messages.c.feature_id)\
            .join(Message, feature_messages.c.message_id == Message.id)\
            .filter(
                Message.customer_id == customer_id,
                Feature.last_mentioned >= cutoff_date
            )\
            .order_by(desc(Feature.last_mentioned))\
            .all()

        return {
            "features": [
                {
                    "id": str(f.Feature.id),
                    "name": f.Feature.name,
                    "description": f.Feature.description,
                    "urgency": f.Feature.urgency,
                    "theme_name": f.theme_name,
                    "last_mentioned": f.Feature.last_mentioned.isoformat() if f.Feature.last_mentioned else None
                }
                for f in features
            ],
            "days": days,
            "total_count": len(features)
        }


class GetFeaturesByThemeTemplate(QueryTemplate):
    """Get features filtered by theme"""

    def __init__(self):
        super().__init__(
            template_id="get_features_by_theme",
            name="Features by Theme",
            description="Get feature requests for a specific theme",
            category="feature_requests",
            example_queries=[
                "What security features do they want?",
                "Show analytics requests",
                "Integration features?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        theme_name = params.get('theme_name') if params else None
        if not theme_name:
            return {"error": "theme_name parameter required"}

        features = db.query(Feature, Theme.name.label('theme_name'))\
            .join(Theme, Feature.theme_id == Theme.id)\
            .join(feature_messages, Feature.id == feature_messages.c.feature_id)\
            .join(Message, feature_messages.c.message_id == Message.id)\
            .filter(
                Message.customer_id == customer_id,
                Theme.name.ilike(f"%{theme_name}%")
            )\
            .order_by(desc(Feature.last_mentioned))\
            .all()

        return {
            "theme": theme_name,
            "features": [
                {
                    "id": str(f.Feature.id),
                    "name": f.Feature.name,
                    "description": f.Feature.description,
                    "urgency": f.Feature.urgency,
                    "last_mentioned": f.Feature.last_mentioned.isoformat() if f.Feature.last_mentioned else None
                }
                for f in features
            ],
            "total_count": len(features)
        }


class CountFeatureRequestsTemplate(QueryTemplate):
    """Count total feature requests"""

    def __init__(self):
        super().__init__(
            template_id="count_feature_requests",
            name="Count Feature Requests",
            description="Get total number of feature requests",
            category="feature_requests",
            example_queries=[
                "How many features have they requested?",
                "Total request count?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        count = db.query(func.count(Feature.id.distinct()))\
            .join(feature_messages, Feature.id == feature_messages.c.feature_id)\
            .join(Message, feature_messages.c.message_id == Message.id)\
            .filter(Message.customer_id == customer_id)\
            .scalar()

        return {
            "total_feature_requests": count
        }


class GetTopMentionedFeaturesTemplate(QueryTemplate):
    """Get most mentioned features"""

    def __init__(self):
        super().__init__(
            template_id="get_top_mentioned_features",
            name="Top Mentioned Features",
            description="Features mentioned most frequently",
            category="feature_requests",
            example_queries=[
                "Most requested features?",
                "What do they talk about most?",
                "Top mentions?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        limit = params.get('limit', 5) if params else 5

        features = db.query(Feature, Theme.name.label('theme_name'))\
            .outerjoin(Theme, Feature.theme_id == Theme.id)\
            .join(feature_messages, Feature.id == feature_messages.c.feature_id)\
            .join(Message, feature_messages.c.message_id == Message.id)\
            .filter(Message.customer_id == customer_id)\
            .order_by(desc(Feature.mention_count))\
            .limit(limit)\
            .all()

        return {
            "features": [
                {
                    "id": str(f.Feature.id),
                    "name": f.Feature.name,
                    "mention_count": f.Feature.mention_count,
                    "urgency": f.Feature.urgency,
                    "theme_name": f.theme_name
                }
                for f in features
            ],
            "limit": limit
        }


# ==================== MESSAGE TEMPLATES ====================

class GetRecentMessagesTemplate(QueryTemplate):
    """Get recent messages"""

    def __init__(self):
        super().__init__(
            template_id="get_recent_messages",
            name="Recent Messages",
            description="Get recent messages from this customer",
            category="messages",
            example_queries=[
                "Show me recent messages",
                "Latest conversations?",
                "Recent activity"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        limit = params.get('limit', 10) if params else 10
        days = params.get('days', 30) if params else 30
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        messages = db.query(Message)\
            .filter(
                Message.customer_id == customer_id,
                Message.sent_at >= cutoff_date
            )\
            .order_by(desc(Message.sent_at))\
            .limit(limit)\
            .all()

        return {
            "messages": [
                {
                    "id": str(m.id),
                    "title": m.title,
                    "content": m.content[:200] + "..." if len(m.content) > 200 else m.content,
                    "source": m.source,
                    "sent_at": m.sent_at.isoformat() if m.sent_at else None,
                    "author_name": m.author_name
                }
                for m in messages
            ],
            "total_count": len(messages),
            "days": days,
            "limit": limit
        }


class GetMessagesBySourceTemplate(QueryTemplate):
    """Get messages filtered by source"""

    def __init__(self):
        super().__init__(
            template_id="get_messages_by_source",
            name="Messages by Source",
            description="Get messages from specific source (Gong, Fathom, Slack)",
            category="messages",
            example_queries=[
                "Show me Gong calls",
                "Fathom meetings?",
                "Slack messages"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        source = params.get('source', 'gong').lower() if params else 'gong'
        limit = params.get('limit', 10) if params else 10

        messages = db.query(Message)\
            .filter(
                Message.customer_id == customer_id,
                Message.source == source
            )\
            .order_by(desc(Message.sent_at))\
            .limit(limit)\
            .all()

        return {
            "source": source,
            "messages": [
                {
                    "id": str(m.id),
                    "title": m.title,
                    "content": m.content[:200] + "..." if len(m.content) > 200 else m.content,
                    "sent_at": m.sent_at.isoformat() if m.sent_at else None,
                    "author_name": m.author_name
                }
                for m in messages
            ],
            "total_count": len(messages)
        }


class GetMessageCountTemplate(QueryTemplate):
    """Count total messages"""

    def __init__(self):
        super().__init__(
            template_id="get_message_count",
            name="Message Count",
            description="Get total number of messages/conversations",
            category="messages",
            example_queries=[
                "How many messages from them?",
                "Total conversation count?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        total_count = db.query(func.count(Message.id))\
            .filter(Message.customer_id == customer_id)\
            .scalar()

        # Count by source
        by_source = db.query(Message.source, func.count(Message.id))\
            .filter(Message.customer_id == customer_id)\
            .group_by(Message.source)\
            .all()

        return {
            "total_messages": total_count,
            "by_source": {source: count for source, count in by_source}
        }


class GetLastConversationTemplate(QueryTemplate):
    """Get most recent conversation"""

    def __init__(self):
        super().__init__(
            template_id="get_last_conversation",
            name="Last Conversation",
            description="Get the most recent message/call",
            category="messages",
            example_queries=[
                "What was the last call about?",
                "Most recent message?",
                "Last conversation"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        message = db.query(Message)\
            .filter(Message.customer_id == customer_id)\
            .order_by(desc(Message.sent_at))\
            .first()

        if not message:
            return {"message": "No messages found"}

        return {
            "id": str(message.id),
            "title": message.title,
            "content": message.content,
            "source": message.source,
            "sent_at": message.sent_at.isoformat() if message.sent_at else None,
            "author_name": message.author_name,
            "ai_insights": message.ai_insights
        }


# ==================== PAIN POINTS TEMPLATES ====================

class GetPainPointsTemplate(QueryTemplate):
    """Get customer pain points"""

    def __init__(self):
        super().__init__(
            template_id="get_pain_points",
            name="Pain Points",
            description="Get customer pain points and frustrations",
            category="pain_points",
            example_queries=[
                "What are their pain points?",
                "Show me their frustrations",
                "What problems do they have?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        messages = db.query(Message)\
            .filter(
                Message.customer_id == customer_id,
                Message.ai_insights.isnot(None)
            )\
            .order_by(desc(Message.sent_at))\
            .all()

        pain_points = []
        for msg in messages:
            if msg.ai_insights and 'pain_points' in msg.ai_insights:
                for pp in msg.ai_insights['pain_points']:
                    pain_points.append({
                        "description": pp.get('description'),
                        "impact": pp.get('impact'),
                        "quote": pp.get('quote'),
                        "message_date": msg.sent_at.isoformat() if msg.sent_at else None
                    })

        return {
            "pain_points": pain_points,
            "total_count": len(pain_points)
        }


class GetSentimentSummaryTemplate(QueryTemplate):
    """Get sentiment summary"""

    def __init__(self):
        super().__init__(
            template_id="get_sentiment_summary",
            name="Sentiment Summary",
            description="Get overall customer sentiment",
            category="pain_points",
            example_queries=[
                "Are they happy?",
                "Overall sentiment?",
                "How do they feel?"
            ]
        )

    def execute(self, db: Session, customer_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        messages = db.query(Message)\
            .filter(
                Message.customer_id == customer_id,
                Message.ai_insights.isnot(None)
            )\
            .order_by(desc(Message.sent_at))\
            .limit(10)\
            .all()

        sentiments = []
        for msg in messages:
            if msg.ai_insights and 'sentiment' in msg.ai_insights:
                sent = msg.ai_insights['sentiment']
                sentiments.append({
                    "overall": sent.get('overall'),
                    "score": sent.get('score'),
                    "reasoning": sent.get('reasoning'),
                    "message_date": msg.sent_at.isoformat() if msg.sent_at else None
                })

        # Calculate average sentiment
        positive_count = sum(1 for s in sentiments if s.get('overall') == 'positive')
        negative_count = sum(1 for s in sentiments if s.get('overall') == 'negative')
        neutral_count = sum(1 for s in sentiments if s.get('overall') == 'neutral')

        overall = 'neutral'
        if positive_count > negative_count and positive_count > neutral_count:
            overall = 'positive'
        elif negative_count > positive_count and negative_count > neutral_count:
            overall = 'negative'

        return {
            "overall_sentiment": overall,
            "sentiment_breakdown": {
                "positive": positive_count,
                "neutral": neutral_count,
                "negative": negative_count
            },
            "recent_sentiments": sentiments[:5]
        }


# Singleton instance
_query_templates_service = None


def get_customer_query_templates() -> CustomerQueryTemplates:
    """Get or create the query templates service singleton"""
    global _query_templates_service
    if _query_templates_service is None:
        _query_templates_service = CustomerQueryTemplates()
    return _query_templates_service

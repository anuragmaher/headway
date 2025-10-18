from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging
from openai import OpenAI

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.message import Message, feature_messages
from app.models.theme import Theme
from app.models.feature import Feature
from app.models.data_extraction_field import DataExtractionField

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request/response
class ThemeSuggestion(BaseModel):
    name: str
    description: str
    parent_theme_name: Optional[str] = None


class DataExtractionSuggestion(BaseModel):
    field_name: str
    field_type: str  # 'customer_name', 'mrr', 'urgency', 'product', 'custom'
    data_type: str  # 'string', 'number', 'boolean', 'date', 'array'
    description: str
    example_values: List[str]


class AnalyzeMessagesResponse(BaseModel):
    theme_suggestions: List[ThemeSuggestion]
    data_extraction_suggestions: List[DataExtractionSuggestion]
    message_count: int


class DataExtractionFieldCreateRequest(BaseModel):
    field_name: str
    field_type: str
    data_type: str
    description: Optional[str] = None


class DataExtractionFieldResponse(BaseModel):
    id: str
    field_name: str
    field_type: str
    data_type: str
    description: Optional[str]
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


@router.post("/analyze-messages", response_model=AnalyzeMessagesResponse)
async def analyze_messages(
    workspace_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze all messages from the workspace and suggest themes and sub-themes using OpenAI
    """
    try:
        # Fetch all messages with AI insights for the workspace
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.ai_insights.isnot(None)  # Only messages with AI insights
        ).limit(1000).all()  # Limit to 1000 most recent messages to avoid token limits

        if not messages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No messages with AI insights found in workspace. Please ingest Gong calls first."
            )

        # Fetch existing themes to avoid duplicates
        existing_themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).all()

        existing_theme_names = [theme.name for theme in existing_themes]

        # Fetch existing data extraction fields to avoid duplicates
        existing_data_fields = db.query(DataExtractionField).filter(
            DataExtractionField.workspace_id == workspace_id,
            DataExtractionField.is_active == True
        ).all()

        existing_field_info = [
            f"{field.field_name} ({field.field_type}, {field.data_type})"
            for field in existing_data_fields
        ]

        # Format AI insights for OpenAI analysis
        insights_summaries = []
        for msg in messages:
            ai_insights = msg.ai_insights

            # Skip if no ai_insights
            if not ai_insights:
                continue

            # Build a structured summary from AI insights
            summary_parts = []

            # Add feature requests
            if ai_insights.get('feature_requests'):
                for feature in ai_insights['feature_requests']:
                    summary_parts.append(
                        f"Feature Request: {feature.get('title')} (Urgency: {feature.get('urgency')})\n"
                        f"Description: {feature.get('description')}\n"
                        f"Quote: \"{feature.get('quote')}\""
                    )

            # Add bug reports
            if ai_insights.get('bug_reports'):
                for bug in ai_insights['bug_reports']:
                    summary_parts.append(
                        f"Bug Report: {bug.get('title')} (Severity: {bug.get('severity')})\n"
                        f"Description: {bug.get('description')}\n"
                        f"Quote: \"{bug.get('quote')}\""
                    )

            # Add pain points
            if ai_insights.get('pain_points'):
                for pain in ai_insights['pain_points']:
                    summary_parts.append(
                        f"Pain Point: {pain.get('description')}\n"
                        f"Impact: {pain.get('impact')}"
                    )

            # Add summary and sentiment
            if ai_insights.get('summary'):
                summary_parts.append(f"Summary: {ai_insights['summary']}")

            if ai_insights.get('sentiment'):
                sentiment = ai_insights['sentiment']
                summary_parts.append(
                    f"Sentiment: {sentiment.get('overall')} (Score: {sentiment.get('score')})"
                )

            # Add key topics
            if ai_insights.get('key_topics'):
                topics = ', '.join(ai_insights['key_topics'])
                summary_parts.append(f"Topics: {topics}")

            if summary_parts:
                insights_summaries.append('\n'.join(summary_parts))

        combined_messages = "\n\n---\n\n".join(insights_summaries)

        # Create OpenAI client
        if not settings.OPENAI_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OpenAI API key not configured"
            )

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Build existing themes/fields context
        existing_themes_context = ""
        if existing_theme_names:
            existing_themes_context = f"\n**IMPORTANT - Existing Themes (DO NOT suggest these):**\n{', '.join(existing_theme_names)}\n"

        existing_fields_context = ""
        if existing_field_info:
            existing_fields_context = f"\n**IMPORTANT - Existing Data Fields (DO NOT suggest these):**\n{', '.join(existing_field_info)}\n"

        # Create prompt for theme and data extraction analysis
        prompt = f"""You are analyzing AI-extracted insights from customer feedback to suggest:
1. Product themes and sub-themes
2. Data fields that should be extracted from messages

Below are AI-extracted insights from {len(messages)} customer conversations (feature requests, bug reports, pain points). Analyze them and provide:

**Theme Suggestions:**
- Suggest 5-10 NEW main themes that group related feature requests
- Each main theme can have 0-5 sub-themes
- Themes should be clear, actionable, and mutually exclusive
- Focus on product areas, features, or capabilities
{existing_themes_context}

**Data Extraction Suggestions:**
- Identify ALL structured data points that appear in the messages, including those already in a structured format (like "MRR: $588" or "Customer: CompanyName")
- Look for both explicitly labeled fields AND data that can be inferred from message content
- Common types: customer_name, mrr (monthly recurring revenue), urgency, product, company_size, industry, etc.
- For each field, provide the field name, field_type, data_type, description, and 2-3 example values from the messages
- data_type should be one of: 'string', 'number', 'boolean', 'date', 'array'
- IMPORTANT: If you see "MRR:" or "Monthly Recurring Revenue" in messages, you MUST suggest it as a data extraction field
{existing_fields_context}

Return ONLY a JSON object in this exact format:
{{
  "theme_suggestions": [
    {{"name": "Theme Name", "description": "Brief description", "parent_theme_name": null}},
    {{"name": "Sub-theme Name", "description": "Brief description", "parent_theme_name": "Theme Name"}}
  ],
  "data_extraction_suggestions": [
    {{
      "field_name": "Customer Name",
      "field_type": "customer_name",
      "data_type": "string",
      "description": "Name of the customer or company requesting the feature",
      "example_values": ["Acme Corp", "TechStart Inc", "Global Solutions"]
    }},
    {{
      "field_name": "MRR",
      "field_type": "mrr",
      "data_type": "number",
      "description": "Monthly Recurring Revenue of the requesting customer",
      "example_values": ["$50K", "$120K", "$25K"]
    }},
    {{
      "field_name": "Urgency",
      "field_type": "urgency",
      "data_type": "string",
      "description": "How urgent is this feature request",
      "example_values": ["high", "medium", "low"]
    }}
  ]
}}

Customer Insights:
{combined_messages}
"""

        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert product manager analyzing AI-extracted customer insights (feature requests, bug reports, pain points) to create a taxonomy of themes and sub-themes."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )

        # Parse the response
        import json
        result_text = response.choices[0].message.content

        # Extract JSON from the response
        try:
            result = json.loads(result_text)
            theme_data = result.get('theme_suggestions', [])
            data_extraction_data = result.get('data_extraction_suggestions', [])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse OpenAI response: {result_text}")
            theme_data = []
            data_extraction_data = []

        # Convert to ThemeSuggestion objects
        theme_suggestions = []
        for suggestion in theme_data:
            theme_suggestions.append(ThemeSuggestion(
                name=suggestion.get('name', ''),
                description=suggestion.get('description', ''),
                parent_theme_name=suggestion.get('parent_theme_name')
            ))

        # Convert to DataExtractionSuggestion objects
        data_extraction_suggestions = []
        for data_field in data_extraction_data:
            # Ensure example_values are strings
            example_values = data_field.get('example_values', [])
            example_values_str = [str(val) for val in example_values]

            data_extraction_suggestions.append(DataExtractionSuggestion(
                field_name=data_field.get('field_name', ''),
                field_type=data_field.get('field_type', 'custom'),
                data_type=data_field.get('data_type', 'string'),
                description=data_field.get('description', ''),
                example_values=example_values_str
            ))

        return AnalyzeMessagesResponse(
            theme_suggestions=theme_suggestions,
            data_extraction_suggestions=data_extraction_suggestions,
            message_count=len(messages)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze messages: {str(e)}"
        )


@router.get("/data-extraction-fields", response_model=List[DataExtractionFieldResponse])
async def get_data_extraction_fields(
    workspace_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all active data extraction fields for a workspace
    """
    try:
        fields = db.query(DataExtractionField).filter(
            DataExtractionField.workspace_id == workspace_id,
            DataExtractionField.is_active == True
        ).all()

        return [
            DataExtractionFieldResponse(
                id=str(field.id),
                field_name=field.field_name,
                field_type=field.field_type,
                data_type=field.data_type,
                description=field.description,
                is_active=field.is_active,
                created_at=field.created_at.isoformat() if field.created_at else ""
            )
            for field in fields
        ]

    except Exception as e:
        logger.error(f"Error getting data extraction fields: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get data extraction fields: {str(e)}"
        )


@router.post("/data-extraction-fields", response_model=DataExtractionFieldResponse)
async def create_data_extraction_field(
    request: DataExtractionFieldCreateRequest,
    workspace_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new data extraction field for a workspace
    """
    try:
        from datetime import datetime

        # Check if field with same name already exists
        existing_field = db.query(DataExtractionField).filter(
            DataExtractionField.workspace_id == workspace_id,
            DataExtractionField.field_name == request.field_name,
            DataExtractionField.is_active == True
        ).first()

        if existing_field:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Data extraction field '{request.field_name}' already exists"
            )

        # Create new field
        new_field = DataExtractionField(
            workspace_id=workspace_id,
            field_name=request.field_name,
            field_type=request.field_type,
            data_type=request.data_type,
            description=request.description,
            is_active=True,
            created_at=datetime.utcnow()
        )

        db.add(new_field)
        db.commit()
        db.refresh(new_field)

        return DataExtractionFieldResponse(
            id=str(new_field.id),
            field_name=new_field.field_name,
            field_type=new_field.field_type,
            data_type=new_field.data_type,
            description=new_field.description,
            is_active=new_field.is_active,
            created_at=new_field.created_at.isoformat() if new_field.created_at else ""
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating data extraction field: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create data extraction field: {str(e)}"
        )


class ClassifyFeaturesResponse(BaseModel):
    features_created: int
    features_classified: int
    unclassified_count: int


@router.post("/classify-features", response_model=ClassifyFeaturesResponse)
async def classify_features(
    workspace_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create features from ai_insights and classify them into themes.
    Creates "Unclassified" default theme if it doesn't exist.
    """
    try:
        from datetime import datetime

        # 1. Get or create "Unclassified" default theme
        unclassified_theme = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.is_default == True
        ).first()

        if not unclassified_theme:
            unclassified_theme = Theme(
                workspace_id=workspace_id,
                name="Unclassified",
                description="Features that haven't been categorized yet",
                color="#9e9e9e",  # Gray color
                icon="HelpOutlineIcon",
                is_default=True,
                sort_order=9999  # Put at the end
            )
            db.add(unclassified_theme)
            db.flush()
            logger.info(f"Created 'Unclassified' default theme for workspace {workspace_id}")

        # 2. Get all existing themes (excluding Unclassified) for classification
        existing_themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.is_default == False
        ).all()

        theme_list = [
            {"id": str(theme.id), "name": theme.name, "description": theme.description}
            for theme in existing_themes
        ]

        # 3. Get all messages with ai_insights
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.ai_insights.isnot(None)
        ).all()

        if not messages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No messages with AI insights found"
            )

        features_created = 0
        features_classified = 0
        unclassified_count = 0

        # 4. Process each message
        for msg in messages:
            ai_insights = msg.ai_insights
            if not ai_insights:
                continue

            feature_requests = ai_insights.get('feature_requests', [])

            for feature_data in feature_requests:
                title = feature_data.get('title', 'Untitled Feature')
                description = feature_data.get('description', '')
                urgency = feature_data.get('urgency', 'medium')
                quote = feature_data.get('quote', '')

                # Check if feature already exists (by name and workspace)
                existing_feature = db.query(Feature).filter(
                    Feature.workspace_id == workspace_id,
                    Feature.name == title
                ).first()

                if existing_feature:
                    # Update mention count
                    existing_feature.mention_count += 1
                    existing_feature.last_mentioned = datetime.utcnow()
                    # Add message association if not exists
                    if msg not in existing_feature.messages:
                        existing_feature.messages.append(msg)
                    continue

                # Classify feature into theme using AI
                theme_id = None
                if theme_list:
                    theme_id = await _classify_feature_to_theme(
                        title, description, theme_list, unclassified_theme.id
                    )
                    if theme_id != str(unclassified_theme.id):
                        features_classified += 1
                    else:
                        unclassified_count += 1
                else:
                    # No themes available, use Unclassified
                    theme_id = str(unclassified_theme.id)
                    unclassified_count += 1

                # Create new feature
                new_feature = Feature(
                    workspace_id=workspace_id,
                    name=title,
                    description=f"{description}\n\nQuote: \"{quote}\"",
                    urgency=urgency,
                    status="new",
                    theme_id=theme_id,
                    mention_count=1,
                    first_mentioned=datetime.utcnow(),
                    last_mentioned=datetime.utcnow()
                )

                db.add(new_feature)
                db.flush()

                # Add message association
                new_feature.messages.append(msg)
                features_created += 1

        db.commit()

        return ClassifyFeaturesResponse(
            features_created=features_created,
            features_classified=features_classified,
            unclassified_count=unclassified_count
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error classifying features: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to classify features: {str(e)}"
        )


async def _classify_feature_to_theme(
    feature_title: str,
    feature_description: str,
    theme_list: List[dict],
    unclassified_theme_id: str
) -> str:
    """
    Use OpenAI to classify a feature into the best matching theme.
    Returns theme_id or unclassified_theme_id if no match.
    """
    try:
        if not settings.OPENAI_API_KEY:
            return unclassified_theme_id

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Build theme options
        theme_options = "\n".join([
            f"- {theme['name']}: {theme['description']} (ID: {theme['id']})"
            for theme in theme_list
        ])

        prompt = f"""You are classifying a feature request into the most appropriate theme.

Feature:
Title: {feature_title}
Description: {feature_description}

Available Themes:
{theme_options}

Return ONLY a JSON object with this format:
{{
  "theme_id": "the matching theme ID or null if no good match",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}}

If the feature doesn't clearly fit any theme, return theme_id as null.
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a product manager classifying feature requests into themes."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200,
            response_format={"type": "json_object"}
        )

        import json
        result = json.loads(response.choices[0].message.content)

        theme_id = result.get('theme_id')
        confidence = result.get('confidence', 'low')

        # Only use the theme if confidence is medium or high
        if theme_id and confidence in ['medium', 'high']:
            return theme_id
        else:
            return unclassified_theme_id

    except Exception as e:
        logger.error(f"Error classifying feature to theme: {e}")
        return unclassified_theme_id

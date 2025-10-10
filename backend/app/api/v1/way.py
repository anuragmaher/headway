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
from app.models.message import Message
from app.models.theme import Theme
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
        # Fetch all messages for the workspace
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id
        ).limit(1000).all()  # Limit to 1000 most recent messages to avoid token limits

        if not messages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No messages found in workspace"
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

        # Format messages for OpenAI
        message_texts = [msg.content for msg in messages]
        combined_messages = "\n\n---\n\n".join(message_texts)

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
        prompt = f"""You are analyzing customer feedback messages to suggest:
1. Product themes and sub-themes
2. Data fields that should be extracted from messages

Below are {len(messages)} customer messages. Analyze them and provide:

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

Messages:
{combined_messages}
"""

        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert product manager analyzing customer feedback to create a taxonomy of themes and sub-themes."},
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
            data_extraction_suggestions.append(DataExtractionSuggestion(
                field_name=data_field.get('field_name', ''),
                field_type=data_field.get('field_type', 'custom'),
                data_type=data_field.get('data_type', 'string'),
                description=data_field.get('description', ''),
                example_values=data_field.get('example_values', [])
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

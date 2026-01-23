"""
Way API - Stub Version

NOTE: This module is currently a stub as part of the database schema redesign.
The Feature and DataExtractionField models have been removed/replaced.
Full implementation will be added after schema migration is complete.
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request/response
class ThemeSuggestion(BaseModel):
    name: str
    description: str
    parent_theme_name: str | None = None


class DataExtractionSuggestion(BaseModel):
    field_name: str
    field_type: str
    data_type: str
    description: str
    example_values: List[str]


class AnalyzeMessagesResponse(BaseModel):
    theme_suggestions: List[ThemeSuggestion]
    data_extraction_suggestions: List[DataExtractionSuggestion]
    message_count: int


class DataExtractionFieldResponse(BaseModel):
    id: str
    field_name: str
    field_type: str
    data_type: str
    description: str | None
    is_active: bool
    created_at: str


class ClassifyFeaturesResponse(BaseModel):
    features_created: int
    features_classified: int
    unclassified_count: int


@router.post("/analyze-messages", response_model=AnalyzeMessagesResponse)
async def analyze_messages():
    """Analyze messages - stub endpoint"""
    logger.info("Way API stub: analyze_messages called")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Service temporarily unavailable during schema migration"
    )


@router.get("/data-extraction-fields", response_model=List[DataExtractionFieldResponse])
async def get_data_extraction_fields():
    """Get data extraction fields - stub endpoint"""
    logger.info("Way API stub: get_data_extraction_fields called")
    return []


@router.post("/data-extraction-fields", response_model=DataExtractionFieldResponse)
async def create_data_extraction_field():
    """Create data extraction field - stub endpoint"""
    logger.info("Way API stub: create_data_extraction_field called")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Service temporarily unavailable during schema migration"
    )


@router.post("/classify-features", response_model=ClassifyFeaturesResponse)
async def classify_features():
    """Classify features - stub endpoint"""
    logger.info("Way API stub: classify_features called")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Service temporarily unavailable during schema migration"
    )

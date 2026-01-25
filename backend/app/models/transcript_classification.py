from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, String, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.theme import Theme
    from app.models.sub_theme import SubTheme
    from app.models.workspace import Workspace


class TranscriptClassification(Base):
    """
    Transcript Classification model for storing AI-extracted information from transcripts.
    
    This model uses a NoSQL approach (JSONB) to store flexible classification data
    while maintaining relationships with themes and sub_themes for efficient querying.
    
    The extracted_data JSONB field can contain:
    - Classification results (themes, sub_themes, categories)
    - Extracted features/requests
    - Sentiment analysis
    - Key insights
    - Any other structured data from the AI classification
    """

    __tablename__ = "transcript_classifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Source information
    source_type = Column(String(50), nullable=False)  # 'gong', 'fathom', etc.
    source_id = Column(String(255), nullable=False)  # External ID from source (e.g., Gong call ID)
    source_title = Column(String(500), nullable=True)  # Call title or meeting name
    
    # Workspace relationship (required)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    
    # Theme relationships (optional - AI may assign these)
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id", ondelete="SET NULL"), nullable=True)
    sub_theme_id = Column(UUID(as_uuid=True), ForeignKey("sub_themes.id", ondelete="SET NULL"), nullable=True)
    
    # Array columns for fast filtering (denormalized from mappings)
    # These are populated from extracted_data.mappings[] for performance
    theme_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True, default=None)
    sub_theme_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True, default=None)
    
    # NoSQL storage - flexible JSONB for all extracted data
    extracted_data = Column(JSONB, nullable=False, default=dict)
    # Example structure:
    # {
    #   "classification": {
    #     "themes": ["theme_id_1", "theme_id_2"],
    #     "sub_themes": ["sub_theme_id_1"],
    #     "categories": ["Feature Request", "Bug Report"],
    #     "confidence": 0.85
    #   },
    #   "features": [
    #     {"name": "Feature name", "description": "...", "urgency": "high"}
    #   ],
    #   "insights": {
    #     "sentiment": "positive",
    #     "key_points": ["point1", "point2"],
    #     "action_items": ["item1", "item2"]
    #   },
    #   "metadata": {
    #     "model": "gpt-4o-mini",
    #     "prompt_version": "v1.2",
    #     "processing_time_ms": 1234
    #   }
    # }
    
    # Raw AI response (for debugging and audit)
    raw_ai_response = Column(JSONB, nullable=True)
    
    # Processing metadata
    processing_status = Column(String(50), default="completed", nullable=False)  # 'pending', 'processing', 'completed', 'failed'
    error_message = Column(Text, nullable=True)  # If processing failed
    
    # Confidence and quality metrics
    confidence_score = Column(String(20), nullable=True)  # Overall confidence in classification
    
    # Timestamps
    transcript_date = Column(DateTime(timezone=True), nullable=True)  # When the transcript/meeting occurred
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="transcript_classifications")
    theme = relationship("Theme", back_populates="transcript_classifications")
    sub_theme = relationship("SubTheme", back_populates="transcript_classifications")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_transcript_classifications_workspace', 'workspace_id'),
        Index('idx_transcript_classifications_theme', 'theme_id'),
        Index('idx_transcript_classifications_sub_theme', 'sub_theme_id'),
        Index('idx_transcript_classifications_source', 'source_type', 'source_id'),
        Index('idx_transcript_classifications_workspace_source', 'workspace_id', 'source_type'),
        Index('idx_transcript_classifications_status', 'processing_status'),
        Index('idx_transcript_classifications_date', 'transcript_date'),
        # GIN index for JSONB queries
        Index('idx_transcript_classifications_extracted_data', 'extracted_data', postgresql_using='gin'),
        # GIN indexes for array columns - much faster than JSONB array expansion
        Index('idx_transcript_classifications_theme_ids', 'theme_ids', postgresql_using='gin'),
        Index('idx_transcript_classifications_sub_theme_ids', 'sub_theme_ids', postgresql_using='gin'),
    )
    
    def __repr__(self) -> str:
        return f"<TranscriptClassification(id={self.id}, source_type='{self.source_type}', source_id='{self.source_id}', workspace_id={self.workspace_id})>"

"""
AI Processing Pipeline Tasks

Production-grade, tiered AI processing for feature extraction.

Pipeline stages:
1. Normalization: Convert source data to NormalizedEvents
2. Chunking: Split large content into semantic chunks
3. Tier-1 Classification: Quick AI check for feature relevance (score >= 6 passes)
4. Tier-2 Extraction: Detailed feature extraction to CustomerAsks
5. Tier-3 Aggregation: Update statistics and cleanup (maintenance only)
"""

from app.sync_engine.tasks.ai_pipeline.normalization import normalize_source_data
from app.sync_engine.tasks.ai_pipeline.chunking import chunk_normalized_events
from app.sync_engine.tasks.ai_pipeline.tier1_classification import classify_events
from app.sync_engine.tasks.ai_pipeline.tier2_extraction import extract_features
from app.sync_engine.tasks.ai_pipeline.tier3_aggregation import aggregate_facts, cleanup_old_facts

__all__ = [
    "normalize_source_data",
    "chunk_normalized_events",
    "classify_events",
    "extract_features",
    "aggregate_facts",
    "cleanup_old_facts",
]

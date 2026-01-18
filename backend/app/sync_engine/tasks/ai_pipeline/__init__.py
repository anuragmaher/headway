"""
AI Processing Pipeline Tasks

Production-grade, tiered AI processing for feature extraction.

Pipeline stages:
1. Normalization: Convert source data to NormalizedEvents
2. Signal Scoring: Deterministic scoring to filter low-value content
3. Chunking: Split large content into semantic chunks
4. Tier-1 Classification: Quick AI check for feature relevance
5. Tier-2 Extraction: Detailed feature extraction to ExtractedFacts
6. Tier-3 Aggregation: Merge facts into Features (periodic)
"""

from app.sync_engine.tasks.ai_pipeline.normalization import normalize_source_data
from app.sync_engine.tasks.ai_pipeline.signal_scoring import score_normalized_events
from app.sync_engine.tasks.ai_pipeline.chunking import chunk_normalized_events
from app.sync_engine.tasks.ai_pipeline.tier1_classification import classify_events
from app.sync_engine.tasks.ai_pipeline.tier2_extraction import extract_features
from app.sync_engine.tasks.ai_pipeline.tier3_aggregation import aggregate_facts, cleanup_old_facts

__all__ = [
    "normalize_source_data",
    "score_normalized_events",
    "chunk_normalized_events",
    "classify_events",
    "extract_features",
    "aggregate_facts",
    "cleanup_old_facts",
]

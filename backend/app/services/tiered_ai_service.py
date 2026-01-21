"""
Tiered AI Processing Service

Provides Tier-1 (classification) and Tier-2 (extraction) AI calls
for the production AI processing pipeline.

Optimized for efficiency with:
- Async support for concurrent API calls
- Retry logic with exponential backoff
- Batch processing for multiple items
- Connection pooling
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor
import time

from openai import OpenAI, AsyncOpenAI
from openai import RateLimitError, APITimeoutError, APIConnectionError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.core.config import settings
from app.services.ai_pipeline_prompts import (
    build_tier1_prompt,
    build_tier2_prompt,
    build_theme_prompt,
    build_aggregation_prompt,
    TIER1_PROMPT_VERSION,
    TIER2_PROMPT_VERSION,
    AGGREGATION_PROMPT_VERSION,
)

logger = logging.getLogger(__name__)


@dataclass
class Tier1Result:
    """Result from Tier-1 scoring (0-10 scale)."""
    score: float  # 0-10 score, proceed to extraction if >= 6
    reasoning: str
    tokens_used: int = 0
    model: str = ""
    prompt_version: str = ""
    latency_ms: float = 0.0

    @property
    def is_feature_relevant(self) -> bool:
        """For backwards compatibility - returns True if score >= 6."""
        return self.score >= 6.0

    @property
    def confidence(self) -> float:
        """For backwards compatibility - converts score to 0-1 range."""
        return self.score / 10.0


@dataclass
class Tier2Result:
    """Result from Tier-2 extraction with theme assignment and feature matching."""
    feature_title: str
    feature_description: Optional[str] = None
    problem_statement: Optional[str] = None
    desired_outcome: Optional[str] = None
    user_persona: Optional[str] = None
    use_case: Optional[str] = None
    priority_hint: Optional[str] = None
    urgency_hint: Optional[str] = None
    sentiment: Optional[str] = None
    keywords: Optional[List[str]] = None
    confidence: float = 0.0
    # Theme assignment
    theme_name: Optional[str] = None
    theme_confidence: float = 0.0
    # Feature matching
    matched_feature_id: Optional[str] = None
    matched_feature_name: Optional[str] = None
    match_confidence: float = 0.0
    is_new_feature: bool = True  # True if no existing feature matched
    # Metadata
    tokens_used: int = 0
    model: str = ""
    prompt_version: str = ""
    latency_ms: float = 0.0


@dataclass
class ThemeResult:
    """Result from theme classification."""
    theme_id: Optional[str] = None
    theme_name: Optional[str] = None
    confidence: float = 0.0
    reasoning: str = ""


@dataclass
class AggregationResult:
    """Result from aggregation check."""
    should_merge: bool = False
    existing_feature_id: Optional[str] = None
    similarity_score: float = 0.0
    reasoning: str = ""


@dataclass
class BatchResult:
    """Result from batch processing."""
    successful: List[Any] = field(default_factory=list)
    failed: List[Dict[str, Any]] = field(default_factory=list)
    total_tokens: int = 0
    total_latency_ms: float = 0.0


# Retry decorator for OpenAI API calls
def with_retry(func):
    """Decorator for retry logic with exponential backoff."""
    return retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((RateLimitError, APITimeoutError, APIConnectionError)),
        before_sleep=lambda retry_state: logger.warning(
            f"Retrying {func.__name__} after {retry_state.outcome.exception()}, "
            f"attempt {retry_state.attempt_number}"
        )
    )(func)


class TieredAIService:
    """
    Service for tiered AI processing.

    Tier-1: Quick classification (is this a feature request?)
    Tier-2: Structured extraction (extract feature details)

    Features:
    - Sync and async API support
    - Automatic retries with exponential backoff
    - Batch processing for multiple items
    - Connection pooling for efficiency
    """

    DEFAULT_MODEL = "gpt-4o-mini"
    MAX_RETRIES = 3
    MAX_CONCURRENT_REQUESTS = 5  # Limit concurrent API calls
    REQUEST_TIMEOUT = 30  # seconds

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the tiered AI service.

        Args:
            api_key: OpenAI API key (defaults to settings)
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY in .env file.")

        # Sync client for regular calls
        self.client = OpenAI(
            api_key=self.api_key,
            timeout=self.REQUEST_TIMEOUT,
            max_retries=0,  # We handle retries ourselves
        )

        # Async client for batch/concurrent calls
        self._async_client: Optional[AsyncOpenAI] = None

        # Thread pool for running async in sync context
        self._executor = ThreadPoolExecutor(max_workers=self.MAX_CONCURRENT_REQUESTS)

        # Semaphore for rate limiting
        self._semaphore: Optional[asyncio.Semaphore] = None

    @property
    def async_client(self) -> AsyncOpenAI:
        """Lazy initialization of async client."""
        if self._async_client is None:
            self._async_client = AsyncOpenAI(
                api_key=self.api_key,
                timeout=self.REQUEST_TIMEOUT,
                max_retries=0,
            )
        return self._async_client

    def _get_semaphore(self) -> asyncio.Semaphore:
        """Get or create semaphore for rate limiting."""
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_REQUESTS)
        return self._semaphore

    # =========================================================================
    # Tier-1: Classification (Sync)
    # =========================================================================

    @with_retry
    def tier1_classify(
        self,
        text: str,
        source_type: str = "unknown",
        actor_role: Optional[str] = None,
    ) -> Tier1Result:
        """
        Tier-1 Classification: Determine if text contains feature requests.

        This is a cheap, fast call to filter out irrelevant content
        before running expensive extraction.
        """
        start_time = time.time()

        try:
            system_prompt, user_prompt = build_tier1_prompt(
                text=text,
                source_type=source_type,
                actor_role=actor_role,
            )

            response = self.client.chat.completions.create(
                model=self.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
                max_tokens=200
            )

            latency_ms = (time.time() - start_time) * 1000
            result = json.loads(response.choices[0].message.content)

            # Parse score (0-10) from new prompt format
            score = float(result.get("score", 0))
            # Clamp score to 0-10 range
            score = max(0.0, min(10.0, score))

            return Tier1Result(
                score=score,
                reasoning=result.get("reasoning", "No reasoning provided"),
                tokens_used=response.usage.total_tokens,
                model=self.DEFAULT_MODEL,
                prompt_version=TIER1_PROMPT_VERSION,
                latency_ms=latency_ms
            )

        except json.JSONDecodeError as e:
            logger.error(f"Tier-1 JSON decode error: {e}")
            return Tier1Result(
                score=0.0,
                reasoning=f"JSON decode error: {str(e)}",
                tokens_used=0,
                model=self.DEFAULT_MODEL,
                prompt_version=TIER1_PROMPT_VERSION,
                latency_ms=(time.time() - start_time) * 1000
            )

        except Exception as e:
            logger.error(f"Tier-1 classification error: {e}")
            return Tier1Result(
                score=6.0,  # Default to processing on error (threshold score)
                reasoning=f"Error during classification: {str(e)}",
                tokens_used=0,
                model=self.DEFAULT_MODEL,
                prompt_version=TIER1_PROMPT_VERSION,
                latency_ms=(time.time() - start_time) * 1000
            )

    # =========================================================================
    # Tier-1: Classification (Async)
    # =========================================================================

    async def tier1_classify_async(
        self,
        text: str,
        source_type: str = "unknown",
        actor_role: Optional[str] = None,
    ) -> Tier1Result:
        """Async version of tier1_classify for concurrent processing."""
        start_time = time.time()

        async with self._get_semaphore():
            try:
                system_prompt, user_prompt = build_tier1_prompt(
                    text=text,
                    source_type=source_type,
                    actor_role=actor_role,
                )

                response = await self.async_client.chat.completions.create(
                    model=self.DEFAULT_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    response_format={"type": "json_object"},
                    max_tokens=200
                )

                latency_ms = (time.time() - start_time) * 1000
                result = json.loads(response.choices[0].message.content)

                # Parse score (0-10) from new prompt format
                score = float(result.get("score", 0))
                score = max(0.0, min(10.0, score))

                return Tier1Result(
                    score=score,
                    reasoning=result.get("reasoning", "No reasoning provided"),
                    tokens_used=response.usage.total_tokens,
                    model=self.DEFAULT_MODEL,
                    prompt_version=TIER1_PROMPT_VERSION,
                    latency_ms=latency_ms
                )

            except Exception as e:
                logger.error(f"Tier-1 async classification error: {e}")
                return Tier1Result(
                    score=6.0,  # Default to processing on error
                    reasoning=f"Error: {str(e)}",
                    tokens_used=0,
                    model=self.DEFAULT_MODEL,
                    prompt_version=TIER1_PROMPT_VERSION,
                    latency_ms=(time.time() - start_time) * 1000
                )

    # =========================================================================
    # Tier-1: Batch Classification
    # =========================================================================

    async def tier1_classify_batch_async(
        self,
        items: List[Dict[str, Any]],
    ) -> BatchResult:
        """
        Classify multiple items concurrently.

        Args:
            items: List of dicts with 'text', 'source_type', 'actor_role' keys

        Returns:
            BatchResult with successful and failed results
        """
        batch_result = BatchResult()
        start_time = time.time()

        async def process_item(item: Dict[str, Any], index: int):
            try:
                result = await self.tier1_classify_async(
                    text=item.get("text", ""),
                    source_type=item.get("source_type", "unknown"),
                    actor_role=item.get("actor_role"),
                )
                return (index, result, None)
            except Exception as e:
                return (index, None, str(e))

        tasks = [process_item(item, i) for i, item in enumerate(items)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                batch_result.failed.append({"error": str(result)})
            else:
                index, tier1_result, error = result
                if error:
                    batch_result.failed.append({"index": index, "error": error})
                else:
                    batch_result.successful.append(tier1_result)
                    batch_result.total_tokens += tier1_result.tokens_used

        batch_result.total_latency_ms = (time.time() - start_time) * 1000
        return batch_result

    def tier1_classify_batch(self, items: List[Dict[str, Any]]) -> BatchResult:
        """Sync wrapper for batch classification."""
        return asyncio.run(self.tier1_classify_batch_async(items))

    # =========================================================================
    # Tier-2: Extraction (Sync)
    # =========================================================================

    @with_retry
    def tier2_extract(
        self,
        text: str,
        source_type: str,
        actor_name: Optional[str] = None,
        actor_role: Optional[str] = None,
        title: Optional[str] = None,
        themes: Optional[List[Dict[str, Any]]] = None,
        existing_features: Optional[List[Dict[str, Any]]] = None,
    ) -> Tier2Result:
        """
        Tier-2 Extraction: Extract feature, assign theme, and match with existing features.

        Only called for content that passed Tier-1 classification.
        Now includes theme assignment and feature matching in a single call.
        """
        start_time = time.time()

        try:
            system_prompt, user_prompt = build_tier2_prompt(
                text=text,
                source_type=source_type,
                actor_name=actor_name or "Unknown",
                actor_role=actor_role or "unknown",
                title=title,
                themes=themes,
                existing_features=existing_features,
            )

            response = self.client.chat.completions.create(
                model=self.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
                max_tokens=2000
            )

            latency_ms = (time.time() - start_time) * 1000
            result = json.loads(response.choices[0].message.content)

            # Parse feature request
            feature = result.get("feature_request") or {}
            if not feature:
                # No valid feature found
                return Tier2Result(
                    feature_title="No Feature Found",
                    confidence=0.0,
                    is_new_feature=False,
                    tokens_used=response.usage.total_tokens,
                    model=self.DEFAULT_MODEL,
                    prompt_version=TIER2_PROMPT_VERSION,
                    latency_ms=latency_ms
                )

            # Parse theme assignment
            theme_assignment = result.get("theme_assignment") or {}
            theme_name = theme_assignment.get("theme_name")
            theme_confidence = float(theme_assignment.get("confidence", 0.0))

            # Parse feature match
            feature_match = result.get("feature_match") or {}
            matched = feature_match.get("matched", False)
            matched_feature_id = feature_match.get("existing_feature_id") if matched else None
            matched_feature_name = feature_match.get("existing_feature_name") if matched else None
            match_confidence = float(feature_match.get("match_confidence", 0.0))

            return Tier2Result(
                feature_title=feature.get("title", feature.get("feature_title", "Untitled Feature")),
                feature_description=feature.get("description", feature.get("feature_description")),
                problem_statement=feature.get("problem_statement"),
                desired_outcome=feature.get("desired_outcome"),
                user_persona=feature.get("user_persona", feature.get("user_role")),
                use_case=feature.get("use_case"),
                priority_hint=feature.get("priority", feature.get("priority_hint")),
                urgency_hint=feature.get("urgency", feature.get("urgency_hint")),
                sentiment=feature.get("sentiment"),
                keywords=feature.get("keywords", []),
                confidence=float(result.get("confidence", 0.7)),
                # Theme assignment
                theme_name=theme_name,
                theme_confidence=theme_confidence,
                # Feature matching
                matched_feature_id=matched_feature_id,
                matched_feature_name=matched_feature_name,
                match_confidence=match_confidence,
                is_new_feature=not matched,
                # Metadata
                tokens_used=response.usage.total_tokens,
                model=self.DEFAULT_MODEL,
                prompt_version=TIER2_PROMPT_VERSION,
                latency_ms=latency_ms
            )

        except json.JSONDecodeError as e:
            logger.error(f"Tier-2 JSON decode error: {e}")
            return Tier2Result(
                feature_title="Extraction Failed",
                confidence=0.0,
                is_new_feature=False,
                tokens_used=0,
                model=self.DEFAULT_MODEL,
                prompt_version=TIER2_PROMPT_VERSION,
                latency_ms=(time.time() - start_time) * 1000
            )

        except Exception as e:
            logger.error(f"Tier-2 extraction error: {e}")
            return Tier2Result(
                feature_title="Extraction Error",
                confidence=0.0,
                is_new_feature=False,
                tokens_used=0,
                model=self.DEFAULT_MODEL,
                prompt_version=TIER2_PROMPT_VERSION,
                latency_ms=(time.time() - start_time) * 1000
            )

    # =========================================================================
    # Tier-2: Extraction (Async)
    # =========================================================================

    async def tier2_extract_async(
        self,
        text: str,
        source_type: str,
        actor_name: Optional[str] = None,
        actor_role: Optional[str] = None,
        title: Optional[str] = None,
        themes: Optional[List[Dict[str, Any]]] = None,
        existing_features: Optional[List[Dict[str, Any]]] = None,
    ) -> Tier2Result:
        """Async version of tier2_extract for concurrent processing."""
        start_time = time.time()

        async with self._get_semaphore():
            try:
                system_prompt, user_prompt = build_tier2_prompt(
                    text=text,
                    source_type=source_type,
                    actor_name=actor_name or "Unknown",
                    actor_role=actor_role or "unknown",
                    title=title,
                    themes=themes,
                    existing_features=existing_features,
                )

                response = await self.async_client.chat.completions.create(
                    model=self.DEFAULT_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.2,
                    response_format={"type": "json_object"},
                    max_tokens=2000
                )

                latency_ms = (time.time() - start_time) * 1000
                result = json.loads(response.choices[0].message.content)

                # Parse feature request
                feature = result.get("feature_request") or {}
                if not feature:
                    return Tier2Result(
                        feature_title="No Feature Found",
                        confidence=0.0,
                        is_new_feature=False,
                        tokens_used=response.usage.total_tokens,
                        model=self.DEFAULT_MODEL,
                        prompt_version=TIER2_PROMPT_VERSION,
                        latency_ms=latency_ms
                    )

                # Parse theme assignment
                theme_assignment = result.get("theme_assignment") or {}
                theme_name = theme_assignment.get("theme_name")
                theme_confidence = float(theme_assignment.get("confidence", 0.0))

                # Parse feature match
                feature_match = result.get("feature_match") or {}
                matched = feature_match.get("matched", False)
                matched_feature_id = feature_match.get("existing_feature_id") if matched else None
                matched_feature_name = feature_match.get("existing_feature_name") if matched else None
                match_confidence = float(feature_match.get("match_confidence", 0.0))

                return Tier2Result(
                    feature_title=feature.get("title", feature.get("feature_title", "Untitled Feature")),
                    feature_description=feature.get("description", feature.get("feature_description")),
                    problem_statement=feature.get("problem_statement"),
                    desired_outcome=feature.get("desired_outcome"),
                    user_persona=feature.get("user_persona", feature.get("user_role")),
                    use_case=feature.get("use_case"),
                    priority_hint=feature.get("priority", feature.get("priority_hint")),
                    urgency_hint=feature.get("urgency", feature.get("urgency_hint")),
                    sentiment=feature.get("sentiment"),
                    keywords=feature.get("keywords", []),
                    confidence=float(result.get("confidence", 0.7)),
                    theme_name=theme_name,
                    theme_confidence=theme_confidence,
                    matched_feature_id=matched_feature_id,
                    matched_feature_name=matched_feature_name,
                    match_confidence=match_confidence,
                    is_new_feature=not matched,
                    tokens_used=response.usage.total_tokens,
                    model=self.DEFAULT_MODEL,
                    prompt_version=TIER2_PROMPT_VERSION,
                    latency_ms=latency_ms
                )

            except Exception as e:
                logger.error(f"Tier-2 async extraction error: {e}")
                return Tier2Result(
                    feature_title="Extraction Error",
                    confidence=0.0,
                    is_new_feature=False,
                    tokens_used=0,
                    model=self.DEFAULT_MODEL,
                    prompt_version=TIER2_PROMPT_VERSION,
                    latency_ms=(time.time() - start_time) * 1000
                )

    # =========================================================================
    # Tier-2: Batch Extraction
    # =========================================================================

    async def tier2_extract_batch_async(
        self,
        items: List[Dict[str, Any]],
    ) -> BatchResult:
        """
        Extract features from multiple items concurrently.

        Args:
            items: List of dicts with extraction parameters

        Returns:
            BatchResult with successful and failed results
        """
        batch_result = BatchResult()
        start_time = time.time()

        async def process_item(item: Dict[str, Any], index: int):
            try:
                result = await self.tier2_extract_async(
                    text=item.get("text", ""),
                    source_type=item.get("source_type", "unknown"),
                    actor_name=item.get("actor_name"),
                    actor_role=item.get("actor_role"),
                    title=item.get("title"),
                    metadata=item.get("metadata"),
                )
                return (index, result, None)
            except Exception as e:
                return (index, None, str(e))

        tasks = [process_item(item, i) for i, item in enumerate(items)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                batch_result.failed.append({"error": str(result)})
            else:
                index, tier2_result, error = result
                if error:
                    batch_result.failed.append({"index": index, "error": error})
                else:
                    batch_result.successful.append(tier2_result)
                    batch_result.total_tokens += tier2_result.tokens_used

        batch_result.total_latency_ms = (time.time() - start_time) * 1000
        return batch_result

    def tier2_extract_batch(self, items: List[Dict[str, Any]]) -> BatchResult:
        """Sync wrapper for batch extraction."""
        return asyncio.run(self.tier2_extract_batch_async(items))

    # =========================================================================
    # Theme Classification
    # =========================================================================

    @with_retry
    def classify_theme(
        self,
        feature_title: str,
        feature_description: str,
        themes: List[Dict[str, Any]],
        problem_statement: Optional[str] = None,
    ) -> ThemeResult:
        """Classify a feature into a theme."""
        try:
            if not themes:
                return ThemeResult(
                    theme_id=None,
                    theme_name="Uncategorized",
                    confidence=1.0,
                    reasoning="No themes available"
                )

            system_prompt, user_prompt = build_theme_prompt(
                feature_title=feature_title,
                feature_description=feature_description,
                problem_statement=problem_statement or "",
                themes=themes
            )

            response = self.client.chat.completions.create(
                model=self.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
                max_tokens=300
            )

            result = json.loads(response.choices[0].message.content)

            suggested_name = result.get("suggested_theme", result.get("theme_name"))
            theme_id = result.get("theme_id")

            if not theme_id and suggested_name:
                for theme in themes:
                    if theme.get("name", "").lower() == suggested_name.lower():
                        theme_id = theme.get("id")
                        break

            return ThemeResult(
                theme_id=theme_id,
                theme_name=suggested_name or "Uncategorized",
                confidence=float(result.get("confidence", 0.5)),
                reasoning=result.get("reasoning", "")
            )

        except Exception as e:
            logger.error(f"Theme classification error: {e}")
            return ThemeResult(
                theme_id=None,
                theme_name="Uncategorized",
                confidence=0.0,
                reasoning=f"Error: {str(e)}"
            )

    # =========================================================================
    # Aggregation Check
    # =========================================================================

    @with_retry
    def check_aggregation(
        self,
        new_title: str,
        new_description: str,
        existing_features: List[Dict[str, Any]],
        new_problem: Optional[str] = None,
    ) -> AggregationResult:
        """Check if a new feature should merge with existing ones."""
        try:
            if not existing_features:
                return AggregationResult(
                    should_merge=False,
                    existing_feature_id=None,
                    similarity_score=0.0,
                    reasoning="No existing features to merge with"
                )

            system_prompt, user_prompt = build_aggregation_prompt(
                new_title=new_title,
                new_description=new_description,
                new_problem=new_problem or "",
                existing_features=existing_features
            )

            response = self.client.chat.completions.create(
                model=self.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
                max_tokens=400
            )

            result = json.loads(response.choices[0].message.content)

            return AggregationResult(
                should_merge=result.get("should_merge", False),
                existing_feature_id=result.get("matching_feature_id", result.get("existing_feature_id")),
                similarity_score=float(result.get("confidence", result.get("similarity_score", 0.0))),
                reasoning=result.get("reasoning", "")
            )

        except Exception as e:
            logger.error(f"Aggregation check error: {e}")
            return AggregationResult(
                should_merge=False,
                existing_feature_id=None,
                similarity_score=0.0,
                reasoning=f"Error: {str(e)}"
            )

    # =========================================================================
    # Cleanup
    # =========================================================================

    async def close(self):
        """Close async client and cleanup resources."""
        if self._async_client:
            await self._async_client.close()
            self._async_client = None
        self._executor.shutdown(wait=False)

    def __del__(self):
        """Cleanup on deletion."""
        if self._executor:
            self._executor.shutdown(wait=False)


# Singleton instance
_tiered_ai_service: Optional[TieredAIService] = None


def get_tiered_ai_service() -> TieredAIService:
    """Get or create the tiered AI service singleton."""
    global _tiered_ai_service
    if _tiered_ai_service is None:
        _tiered_ai_service = TieredAIService()
    return _tiered_ai_service


async def get_tiered_ai_service_async() -> TieredAIService:
    """Async version - returns the same singleton."""
    return get_tiered_ai_service()

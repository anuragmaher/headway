"""
Deterministic Signal Scoring Service

Computes signal scores for normalized events using rule-based heuristics.
This runs BEFORE any AI calls to filter out low-value content and save tokens.

Signal Score Range: 0.0 - 1.0
- 0.0-0.3: Very unlikely to contain feature requests (skip AI)
- 0.3-0.5: Low probability, may contain noise
- 0.5-0.7: Moderate probability, worth processing
- 0.7-1.0: High probability, likely contains feature requests
"""

import re
import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SignalScore:
    """Result of signal scoring."""
    score: float  # 0.0 - 1.0
    reason: str  # Human-readable reason for the score
    keywords_found: List[str] = field(default_factory=list)
    positive_signals: List[str] = field(default_factory=list)
    negative_signals: List[str] = field(default_factory=list)
    should_skip: bool = False  # True if score is below threshold


class SignalScoringService:
    """
    Service for deterministic signal scoring of text content.

    Uses rule-based heuristics to estimate the probability that
    a piece of text contains feature requests or valuable feedback.
    """

    # High-value keywords (strong indicators of feature requests)
    HIGH_VALUE_KEYWORDS = {
        # Direct feature language
        'feature request': 3.0,
        'feature suggestion': 3.0,
        'would be great if': 2.5,
        'would be nice if': 2.5,
        'would love to see': 2.5,
        'would love if': 2.5,
        'wish there was': 2.5,
        'wish you had': 2.5,
        'it would help if': 2.5,

        # Need/Want expressions
        'we need': 2.0,
        'i need': 2.0,
        'we want': 2.0,
        'i want': 2.0,
        'we require': 2.0,
        'requirement': 1.5,

        # Capability requests
        'can you add': 2.5,
        'could you add': 2.5,
        'please add': 2.5,
        'ability to': 2.0,
        'capability to': 2.0,
        'option to': 1.5,

        # Frustration/Pain language
        'pain point': 2.5,
        'frustrating': 2.0,
        'frustrated': 2.0,
        'difficult to': 1.5,
        'hard to': 1.5,
        'impossible to': 2.0,
        'can\'t figure out': 1.5,
        'struggling with': 2.0,
        'workaround': 2.0,
        'limitation': 2.0,
        'missing': 1.5,

        # Improvement language
        'improve': 1.5,
        'improvement': 1.5,
        'better if': 2.0,
        'easier if': 2.0,
        'enhance': 1.5,
        'enhancement': 1.5,
        'upgrade': 1.5,

        # Integration/Support requests
        'integrate with': 2.0,
        'integration with': 2.0,
        'support for': 2.0,
        'compatibility with': 1.5,
        'connect to': 1.5,

        # Questions that indicate feature interest
        'is it possible to': 2.0,
        'is there a way to': 2.0,
        'how do i': 1.0,
        'how can i': 1.0,
        'do you support': 1.5,
        'does it support': 1.5,
        'any plans to': 2.5,
        'on the roadmap': 2.5,

        # Urgency indicators
        'urgent': 1.5,
        'asap': 1.5,
        'critical': 1.5,
        'blocker': 2.0,
        'dealbreaker': 2.5,
        'must have': 2.0,
        'essential': 1.5,
    }

    # Medium-value keywords (moderate indicators)
    MEDIUM_VALUE_KEYWORDS = {
        'functionality': 1.0,
        'function': 0.8,
        'workflow': 1.0,
        'process': 0.8,
        'automate': 1.2,
        'automation': 1.2,
        'export': 1.0,
        'import': 1.0,
        'report': 0.8,
        'dashboard': 1.0,
        'notification': 1.0,
        'alert': 0.8,
        'api': 1.2,
        'webhook': 1.2,
        'bulk': 1.0,
        'batch': 1.0,
        'customize': 1.2,
        'configuration': 1.0,
        'settings': 0.8,
        'permission': 1.0,
        'role': 0.8,
        'template': 1.0,
    }

    # Negative keywords (reduce score - likely not feature requests)
    NEGATIVE_KEYWORDS = {
        # Sales/Pricing (not feature requests)
        'pricing': -2.0,
        'price': -1.5,
        'cost': -1.5,
        'invoice': -2.0,
        'billing': -2.0,
        'subscription': -1.5,
        'discount': -2.0,
        'quote': -1.5,
        'contract': -1.5,
        'payment': -2.0,
        'refund': -2.0,

        # Support/Documentation (not feature requests)
        'documentation': -1.0,
        'tutorial': -1.0,
        'how-to': -1.0,
        'training': -1.0,
        'demo': -1.0,
        'webinar': -1.0,

        # Generic greetings/closings
        'thanks': -0.5,
        'thank you': -0.5,
        'regards': -0.5,
        'cheers': -0.5,

        # Chit-chat
        'weather': -1.5,
        'weekend': -1.0,
        'holiday': -1.0,
    }

    # Minimum length thresholds by source
    MIN_LENGTH_THRESHOLDS = {
        'slack': 30,      # Slack messages can be short
        'gmail': 100,     # Emails typically longer
        'gong': 200,      # Transcripts should have substance
        'fathom': 200,
        'default': 50,
    }

    # Skip threshold - below this score, don't process with AI
    DEFAULT_SKIP_THRESHOLD = 0.3

    def __init__(self, skip_threshold: float = DEFAULT_SKIP_THRESHOLD):
        """
        Initialize the signal scoring service.

        Args:
            skip_threshold: Score below which to skip AI processing
        """
        self.skip_threshold = skip_threshold

        # Compile keyword patterns for efficiency
        self._high_patterns = self._compile_patterns(self.HIGH_VALUE_KEYWORDS)
        self._medium_patterns = self._compile_patterns(self.MEDIUM_VALUE_KEYWORDS)
        self._negative_patterns = self._compile_patterns(self.NEGATIVE_KEYWORDS)

    def _compile_patterns(self, keywords: Dict[str, float]) -> List[Tuple[re.Pattern, str, float]]:
        """Compile keyword patterns for efficient matching."""
        patterns = []
        for keyword, weight in keywords.items():
            # Word boundary matching, case insensitive
            pattern = re.compile(r'\b' + re.escape(keyword) + r'\b', re.IGNORECASE)
            patterns.append((pattern, keyword, weight))
        return patterns

    def score(
        self,
        text: str,
        source_type: str = "default",
        actor_role: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SignalScore:
        """
        Compute signal score for a piece of text.

        Args:
            text: Normalized text to score
            source_type: Source type (gmail, slack, gong, fathom)
            actor_role: Role of the actor (internal, external, customer)
            metadata: Additional metadata for scoring

        Returns:
            SignalScore with computed score and details
        """
        if not text:
            return SignalScore(
                score=0.0,
                reason="Empty text",
                should_skip=True
            )

        text_lower = text.lower()
        text_length = len(text)

        # Start with base score
        base_score = 0.5
        total_score = base_score

        keywords_found = []
        positive_signals = []
        negative_signals = []

        # Check minimum length
        min_length = self.MIN_LENGTH_THRESHOLDS.get(source_type, self.MIN_LENGTH_THRESHOLDS['default'])
        if text_length < min_length:
            total_score -= 0.3
            negative_signals.append(f"Short text ({text_length} chars < {min_length})")

        # Apply keyword scoring
        high_score, high_keywords = self._match_patterns(text_lower, self._high_patterns)
        medium_score, medium_keywords = self._match_patterns(text_lower, self._medium_patterns)
        negative_score, negative_keywords = self._match_patterns(text_lower, self._negative_patterns)

        keywords_found.extend(high_keywords)
        keywords_found.extend(medium_keywords)

        # Normalize keyword scores (cap contributions)
        high_contribution = min(high_score * 0.1, 0.4)  # Cap at 0.4
        medium_contribution = min(medium_score * 0.05, 0.2)  # Cap at 0.2
        negative_contribution = min(abs(negative_score) * 0.1, 0.3)  # Cap at 0.3

        total_score += high_contribution
        total_score += medium_contribution
        total_score -= negative_contribution

        if high_keywords:
            positive_signals.append(f"High-value keywords: {', '.join(high_keywords[:5])}")
        if medium_keywords:
            positive_signals.append(f"Medium-value keywords: {', '.join(medium_keywords[:5])}")
        if negative_keywords:
            negative_signals.append(f"Negative keywords: {', '.join(negative_keywords[:5])}")

        # Actor role bonus
        if actor_role == "customer" or actor_role == "external":
            total_score += 0.1
            positive_signals.append("External/customer source")
        elif actor_role == "internal":
            # Internal messages slightly less likely to be feature requests
            total_score -= 0.05
            negative_signals.append("Internal source")

        # Source-specific adjustments
        total_score = self._apply_source_adjustments(
            total_score, source_type, text, positive_signals, negative_signals
        )

        # Metadata-based adjustments
        if metadata:
            total_score = self._apply_metadata_adjustments(
                total_score, metadata, positive_signals, negative_signals
            )

        # Clamp score to [0.0, 1.0]
        total_score = max(0.0, min(1.0, total_score))

        # Determine if should skip
        should_skip = total_score < self.skip_threshold

        # Build reason string
        reason_parts = []
        if positive_signals:
            reason_parts.append("Positive: " + "; ".join(positive_signals[:3]))
        if negative_signals:
            reason_parts.append("Negative: " + "; ".join(negative_signals[:3]))

        reason = " | ".join(reason_parts) if reason_parts else "Baseline score"

        return SignalScore(
            score=round(total_score, 3),
            reason=reason,
            keywords_found=keywords_found,
            positive_signals=positive_signals,
            negative_signals=negative_signals,
            should_skip=should_skip
        )

    def _match_patterns(
        self,
        text: str,
        patterns: List[Tuple[re.Pattern, str, float]]
    ) -> Tuple[float, List[str]]:
        """Match patterns against text and return total score and matched keywords."""
        total_score = 0.0
        matched = []

        for pattern, keyword, weight in patterns:
            matches = pattern.findall(text)
            if matches:
                # Only count each keyword once (no double-counting)
                total_score += weight
                matched.append(keyword)

        return total_score, matched

    def _apply_source_adjustments(
        self,
        score: float,
        source_type: str,
        text: str,
        positive_signals: List[str],
        negative_signals: List[str]
    ) -> float:
        """Apply source-specific scoring adjustments."""

        if source_type == "gong" or source_type == "fathom":
            # Transcripts: Look for question patterns
            question_count = len(re.findall(r'\?', text))
            if question_count > 3:
                score += 0.1
                positive_signals.append(f"{question_count} questions asked")

            # Look for request language patterns specific to calls
            call_patterns = [
                r'can we\s+\w+',
                r'could we\s+\w+',
                r'what if\s+\w+',
                r'have you considered',
            ]
            call_matches = sum(len(re.findall(p, text.lower())) for p in call_patterns)
            if call_matches > 0:
                score += min(call_matches * 0.05, 0.15)
                positive_signals.append(f"{call_matches} request patterns in transcript")

        elif source_type == "slack":
            # Slack: Thread replies often contain follow-up discussions
            # Already handled in metadata, but check for reactions in text
            if ':+1:' in text or ':thumbsup:' in text or ':100:' in text:
                score += 0.05
                positive_signals.append("Positive reactions")

        elif source_type == "gmail":
            # Emails: Subject line keywords are important but not in text
            # Check for forwarded content (often contains valuable customer feedback)
            if 'fwd:' in text.lower() or 'forwarded' in text.lower():
                score += 0.1
                positive_signals.append("Forwarded email (may contain customer feedback)")

        return score

    def _apply_metadata_adjustments(
        self,
        score: float,
        metadata: Dict[str, Any],
        positive_signals: List[str],
        negative_signals: List[str]
    ) -> float:
        """Apply metadata-based scoring adjustments."""

        # Thread with multiple replies indicates discussion
        reply_count = metadata.get('reply_count', 0)
        if reply_count > 2:
            score += min(reply_count * 0.02, 0.1)
            positive_signals.append(f"{reply_count} thread replies")

        # Reactions indicate engagement
        reaction_count = metadata.get('reaction_count', 0)
        if reaction_count > 0:
            score += min(reaction_count * 0.02, 0.1)
            positive_signals.append(f"{reaction_count} reactions")

        # Call duration (longer calls may have more substance)
        duration = metadata.get('duration_minutes', 0)
        if duration > 30:
            score += 0.1
            positive_signals.append(f"{duration}min call duration")
        elif duration > 0 and duration < 5:
            score -= 0.1
            negative_signals.append("Very short call")

        # Customer info indicates this is customer-facing
        if metadata.get('customer_name') or metadata.get('customer_email'):
            score += 0.1
            positive_signals.append("Has customer info")

        # Multiple participants often means important meeting
        participant_count = metadata.get('participant_count', 0)
        if participant_count > 3:
            score += 0.05
            positive_signals.append(f"{participant_count} participants")

        return score

    def batch_score(
        self,
        items: List[Dict[str, Any]],
        text_key: str = "text",
        source_type_key: str = "source_type"
    ) -> List[SignalScore]:
        """
        Score multiple items in batch.

        Args:
            items: List of dicts containing text and metadata
            text_key: Key for text content in each item
            source_type_key: Key for source type in each item

        Returns:
            List of SignalScore objects
        """
        results = []
        for item in items:
            text = item.get(text_key, "")
            source_type = item.get(source_type_key, "default")
            actor_role = item.get("actor_role")
            metadata = item.get("metadata", {})

            score = self.score(
                text=text,
                source_type=source_type,
                actor_role=actor_role,
                metadata=metadata
            )
            results.append(score)

        return results


# Singleton instance
_signal_scorer: Optional[SignalScoringService] = None


def get_signal_scoring_service(skip_threshold: float = 0.3) -> SignalScoringService:
    """Get or create the signal scoring service singleton."""
    global _signal_scorer
    if _signal_scorer is None:
        _signal_scorer = SignalScoringService(skip_threshold=skip_threshold)
    return _signal_scorer

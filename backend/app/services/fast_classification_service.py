import os
import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from openai import OpenAI
import json
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.clustering import ClassificationSignal
from app.core.database import get_db

logger = logging.getLogger(__name__)


class FastClassificationService:
    """Service for fast classification using learned signals from approved clusters"""

    def __init__(self):
        """Initialize OpenAI client for embedding-based classification"""
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            logger.warning("OPENAI_API_KEY not found - semantic classification will be disabled")
            self.client = None
        else:
            self.client = OpenAI(api_key=api_key)

        # Cache for loaded signals to improve performance
        self._signal_cache = {}
        self._cache_timestamp = None

    def classify_message(
        self,
        message: Message,
        workspace_id: str,
        confidence_threshold: float = 0.6
    ) -> Dict[str, Any]:
        """
        Classify a message using learned signals from approved clusters

        Args:
            message: Message to classify
            workspace_id: Workspace ID for signal lookup
            confidence_threshold: Minimum confidence for classification

        Returns:
            Classification result with category, theme, confidence, and signals used
        """
        try:
            # Load active signals for workspace
            signals = self._get_active_signals(workspace_id)

            if not signals:
                return {
                    "classified": False,
                    "reason": "No active classification signals found",
                    "category": None,
                    "theme": None,
                    "confidence": 0.0,
                    "signals_used": []
                }

            # Apply different signal types
            classification_results = []

            # Apply keyword-based signals
            keyword_results = self._apply_keyword_signals(message, signals)
            classification_results.extend(keyword_results)

            # Apply pattern-based signals
            pattern_results = self._apply_pattern_signals(message, signals)
            classification_results.extend(pattern_results)

            # Apply semantic signals (if OpenAI client available)
            if self.client:
                semantic_results = self._apply_semantic_signals(message, signals)
                classification_results.extend(semantic_results)

            # Apply business rule signals
            rule_results = self._apply_business_rule_signals(message, signals)
            classification_results.extend(rule_results)

            # Combine results and determine final classification
            final_classification = self._combine_classification_results(
                classification_results,
                confidence_threshold
            )

            # Update signal usage statistics
            if final_classification["classified"]:
                self._update_signal_usage(final_classification["signals_used"])

            return final_classification

        except Exception as e:
            logger.error(f"Error classifying message {message.id}: {e}")
            return {
                "classified": False,
                "reason": f"Classification error: {str(e)}",
                "category": None,
                "theme": None,
                "confidence": 0.0,
                "signals_used": [],
                "error": str(e)
            }

    def _get_active_signals(self, workspace_id: str) -> List[ClassificationSignal]:
        """Get active classification signals for a workspace with caching"""
        current_time = datetime.utcnow()

        # Check if cache is valid (refresh every 5 minutes)
        if (self._cache_timestamp and
            (current_time - self._cache_timestamp).total_seconds() < 300 and
            workspace_id in self._signal_cache):
            return self._signal_cache[workspace_id]

        # Load signals from database
        db = next(get_db())
        try:
            signals = db.query(ClassificationSignal).filter(
                ClassificationSignal.workspace_id == workspace_id,
                ClassificationSignal.is_active == True
            ).all()

            # Update cache
            self._signal_cache[workspace_id] = signals
            self._cache_timestamp = current_time

            logger.info(f"Loaded {len(signals)} active signals for workspace {workspace_id}")
            return signals

        finally:
            db.close()

    def _apply_keyword_signals(
        self,
        message: Message,
        signals: List[ClassificationSignal]
    ) -> List[Dict[str, Any]]:
        """Apply keyword-based classification signals"""
        results = []
        content_lower = message.content.lower()

        for signal in signals:
            if signal.signal_type != "keyword" or not signal.keywords:
                continue

            # Check if any keywords match
            matched_keywords = []
            for keyword in signal.keywords:
                if keyword.lower() in content_lower:
                    matched_keywords.append(keyword)

            if matched_keywords:
                # Calculate confidence based on keyword matches
                confidence = min(0.9, len(matched_keywords) / len(signal.keywords) * signal.priority_weight)

                results.append({
                    "signal_id": signal.id,
                    "signal_name": signal.signal_name,
                    "signal_type": "keyword",
                    "category": signal.target_category,
                    "theme": signal.target_theme,
                    "confidence": confidence,
                    "evidence": {
                        "matched_keywords": matched_keywords,
                        "total_keywords": len(signal.keywords)
                    }
                })

        return results

    def _apply_pattern_signals(
        self,
        message: Message,
        signals: List[ClassificationSignal]
    ) -> List[Dict[str, Any]]:
        """Apply pattern-based (regex) classification signals"""
        results = []

        for signal in signals:
            if signal.signal_type != "pattern" or not signal.patterns:
                continue

            # Check if any patterns match
            matched_patterns = []
            for pattern in signal.patterns:
                try:
                    if re.search(pattern, message.content, re.IGNORECASE):
                        matched_patterns.append(pattern)
                except re.error as e:
                    logger.warning(f"Invalid regex pattern in signal {signal.id}: {pattern} - {e}")
                    continue

            if matched_patterns:
                # Calculate confidence based on pattern matches
                confidence = min(0.95, len(matched_patterns) / len(signal.patterns) * signal.priority_weight)

                results.append({
                    "signal_id": signal.id,
                    "signal_name": signal.signal_name,
                    "signal_type": "pattern",
                    "category": signal.target_category,
                    "theme": signal.target_theme,
                    "confidence": confidence,
                    "evidence": {
                        "matched_patterns": matched_patterns,
                        "total_patterns": len(signal.patterns)
                    }
                })

        return results

    def _apply_semantic_signals(
        self,
        message: Message,
        signals: List[ClassificationSignal]
    ) -> List[Dict[str, Any]]:
        """Apply semantic similarity classification signals"""
        if not self.client:
            return []

        results = []

        # Get message embedding
        try:
            message_embedding = self._get_message_embedding(message.content)
        except Exception as e:
            logger.error(f"Failed to get embedding for message {message.id}: {e}")
            return []

        for signal in signals:
            if signal.signal_type != "semantic" or not signal.semantic_threshold:
                continue

            # For semantic signals, we would need to store cluster embeddings
            # This is a simplified version - in practice you'd store cluster centroids
            # and calculate similarity against them

            # Placeholder for semantic similarity calculation
            # In a real implementation, you'd:
            # 1. Store cluster centroid embeddings when creating signals
            # 2. Calculate cosine similarity between message and cluster centroids
            # 3. Apply threshold and weight

            similarity_score = 0.0  # Placeholder

            if similarity_score >= signal.semantic_threshold:
                confidence = similarity_score * signal.priority_weight

                results.append({
                    "signal_id": signal.id,
                    "signal_name": signal.signal_name,
                    "signal_type": "semantic",
                    "category": signal.target_category,
                    "theme": signal.target_theme,
                    "confidence": confidence,
                    "evidence": {
                        "similarity_score": similarity_score,
                        "threshold": signal.semantic_threshold
                    }
                })

        return results

    def _apply_business_rule_signals(
        self,
        message: Message,
        signals: List[ClassificationSignal]
    ) -> List[Dict[str, Any]]:
        """Apply business rule-based classification signals"""
        results = []

        for signal in signals:
            if signal.signal_type != "business_rule" or not signal.business_rules:
                continue

            # Apply business rules
            rule_result = self._evaluate_business_rules(message, signal.business_rules)

            if rule_result["matches"]:
                confidence = rule_result["confidence"] * signal.priority_weight

                results.append({
                    "signal_id": signal.id,
                    "signal_name": signal.signal_name,
                    "signal_type": "business_rule",
                    "category": signal.target_category,
                    "theme": signal.target_theme,
                    "confidence": confidence,
                    "evidence": rule_result["evidence"]
                })

        return results

    def _evaluate_business_rules(self, message: Message, rules: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate business rules against a message"""
        # Example business rule evaluation
        # This would be expanded based on specific business logic needs

        evidence = {}
        matches = False
        confidence = 0.0

        # Example rule: Check message length
        if "min_length" in rules:
            if len(message.content) >= rules["min_length"]:
                evidence["length_check"] = "passed"
                confidence += 0.2
                matches = True

        # Example rule: Check channel type
        if "channel_patterns" in rules:
            for pattern in rules["channel_patterns"]:
                if message.channel_name and re.search(pattern, message.channel_name, re.IGNORECASE):
                    evidence["channel_match"] = pattern
                    confidence += 0.3
                    matches = True

        # Example rule: Check author type
        if "author_patterns" in rules:
            for pattern in rules["author_patterns"]:
                if message.author_name and re.search(pattern, message.author_name, re.IGNORECASE):
                    evidence["author_match"] = pattern
                    confidence += 0.2
                    matches = True

        return {
            "matches": matches,
            "confidence": min(1.0, confidence),
            "evidence": evidence
        }

    def _get_message_embedding(self, content: str) -> List[float]:
        """Get OpenAI embedding for message content"""
        response = self.client.embeddings.create(
            model="text-embedding-3-large",
            input=content[:8000]  # Truncate to avoid token limits
        )
        return response.data[0].embedding

    def _combine_classification_results(
        self,
        results: List[Dict[str, Any]],
        confidence_threshold: float
    ) -> Dict[str, Any]:
        """Combine multiple signal results into final classification"""
        if not results:
            return {
                "classified": False,
                "reason": "No signals matched",
                "category": None,
                "theme": None,
                "confidence": 0.0,
                "signals_used": []
            }

        # Group results by category and theme
        category_scores = {}
        theme_scores = {}

        for result in results:
            category = result["category"]
            theme = result["theme"]
            confidence = result["confidence"]

            if category not in category_scores:
                category_scores[category] = {"total_confidence": 0.0, "signals": []}
            category_scores[category]["total_confidence"] += confidence
            category_scores[category]["signals"].append(result)

            if theme not in theme_scores:
                theme_scores[theme] = {"total_confidence": 0.0, "signals": []}
            theme_scores[theme]["total_confidence"] += confidence
            theme_scores[theme]["signals"].append(result)

        # Find best category and theme
        best_category = max(category_scores.keys(), key=lambda k: category_scores[k]["total_confidence"])
        best_theme = max(theme_scores.keys(), key=lambda k: theme_scores[k]["total_confidence"])

        # Calculate final confidence (average of all matching signals)
        total_confidence = sum(r["confidence"] for r in results)
        final_confidence = total_confidence / len(results)

        # Check if confidence meets threshold
        if final_confidence < confidence_threshold:
            return {
                "classified": False,
                "reason": f"Confidence {final_confidence:.3f} below threshold {confidence_threshold}",
                "category": best_category,
                "theme": best_theme,
                "confidence": final_confidence,
                "signals_used": [r["signal_id"] for r in results]
            }

        return {
            "classified": True,
            "category": best_category,
            "theme": best_theme,
            "confidence": final_confidence,
            "signals_used": [r["signal_id"] for r in results],
            "signal_details": results
        }

    def _update_signal_usage(self, signal_ids: List[str]) -> None:
        """Update usage statistics for signals"""
        db = next(get_db())
        try:
            current_time = datetime.utcnow()

            for signal_id in signal_ids:
                signal = db.query(ClassificationSignal).filter(
                    ClassificationSignal.id == signal_id
                ).first()

                if signal:
                    signal.usage_count += 1
                    signal.last_used_at = current_time

            db.commit()

        except Exception as e:
            logger.error(f"Error updating signal usage: {e}")
        finally:
            db.close()

    def batch_classify_messages(
        self,
        messages: List[Message],
        workspace_id: str,
        confidence_threshold: float = 0.6
    ) -> List[Dict[str, Any]]:
        """
        Classify multiple messages in batch for better performance

        Args:
            messages: List of messages to classify
            workspace_id: Workspace ID for signal lookup
            confidence_threshold: Minimum confidence for classification

        Returns:
            List of classification results
        """
        results = []

        # Load signals once for all messages
        signals = self._get_active_signals(workspace_id)

        if not signals:
            logger.warning(f"No active signals found for workspace {workspace_id}")
            return [
                {
                    "message_id": str(message.id),
                    "classified": False,
                    "reason": "No active classification signals found"
                }
                for message in messages
            ]

        for message in messages:
            try:
                result = self.classify_message(message, workspace_id, confidence_threshold)
                result["message_id"] = str(message.id)
                results.append(result)

            except Exception as e:
                logger.error(f"Error classifying message {message.id}: {e}")
                results.append({
                    "message_id": str(message.id),
                    "classified": False,
                    "reason": f"Classification error: {str(e)}",
                    "error": str(e)
                })

        return results

    def get_classification_stats(self, workspace_id: str) -> Dict[str, Any]:
        """Get classification performance statistics"""
        db = next(get_db())
        try:
            signals = db.query(ClassificationSignal).filter(
                ClassificationSignal.workspace_id == workspace_id
            ).all()

            total_signals = len(signals)
            active_signals = len([s for s in signals if s.is_active])
            total_usage = sum(s.usage_count for s in signals)

            # Group by signal type
            type_stats = {}
            for signal in signals:
                signal_type = signal.signal_type
                if signal_type not in type_stats:
                    type_stats[signal_type] = {"count": 0, "active": 0, "usage": 0}

                type_stats[signal_type]["count"] += 1
                if signal.is_active:
                    type_stats[signal_type]["active"] += 1
                type_stats[signal_type]["usage"] += signal.usage_count

            return {
                "total_signals": total_signals,
                "active_signals": active_signals,
                "total_usage": total_usage,
                "signal_types": type_stats,
                "cache_timestamp": self._cache_timestamp.isoformat() if self._cache_timestamp else None
            }

        finally:
            db.close()


# Global service instance
fast_classification_service = FastClassificationService()
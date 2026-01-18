"""
AI-powered feature matching service for intelligent duplicate detection

Uses LLM to semantically compare feature requests and detect duplicates
with better accuracy than simple string matching.
"""

import json
from typing import Dict, List, Any, Optional
from openai import OpenAI
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIFeatureMatchingService:
    """Service for detecting duplicate features using semantic understanding"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the AI feature matching service

        Args:
            api_key: OpenAI API key (defaults to settings)
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY in .env file.")

        self.client = OpenAI(api_key=self.api_key)

    def find_matching_feature(
        self,
        new_feature: Dict[str, str],
        existing_features: List[Dict[str, str]],
        confidence_threshold: float = 0.8
    ) -> Dict[str, Any]:
        """
        Use LLM to determine if a new feature matches any existing features

        Args:
            new_feature: Dictionary with 'title' and 'description' keys
            existing_features: List of dicts with 'id', 'name', 'description' keys
            confidence_threshold: Minimum confidence to consider a match (0.0-1.0)

        Returns:
            {
                "is_duplicate": bool,
                "matching_feature_id": str | None,
                "confidence": float,
                "reasoning": str
            }
        """
        try:
            # If no existing features, it's definitely new
            if not existing_features or len(existing_features) == 0:
                return {
                    "is_duplicate": False,
                    "matching_feature_id": None,
                    "confidence": 1.0,
                    "reasoning": "No existing features to compare against"
                }

            # Build the existing features context
            existing_features_text = ""
            for idx, feature in enumerate(existing_features, 1):
                existing_features_text += f"{idx}. ID: {feature['id']}, Name: {feature['name']}\n"
                if feature.get('description'):
                    existing_features_text += f"   Description: {feature['description']}\n"

            # Create the prompt
            system_prompt = """You are a product manager expert at analyzing feature requests and detecting duplicates.

Your task is to determine if a NEW feature request is a duplicate or variation of any EXISTING features.

Consider:
- **Semantic similarity**: Same concept expressed differently (e.g., "AI Chatbot" vs "Chatbot powered by AI")
- **Core functionality**: Do they solve the same problem?
- **Use case overlap**: Would building one satisfy the other's requirements?
- **Scope**: Is one a subset/superset of the other?

Return confidence levels:
- **0.9-1.0**: Almost certainly the same feature (exact or very minor wording difference)
- **0.7-0.9**: Very likely the same feature (same core concept, different description)
- **0.5-0.7**: Possibly related but might be different aspects
- **0.0-0.5**: Different features

Return ONLY a valid JSON object with this exact structure:
{
  "is_duplicate": true/false,
  "matching_feature_id": "the UUID of the matching feature (not the index number), or null if no match",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why you think it matches or doesn't match"
}

IMPORTANT:
- If confidence >= threshold, set is_duplicate=true
- Only return ONE matching feature (the most similar one)
- Be conservative: when in doubt, treat as different features
- Focus on FUNCTIONALITY, not just keywords
- **CRITICAL**: Return the UUID in matching_feature_id, NOT the index number"""

            user_prompt = f"""NEW FEATURE REQUEST:
Title: {new_feature.get('title', 'No title')}
Description: {new_feature.get('description', 'No description')}

EXISTING FEATURES (use UUID in response, not the index number):
{existing_features_text}

Confidence Threshold: {confidence_threshold}

Determine if the NEW feature is a duplicate of any EXISTING feature. If it is a duplicate, return the UUID (not the index number) in matching_feature_id."""

            # Call OpenAI API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Fast and cost-effective
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,  # Lower temperature for more consistent matching
                response_format={"type": "json_object"}  # Force JSON response
            )

            # Parse the response
            result = json.loads(response.choices[0].message.content)

            # Validate and normalize the result
            is_duplicate = result.get('is_duplicate', False)
            confidence = float(result.get('confidence', 0.0))
            matching_feature_id = result.get('matching_feature_id')
            reasoning = result.get('reasoning', 'No reasoning provided')

            # Apply confidence threshold
            if confidence < confidence_threshold:
                is_duplicate = False
                matching_feature_id = None

            logger.info(
                f"Feature matching result: duplicate={is_duplicate}, "
                f"confidence={confidence:.2f}, match_id={matching_feature_id}"
            )

            return {
                "is_duplicate": is_duplicate,
                "matching_feature_id": matching_feature_id,
                "confidence": confidence,
                "reasoning": reasoning,
                "tokens_used": response.usage.total_tokens
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return self._no_match_result(f"JSON parsing error: {str(e)}")

        except Exception as e:
            logger.error(f"Error in feature matching: {e}")
            return self._no_match_result(f"Matching error: {str(e)}")

    def validate_theme_assignment(
        self,
        feature_title: str,
        feature_description: str,
        suggested_theme: str,
        theme_description: str
    ) -> Dict[str, Any]:
        """
        Validate if a feature truly belongs to the suggested theme

        Args:
            feature_title: Title of the feature
            feature_description: Description of the feature
            suggested_theme: The theme name suggested by AI
            theme_description: Description of what the theme encompasses

        Returns:
            {
                "is_valid": bool,
                "confidence": float (0.0-1.0),
                "reasoning": str
            }
        """
        try:
            system_prompt = """You are a product manager expert at categorizing features into themes.

Your task is to validate if a feature truly belongs to a suggested theme.

Return a confidence score:
- **0.9-1.0**: Perfect match - feature clearly belongs to this theme
- **0.8-0.9**: Good match - feature fits well within theme scope
- **0.6-0.8**: Moderate match - feature somewhat relates but might be a stretch
- **0.4-0.6**: Weak match - feature only tangentially related
- **0.0-0.4**: Poor match - feature doesn't belong to this theme

Be strict and honest. It's better to reject a mismatch than to incorrectly categorize a feature."""

            user_prompt = f"""**Feature to Validate:**
Title: {feature_title}
Description: {feature_description}

**Suggested Theme:**
{suggested_theme}: {theme_description}

Does this feature truly belong to the "{suggested_theme}" theme?

Return your analysis as JSON:
{{
  "confidence": <float 0.0-1.0>,
  "reasoning": "<explain why this feature does or doesn't fit the theme>"
}}"""

            # Call OpenAI API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            confidence = float(result.get("confidence", 0.0))
            reasoning = result.get("reasoning", "No reasoning provided")

            logger.info(f"Theme validation for '{feature_title}' → '{suggested_theme}': {confidence:.2f}")

            return {
                "is_valid": confidence >= 0.8,
                "confidence": confidence,
                "reasoning": reasoning
            }

        except Exception as e:
            logger.error(f"Error validating theme assignment: {e}")
            return {
                "is_valid": False,
                "confidence": 0.0,
                "reasoning": f"Validation error: {str(e)}"
            }

    def _no_match_result(self, reason: str) -> Dict[str, Any]:
        """Return a default no-match result when errors occur"""
        return {
            "is_duplicate": False,
            "matching_feature_id": None,
            "confidence": 0.0,
            "reasoning": reason
        }

    def batch_match_features(
        self,
        new_features: List[Dict[str, str]],
        existing_features: List[Dict[str, str]],
        confidence_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Match multiple new features against existing features

        Args:
            new_features: List of dicts with 'title' and 'description'
            existing_features: List of dicts with 'id', 'name', 'description'
            confidence_threshold: Minimum confidence to consider a match

        Returns:
            List of match results, one per new feature
        """
        results = []
        for new_feature in new_features:
            match_result = self.find_matching_feature(
                new_feature=new_feature,
                existing_features=existing_features,
                confidence_threshold=confidence_threshold
            )
            results.append({
                "new_feature": new_feature,
                "match_result": match_result
            })
        return results


# Global service instance
_ai_matching_service: Optional[AIFeatureMatchingService] = None


def get_ai_feature_matching_service() -> AIFeatureMatchingService:
    """
    Get or create the global AI feature matching service instance

    Returns:
        AIFeatureMatchingService instance
    """
    global _ai_matching_service
    if _ai_matching_service is None:
        _ai_matching_service = AIFeatureMatchingService()
    return _ai_matching_service

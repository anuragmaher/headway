"""
AI Pipeline Prompt Templates

Centralized prompt templates for the tiered AI processing pipeline.
Version-controlled for A/B testing and auditing.
"""

from typing import Optional, Dict, Any, List

# Prompt versions for tracking
TIER1_PROMPT_VERSION = "v1.0.0"
TIER2_PROMPT_VERSION = "v1.0.0"
AGGREGATION_PROMPT_VERSION = "v1.0.0"


# =============================================================================
# TIER 1: Classification Prompt
# Purpose: Quick determination of whether content contains feature requests
# Model: gpt-4o-mini (cheap and fast)
# Expected output: JSON with is_feature_request (bool) and confidence (float)
# =============================================================================

TIER1_SYSTEM_PROMPT = """You are a classification AI for a product intelligence platform.

Your ONLY task is to determine whether the given text contains any feature requests, product feedback, or enhancement suggestions.

IMPORTANT DEFINITIONS:
- Feature Request: A specific request for NEW functionality that doesn't currently exist
- Product Feedback: Comments about existing features that suggest improvements
- Enhancement Suggestion: Ideas for making existing features better

DO NOT classify as feature requests:
- Questions about how to use existing features
- Pricing or billing inquiries
- General complaints without specific suggestions
- Bug reports (broken functionality)
- Support requests
- Greetings or small talk

Respond with ONLY a JSON object, nothing else."""

TIER1_USER_PROMPT_TEMPLATE = """Analyze this text and determine if it contains any feature requests or product feedback.

SOURCE TYPE: {source_type}
ACTOR ROLE: {actor_role}

TEXT:
{text}

Respond with this exact JSON structure:
{{
  "is_feature_request": true or false,
  "confidence": 0.0 to 1.0,
  "reasoning": "One sentence explaining your classification"
}}"""


# =============================================================================
# TIER 2: Structured Extraction Prompt
# Purpose: Extract detailed feature request information
# Model: gpt-4o-mini
# Expected output: Strict JSON schema with feature details
# =============================================================================

TIER2_SYSTEM_PROMPT = """You are a feature extraction AI for a product intelligence platform.

Your task is to extract structured feature request data from text that has already been classified as containing feature requests.

For each feature request found, extract:
1. TITLE: A clear, concise title (5-10 words)
2. PROBLEM: What problem is the user facing?
3. DESIRED_OUTCOME: What do they want to achieve?
4. USER_ROLE: Who is making the request? (admin, end-user, manager, developer, etc.)
5. URGENCY: How urgent is this? (low, medium, high, critical)
6. SENTIMENT: User's emotional state (positive, neutral, negative, frustrated)
7. QUOTE: Exact quote from the text supporting this feature request

IMPORTANT RULES:
- Extract ONLY explicit feature requests, not implied ones
- Be specific in titles - avoid generic phrases like "improve X"
- If user role is not clear, use "unknown"
- Only use "critical" urgency if explicitly indicated (blocker, dealbreaker, etc.)
- Quote should be the exact text, not paraphrased

Respond with ONLY a JSON object, nothing else."""

TIER2_USER_PROMPT_TEMPLATE = """Extract feature request details from this text.

SOURCE TYPE: {source_type}
ACTOR: {actor_name} ({actor_role})
TITLE/SUBJECT: {title}

TEXT:
{text}

ADDITIONAL CONTEXT:
{metadata}

Respond with this exact JSON structure:
{{
  "feature_request": {{
    "title": "Clear feature title (5-10 words)",
    "description": "Detailed description of the feature",
    "problem_statement": "What problem the user is facing",
    "desired_outcome": "What they want to achieve",
    "user_persona": "admin|end-user|manager|developer|customer|unknown",
    "use_case": "Brief use case description",
    "priority": "low|medium|high|critical",
    "urgency": "low|medium|high|critical",
    "sentiment": "positive|neutral|negative|frustrated",
    "keywords": ["relevant", "keywords", "list"]
  }},
  "confidence": 0.0 to 1.0
}}

If no valid feature request is found, return:
{{
  "feature_request": {{
    "title": "No Feature Request Found",
    "description": null
  }},
  "confidence": 0.0
}}"""


# =============================================================================
# TIER 2: Theme Classification Prompt (optional, if themes are defined)
# =============================================================================

TIER2_THEME_PROMPT_TEMPLATE = """Based on this feature request, suggest the most appropriate theme.

FEATURE:
Title: {feature_title}
Description: {feature_description}
Problem: {problem_statement}

AVAILABLE THEMES:
{themes_list}

Respond with this exact JSON structure:
{{
  "suggested_theme": "Theme name from the list above",
  "confidence": 0.0 to 1.0,
  "reasoning": "Why this theme is the best fit"
}}

If no theme fits well, use "Uncategorized"."""


# =============================================================================
# TIER 3: Aggregation/Deduplication Prompt
# Purpose: Determine if a new fact should merge with existing features
# Model: gpt-4o-mini
# =============================================================================

AGGREGATION_SYSTEM_PROMPT = """You are a deduplication AI for a product intelligence platform.

Your task is to determine if a newly extracted feature request should be merged with an existing feature or created as a new one.

Consider:
1. SEMANTIC SIMILARITY: Are they asking for the same thing in different words?
2. CORE FUNCTIONALITY: Would building one satisfy the other?
3. SCOPE: Is one a subset/superset of the other?

BE CONSERVATIVE: Only merge if there is HIGH confidence (>80%) they are truly the same request. Different features should remain separate.

Respond with ONLY a JSON object, nothing else."""

AGGREGATION_USER_PROMPT_TEMPLATE = """Determine if this new feature request matches any existing features.

NEW FEATURE REQUEST:
Title: {new_title}
Description: {new_description}
Problem: {new_problem}

EXISTING FEATURES IN SAME THEME:
{existing_features}

Respond with this exact JSON structure:
{{
  "should_merge": true or false,
  "matching_feature_id": "UUID of matching feature or null",
  "confidence": 0.0 to 1.0,
  "reasoning": "Explanation of your decision"
}}"""


# =============================================================================
# Helper functions for prompt building
# =============================================================================

def build_tier1_prompt(
    text: str,
    source_type: str = "unknown",
    actor_role: Optional[str] = None,
) -> tuple:
    """Build Tier-1 classification prompt."""
    return (
        TIER1_SYSTEM_PROMPT,
        TIER1_USER_PROMPT_TEMPLATE.format(
            text=text[:4000],  # Limit to 4000 chars
            source_type=source_type,
            actor_role=actor_role or "unknown",
        )
    )


def build_tier2_prompt(
    text: str,
    source_type: str,
    actor_name: str = "Unknown",
    actor_role: str = "unknown",
    title: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> tuple:
    """Build Tier-2 extraction prompt."""
    # Format metadata for the prompt
    metadata_str = "None"
    if metadata:
        meta_items = []
        for key, value in metadata.items():
            if value and key not in ("raw_message", "html_content"):
                meta_items.append(f"- {key}: {value}")
        metadata_str = "\n".join(meta_items[:10]) if meta_items else "None"

    return (
        TIER2_SYSTEM_PROMPT,
        TIER2_USER_PROMPT_TEMPLATE.format(
            text=text[:6000],  # Slightly larger limit for extraction
            source_type=source_type,
            actor_name=actor_name,
            actor_role=actor_role,
            title=title or "N/A",
            metadata=metadata_str,
        )
    )


def build_theme_prompt(
    feature_title: str,
    feature_description: str,
    problem_statement: str,
    themes: List[Dict[str, Any]]
) -> tuple:
    """Build theme classification prompt."""
    themes_list = "\n".join([
        f"- {theme['name']}: {theme.get('description', 'No description')}"
        for theme in themes
    ])

    return (
        "You are a theme classification AI. Match features to the most appropriate theme.",
        TIER2_THEME_PROMPT_TEMPLATE.format(
            feature_title=feature_title,
            feature_description=feature_description or "No description",
            problem_statement=problem_statement or "No problem statement",
            themes_list=themes_list
        )
    )


def build_aggregation_prompt(
    new_title: str,
    new_description: str,
    new_problem: str,
    existing_features: List[Dict[str, Any]]
) -> tuple:
    """Build aggregation/deduplication prompt."""
    features_text = "\n".join([
        f"- ID: {f['id']}\n  Title: {f['name']}\n  Description: {f.get('description', 'N/A')[:200]}"
        for f in existing_features[:10]  # Limit to 10 features
    ])

    if not features_text:
        features_text = "No existing features in this theme."

    return (
        AGGREGATION_SYSTEM_PROMPT,
        AGGREGATION_USER_PROMPT_TEMPLATE.format(
            new_title=new_title,
            new_description=new_description or "No description",
            new_problem=new_problem or "No problem statement",
            existing_features=features_text
        )
    )

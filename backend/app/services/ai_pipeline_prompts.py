"""
AI Pipeline Prompt Templates

Centralized prompt templates for the tiered AI processing pipeline.
Version-controlled for A/B testing and auditing.
"""

from typing import Optional, Dict, Any, List

# Prompt versions for tracking - bump when prompts change
TIER1_PROMPT_VERSION = "v2.0.0"  # Changed to score-based (0-10) instead of boolean
TIER2_PROMPT_VERSION = "v2.0.0"  # Changed to include theme assignment and feature matching
AGGREGATION_PROMPT_VERSION = "v1.0.0"


# =============================================================================
# TIER 1: Classification Prompt
# Purpose: Quick scoring of whether content contains feature requests
# Model: gpt-4o-mini (cheap and fast)
# Expected output: JSON with score (0-10) - proceed to extraction if score >= 6
# =============================================================================

TIER1_SYSTEM_PROMPT = """You are a classification AI for a product intelligence platform.

Your task is to score how likely the given text contains feature requests, product feedback, or enhancement suggestions.

WHAT TO LOOK FOR:
- Feature Request: A request for NEW functionality (e.g., "I wish we could...", "Can you add...", "We need...")
- Product Feedback: Comments suggesting improvements to existing features
- Enhancement Suggestion: Ideas for making features better
- Pain points that imply a need for new/improved functionality

SCORING GUIDE (0-10):
- 0-2: No feature-related content (greetings, support questions, billing inquiries, general chat)
- 3-5: Some discussion of features/functionality but no clear request or suggestion
- 6-7: Contains implicit feedback or suggestions that could inform product decisions
- 8-10: Contains explicit feature requests or clear product improvement suggestions

Be INCLUSIVE - if the text mentions any pain points, wishes, needs, or suggestions related to product functionality, give it a score of 6 or higher to ensure it gets further analysis.

Respond with ONLY a JSON object, nothing else."""

TIER1_USER_PROMPT_TEMPLATE = """Score this text for feature request relevance.

SOURCE TYPE: {source_type}
ACTOR ROLE: {actor_role}

TEXT:
{text}

Respond with this exact JSON structure:
{{
  "score": 0 to 10,
  "reasoning": "Brief explanation of the score"
}}"""


# =============================================================================
# TIER 2: Structured Extraction Prompt
# Purpose: Extract feature request, assign to theme, and match with existing features
# Model: gpt-4o-mini
# Expected output: JSON with feature details, theme assignment, and feature match
# =============================================================================

TIER2_SYSTEM_PROMPT = """You are a feature extraction AI for a product intelligence platform.

Your task is to:
1. Extract structured feature request data from text
2. Assign the request to the MOST appropriate theme (REQUIRED)
3. Match with an existing feature if one exists, or indicate a new feature should be created

FEATURE EXTRACTION:
- Extract ONLY explicit feature requests from the text
- Be SPECIFIC in titles - "Add CSV export for reports" NOT "Improve exports"
- If no clear feature request exists, return confidence: 0.0

THEME ASSIGNMENT (REQUIRED):
- You MUST assign every feature request to exactly ONE theme
- Choose the theme that BEST matches the feature's primary functionality
- Match based on the core purpose of the feature, not surface keywords

FEATURE MATCHING:
- Check if the extracted feature matches any EXISTING feature in the list
- Match if they describe the SAME capability (even if worded differently)
- If matched: return the existing feature's ID - this will increment its mention count
- If no match: indicate a new feature should be created

Respond with ONLY a JSON object, nothing else."""

TIER2_USER_PROMPT_TEMPLATE = """Extract feature request, assign theme, and check for existing feature match.

SOURCE TYPE: {source_type}
ACTOR: {actor_name} ({actor_role})
TITLE/SUBJECT: {title}

TEXT:
{text}

AVAILABLE THEMES:
{themes_list}

EXISTING FEATURES:
{features_list}

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
  "theme_assignment": {{
    "theme_name": "Name of the assigned theme from the list",
    "confidence": 0.0 to 1.0,
    "reasoning": "Why this theme fits best"
  }},
  "feature_match": {{
    "matched": true or false,
    "existing_feature_id": "UUID of matched feature or null",
    "existing_feature_name": "Name of matched feature or null",
    "match_confidence": 0.0 to 1.0,
    "reasoning": "Why this matches (or why no match)"
  }},
  "confidence": 0.0 to 1.0
}}

If no valid feature request is found, return:
{{
  "feature_request": null,
  "feature_match": null,
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

THEME MATCHING RULES - BE STRICT:
1. The feature must DIRECTLY relate to the theme's core purpose
2. Do NOT match based on tangential keyword overlap
3. Consider what PRODUCT AREA the feature belongs to, not surface-level word matches
4. If the feature is about "AI" but the request is for analytics, use Analytics theme not AI theme
5. Match based on the PRIMARY functionality being requested

EXAMPLES OF CORRECT MATCHING:
- "Export data to CSV" -> Data/Reporting theme (NOT Integrations, even if it mentions "export")
- "Connect to Salesforce" -> Integrations theme
- "Show dashboard charts" -> Analytics/Dashboard theme
- "AI-powered suggestions" -> AI Features theme (only if asking for AI capability)

Respond with this exact JSON structure:
{{
  "suggested_theme": "Theme name from the list above",
  "confidence": 0.0 to 1.0,
  "reasoning": "Specific reason why this theme matches the feature's CORE functionality"
}}
"""


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
    """Build Tier-1 scoring prompt. Returns score 0-10."""
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
    themes: Optional[List[Dict[str, Any]]] = None,
    existing_features: Optional[List[Dict[str, Any]]] = None,
) -> tuple:
    """Build Tier-2 extraction prompt with themes and existing features."""
    # Format themes list
    themes_list = "No themes defined"
    if themes:
        themes_list = "\n".join([
            f"- {theme['name']}: {theme.get('description', 'No description')}"
            for theme in themes
        ])

    # Format existing features list
    features_list = "No existing features"
    if existing_features:
        features_list = "\n".join([
            f"- ID: {f['id']} | Name: {f['name']} | Theme: {f.get('theme_name', 'Uncategorized')}"
            for f in existing_features[:30]  # Limit to 30 features to avoid token limits
        ])

    return (
        TIER2_SYSTEM_PROMPT,
        TIER2_USER_PROMPT_TEMPLATE.format(
            text=text[:5000],  # Limit text to leave room for themes/features
            source_type=source_type,
            actor_name=actor_name,
            actor_role=actor_role,
            title=title or "N/A",
            themes_list=themes_list,
            features_list=features_list,
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

#!/usr/bin/env python3
"""
Classify features from AI insights into themes
Runs as a background script
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.theme import Theme
from app.models.feature import Feature
from app.models.message import Message
from app.core.config import settings
from openai import OpenAI
from datetime import datetime
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def find_duplicate_feature(
    feature_title: str,
    feature_description: str,
    existing_features: list,
    client: OpenAI
) -> str | None:
    """
    Use OpenAI to check if this feature is a duplicate of any existing features.
    Returns the ID of the duplicate feature, or None if no match.
    """
    if not existing_features:
        return None

    try:
        # Build list of existing features
        features_list = "\n".join([
            f"- {feat['name']}: {feat['description'][:200]} (ID: {feat['id']})"
            for feat in existing_features
        ])

        prompt = f"""You are checking if a new feature request is a duplicate of existing features.

New Feature:
Title: {feature_title}
Description: {feature_description}

Existing Features in this theme:
{features_list}

Return ONLY a JSON object:
{{
  "is_duplicate": true/false,
  "duplicate_feature_id": "ID if duplicate, null otherwise",
  "reasoning": "brief explanation"
}}

Consider features duplicates if they request the same core functionality, even if worded differently.
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at identifying duplicate feature requests."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)

        if result.get('is_duplicate') and result.get('duplicate_feature_id'):
            logger.info(f"Found duplicate: {feature_title} matches existing feature {result['duplicate_feature_id']}")
            return result['duplicate_feature_id']

        return None

    except Exception as e:
        logger.error(f"Error checking for duplicate: {e}")
        return None


def classify_feature_to_theme(
    feature_title: str,
    feature_description: str,
    theme_list: list,
    unclassified_theme_id: str,
    client: OpenAI
) -> str:
    """
    Use OpenAI to classify a feature into the best matching theme.
    Returns theme_id or unclassified_theme_id if no match.
    """
    try:
        # Build theme options
        theme_options = "\n".join([
            f"- {theme['name']}: {theme['description']} (ID: {theme['id']})"
            for theme in theme_list
        ])

        prompt = f"""You are classifying a feature request into the most appropriate theme.

Feature:
Title: {feature_title}
Description: {feature_description}

Available Themes:
{theme_options}

Return ONLY a JSON object with this format:
{{
  "theme_id": "the matching theme ID or null if no good match",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}}

If the feature doesn't clearly fit any theme, return theme_id as null.
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a product manager classifying feature requests into themes."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200,
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)

        theme_id = result.get('theme_id')
        confidence = result.get('confidence', 'low')
        reasoning = result.get('reasoning', '')

        # Only use the theme if confidence is medium or high
        if theme_id and confidence in ['medium', 'high']:
            logger.info(f"Classified '{feature_title}' to theme {theme_id} ({confidence} confidence)")
            return theme_id
        else:
            logger.info(f"No good match for '{feature_title}', using Unclassified. Reason: {reasoning}")
            return unclassified_theme_id

    except Exception as e:
        logger.error(f"Error classifying feature to theme: {e}")
        return unclassified_theme_id


def classify_features(workspace_id: str):
    """
    Main function to classify features from AI insights
    """
    db = next(get_db())

    try:
        logger.info("=" * 80)
        logger.info("STARTING FEATURE CLASSIFICATION")
        logger.info("=" * 80)

        # 1. Get or create "Unclassified" default theme
        logger.info("\n1. Getting or creating 'Unclassified' theme...")
        unclassified_theme = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.is_default == True
        ).first()

        if not unclassified_theme:
            unclassified_theme = Theme(
                workspace_id=workspace_id,
                name="Unclassified",
                description="Features that haven't been categorized yet",
                color="#9e9e9e",  # Gray color
                icon="HelpOutlineIcon",
                is_default=True,
                sort_order=9999  # Put at the end
            )
            db.add(unclassified_theme)
            db.flush()
            logger.info(f"✅ Created 'Unclassified' default theme")
        else:
            logger.info(f"✅ Using existing 'Unclassified' theme: {unclassified_theme.id}")

        # 2. Get all existing themes (excluding Unclassified) for classification
        logger.info("\n2. Loading existing themes...")
        existing_themes = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.is_default == False
        ).all()

        theme_list = [
            {"id": str(theme.id), "name": theme.name, "description": theme.description}
            for theme in existing_themes
        ]

        logger.info(f"✅ Found {len(theme_list)} themes for classification")
        for theme in theme_list:
            logger.info(f"   - {theme['name']}")

        # 3. Get all messages with ai_insights
        logger.info("\n3. Loading messages with AI insights...")
        messages = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.ai_insights.isnot(None)
        ).all()

        if not messages:
            logger.warning("❌ No messages with AI insights found")
            return

        logger.info(f"✅ Found {len(messages)} messages")

        # Create OpenAI client once
        if not settings.OPENAI_API_KEY:
            logger.error("❌ OpenAI API key not configured")
            return

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        features_created = 0
        features_classified = 0
        unclassified_count = 0
        duplicates_updated = 0

        # 4. Process each message
        logger.info("\n4. Processing feature requests with intelligent deduplication...")
        for msg_idx, msg in enumerate(messages, 1):
            ai_insights = msg.ai_insights
            if not ai_insights:
                continue

            feature_requests = ai_insights.get('feature_requests', [])

            for feature_data in feature_requests:
                title = feature_data.get('title', 'Untitled Feature')
                description = feature_data.get('description', '')
                urgency = feature_data.get('urgency', 'medium')
                quote = feature_data.get('quote', '')

                # Step 1: Classify into theme first
                theme_id = None
                is_unclassified = False
                if theme_list:
                    theme_id = classify_feature_to_theme(
                        title, description, theme_list, str(unclassified_theme.id), client
                    )
                    is_unclassified = (theme_id == str(unclassified_theme.id))
                else:
                    # No themes available, use Unclassified
                    theme_id = str(unclassified_theme.id)
                    is_unclassified = True

                # Step 2: Get all existing features in this theme
                existing_features_in_theme = db.query(Feature).filter(
                    Feature.workspace_id == workspace_id,
                    Feature.theme_id == theme_id
                ).all()

                existing_features_list = [
                    {
                        "id": str(feat.id),
                        "name": feat.name,
                        "description": feat.description or ""
                    }
                    for feat in existing_features_in_theme
                ]

                # Step 3: Use AI to check for semantic duplicates within this theme
                duplicate_feature_id = find_duplicate_feature(
                    title, description, existing_features_list, client
                )

                if duplicate_feature_id:
                    # Found a duplicate - update that feature's mention count
                    existing_feature = db.query(Feature).filter(
                        Feature.id == duplicate_feature_id
                    ).first()

                    if existing_feature:
                        existing_feature.mention_count += 1
                        existing_feature.last_mentioned = datetime.utcnow()
                        # Add message association if not exists
                        if msg not in existing_feature.messages:
                            existing_feature.messages.append(msg)
                        duplicates_updated += 1
                        logger.info(f"   [{msg_idx}/{len(messages)}] 🔄 Merged duplicate: '{title}' → '{existing_feature.name}' (mentions: {existing_feature.mention_count})")
                        continue

                # Step 4: Create new feature (no duplicate found)
                new_feature = Feature(
                    workspace_id=workspace_id,
                    name=title,
                    description=f"{description}\n\nQuote: \"{quote}\"",
                    urgency=urgency,
                    status="new",
                    theme_id=theme_id,
                    mention_count=1,
                    first_mentioned=datetime.utcnow(),
                    last_mentioned=datetime.utcnow()
                )

                db.add(new_feature)
                db.flush()

                # Add message association
                new_feature.messages.append(msg)
                features_created += 1

                # Count classification stats
                if is_unclassified:
                    unclassified_count += 1
                else:
                    features_classified += 1

                # Find theme name for logging
                theme_name = "Unclassified" if is_unclassified else None
                if not theme_name:
                    for theme in theme_list:
                        if theme['id'] == theme_id:
                            theme_name = theme['name']
                            break

                logger.info(f"   [{msg_idx}/{len(messages)}] ✨ Created: {title} → {theme_name or 'Unclassified'}")

        db.commit()

        # 5. Summary
        logger.info("\n" + "=" * 80)
        logger.info("CLASSIFICATION COMPLETE")
        logger.info("=" * 80)
        logger.info(f"✅ Features created: {features_created}")
        logger.info(f"✅ Features classified to themes: {features_classified}")
        logger.info(f"⚪ Features in Unclassified: {unclassified_count}")
        logger.info(f"🔄 Duplicate features updated: {duplicates_updated}")
        logger.info("=" * 80 + "\n")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error classifying features: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"
    classify_features(workspace_id)

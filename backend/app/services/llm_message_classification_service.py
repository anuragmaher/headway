import json
import logging
import os
from typing import List, Dict, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from openai import OpenAI

from app.core.database import get_db
from app.models.message import Message
from app.models.feature import Feature
from app.models.theme import Theme

logger = logging.getLogger(__name__)


class LLMMessageClassificationService:
    """LLM-based service for classifying messages into features"""

    def __init__(self):
        self.classification_cache = {}

        # Initialize OpenAI client
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            print("WARNING: OPENAI_API_KEY not set, using dummy client")
            self.client = None
        else:
            self.client = OpenAI(api_key=api_key)

    def classify_messages_to_features(
        self,
        workspace_id: str,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Classify messages using LLM to determine feature assignment

        Args:
            workspace_id: ID of the workspace to process
            limit: Optional limit on number of messages to process

        Returns:
            Dictionary with classification results
        """
        db = next(get_db())
        try:
            logger.info(f"Starting LLM-based message classification for workspace {workspace_id}")

            # Get messages to classify
            messages = self._get_messages_for_classification(db, workspace_id, limit)
            if not messages:
                logger.warning(f"No messages found for classification in workspace {workspace_id}")
                return {
                    "status": "no_messages",
                    "message": "No messages available for classification",
                    "features_created": 0
                }

            # Get existing features
            existing_features = self._get_existing_features(db, workspace_id)

            # Classify messages using LLM
            results = self._classify_messages_with_llm(messages, existing_features, workspace_id, db)

            db.commit()

            logger.info(f"LLM classification complete: {results['features_created']} features affected")

            return results

        except Exception as e:
            logger.error(f"Error in LLM message classification: {e}")
            db.rollback()
            raise
        finally:
            db.close()

    def _get_messages_for_classification(
        self,
        db: Session,
        workspace_id: str,
        limit: Optional[int] = None
    ) -> List[Message]:
        """Get messages that need classification"""
        query = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.content.isnot(None),
            Message.content != ""
        ).order_by(Message.sent_at.desc())

        if limit:
            query = query.limit(limit)

        return query.all()

    def _get_existing_features(self, db: Session, workspace_id: str) -> List[Feature]:
        """Get all existing features for the workspace"""
        return db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).all()

    def _classify_messages_with_llm(
        self,
        messages: List[Message],
        existing_features: List[Feature],
        workspace_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """Use LLM to classify messages into features"""

        # Process messages in batches for efficiency
        batch_size = 10
        features_created = []
        features_updated = []
        total_processed = 0

        for i in range(0, len(messages), batch_size):
            batch = messages[i:i + batch_size]

            # Create the LLM prompt
            prompt = self._create_classification_prompt(batch, existing_features)

            try:
                # Skip if no client available
                if not self.client:
                    logger.warning("No LLM client available, skipping batch")
                    continue

                # Get LLM response
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    max_tokens=4000,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }]
                )

                # Parse LLM response
                classification_result = self._parse_llm_response(response.choices[0].message.content)

                # Apply classifications
                batch_results = self._apply_classifications(
                    batch, classification_result, existing_features, workspace_id, db
                )

                features_created.extend(batch_results.get('created', []))
                features_updated.extend(batch_results.get('updated', []))
                total_processed += len(batch)

                logger.info(f"Processed batch {i//batch_size + 1}: {len(batch)} messages")

            except Exception as e:
                logger.error(f"Error processing batch {i//batch_size + 1}: {e}")
                continue

        return {
            "status": "success",
            "messages_processed": total_processed,
            "features_created": len(features_created),
            "features_updated": len(features_updated),
            "created_features": features_created,
            "updated_features": features_updated
        }

    def _create_classification_prompt(
        self,
        messages: List[Message],
        existing_features: List[Feature]
    ) -> str:
        """Create the LLM prompt for message classification"""

        # Format existing features
        features_text = ""
        if existing_features:
            features_text = "EXISTING FEATURES:\n"
            for feature in existing_features:
                features_text += f"- ID: {feature.id}\n"
                features_text += f"  Name: {feature.name}\n"
                features_text += f"  Description: {feature.description}\n"
                features_text += f"  Theme: {feature.theme.name if feature.theme else 'None'}\n\n"
        else:
            features_text = "EXISTING FEATURES: None\n\n"

        # Format messages
        messages_text = "MESSAGES TO CLASSIFY:\n"
        for i, message in enumerate(messages):
            messages_text += f"Message {i+1}:\n"
            messages_text += f"Content: {message.content}\n"
            messages_text += f"Channel: {message.channel_name}\n"
            messages_text += f"Author: {message.author_name}\n"
            messages_text += f"Date: {message.sent_at}\n\n"

        prompt = f"""You are an expert at analyzing customer feedback and feature requests. Your task is to classify customer messages into product features.

{features_text}

{messages_text}

For each message, determine:
1. If it relates to an EXISTING feature (use the feature ID)
2. If it should create a NEW feature (provide name, description, theme, urgency)
3. If it's NOT a feature request (classify as "not_feature")

Guidelines:
- Features should be specific, actionable product capabilities
- Group similar requests into the same feature
- Use clear, descriptive feature names
- Themes: Design, Analytics, Security, Productivity, Integration, Performance, Mobile, Communication
- Urgency: low, medium, high, critical

Respond in JSON format:
{{
  "classifications": [
    {{
      "message_index": 1,
      "type": "existing_feature",
      "feature_id": "uuid-here"
    }},
    {{
      "message_index": 2,
      "type": "new_feature",
      "feature_name": "Feature Name",
      "feature_description": "Clear description",
      "theme": "Design",
      "urgency": "medium"
    }},
    {{
      "message_index": 3,
      "type": "not_feature"
    }}
  ]
}}"""

        return prompt

    def _parse_llm_response(self, response_text: str) -> Dict[str, Any]:
        """Parse the LLM response JSON"""
        try:
            # Extract JSON from response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1

            if start_idx == -1 or end_idx == 0:
                logger.error("No JSON found in LLM response")
                return {"classifications": []}

            json_text = response_text[start_idx:end_idx]
            return json.loads(json_text)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response JSON: {e}")
            return {"classifications": []}

    def _apply_classifications(
        self,
        messages: List[Message],
        classification_result: Dict[str, Any],
        existing_features: List[Feature],
        workspace_id: str,
        db: Session
    ) -> Dict[str, List]:
        """Apply the LLM classifications to create/update features"""

        created_features = []
        updated_features = []

        # Create feature lookup
        feature_lookup = {str(f.id): f for f in existing_features}

        for classification in classification_result.get("classifications", []):
            try:
                message_idx = classification.get("message_index", 1) - 1
                if message_idx >= len(messages):
                    continue

                message = messages[message_idx]
                class_type = classification.get("type")

                if class_type == "existing_feature":
                    # Link to existing feature
                    feature_id = classification.get("feature_id")
                    if feature_id in feature_lookup:
                        feature = feature_lookup[feature_id]
                        # Check if message is already linked to avoid duplicates
                        if message not in feature.messages:
                            feature.messages.append(message)
                            feature.mention_count += 1
                            feature.last_mentioned = message.sent_at
                            feature.updated_at = datetime.utcnow()
                            updated_features.append({
                                "id": str(feature.id),
                                "name": feature.name,
                                "action": "updated"
                            })

                elif class_type == "new_feature":
                    # Create new feature
                    feature_name = classification.get("feature_name")
                    feature_description = classification.get("feature_description")
                    theme_name = classification.get("theme", "Productivity")
                    urgency = classification.get("urgency", "medium")

                    if feature_name:
                        # Get or create theme
                        theme = self._get_or_create_theme(db, workspace_id, theme_name)

                        new_feature = Feature(
                            name=feature_name,
                            description=feature_description,
                            urgency=urgency,
                            status="new",
                            mention_count=1,
                            workspace_id=workspace_id,
                            theme_id=theme.id,
                            first_mentioned=message.sent_at,
                            last_mentioned=message.sent_at
                        )

                        db.add(new_feature)
                        db.flush()  # Get the ID

                        new_feature.messages.append(message)
                        feature_lookup[str(new_feature.id)] = new_feature

                        created_features.append({
                            "id": str(new_feature.id),
                            "name": new_feature.name,
                            "action": "created"
                        })

                # Skip "not_feature" messages

            except Exception as e:
                logger.error(f"Error applying classification: {e}")
                continue

        return {"created": created_features, "updated": updated_features}

    def _get_or_create_theme(self, db: Session, workspace_id: str, theme_name: str) -> Theme:
        """Get existing theme or create new one"""
        existing_theme = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.name == theme_name
        ).first()

        if existing_theme:
            return existing_theme

        new_theme = Theme(
            name=theme_name,
            description=f"Features related to {theme_name.lower()}",
            workspace_id=workspace_id
        )
        db.add(new_theme)
        db.flush()
        return new_theme


# Global service instance
try:
    llm_message_classification_service = LLMMessageClassificationService()
except Exception as e:
    print(f"Warning: Failed to initialize LLMMessageClassificationService: {e}")
    print("Message classification features will not be available until dependencies are fixed")
    llm_message_classification_service = None
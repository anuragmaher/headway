"""
Generic transcript ingestion and processing service

Handles AI-powered feature extraction and intelligent duplicate detection
for transcripts from any source (Gong, Fathom, Slack, etc).

This service is source-agnostic and can be reused across different integrations.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.feature import Feature
from app.models.theme import Theme
from app.services.ai_extraction_service import get_ai_extraction_service
from app.services.ai_feature_matching_service import get_ai_feature_matching_service

logger = logging.getLogger(__name__)


class TranscriptIngestionService:
    """
    Service for ingesting transcripts from any source and processing them
    through AI extraction and intelligent feature matching.

    This service is completely source-agnostic - it works the same way
    whether the transcript comes from Gong calls, Fathom sessions, or any other source.
    """

    def __init__(self, db: Session):
        """
        Initialize the ingestion service

        Args:
            db: SQLAlchemy database session
        """
        self.db = db
        self.ai_extraction_service = get_ai_extraction_service()
        self.ai_feature_matching_service = get_ai_feature_matching_service()

    def ingest_transcript(
        self,
        workspace_id: str,
        external_id: str,
        transcript_text: str,
        source: str,
        metadata: Dict[str, Any],
        channel_name: str = "Default",
        channel_id: str = "default",
        author_name: Optional[str] = None,
        author_email: Optional[str] = None,
        author_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        sent_at: Optional[datetime] = None,
        integration_id: Optional[str] = None,
        extract_features: bool = True
    ) -> Optional[str]:
        """
        Ingest a transcript and process it through AI extraction and feature matching

        Args:
            workspace_id: Workspace UUID
            external_id: ID from source system (Gong call ID, Fathom session ID, etc)
            transcript_text: The conversation transcript text
            source: Source type ("gong", "fathom", "slack", etc)
            metadata: Source-specific metadata to store
            channel_name: Channel/source display name
            channel_id: Channel identifier
            author_name: Name of message author
            author_email: Email of author
            author_id: ID of author in source system
            customer_id: Optional customer ID to link
            sent_at: When the transcript was created
            integration_id: Integration record ID
            extract_features: Whether to run AI extraction

        Returns:
            Message ID if successful, None if failed or skipped
        """
        try:
            # Check if message already exists
            existing_message = self.db.query(Message).filter(
                Message.external_id == external_id,
                Message.source == source,
                Message.workspace_id == workspace_id
            ).first()

            if existing_message:
                logger.info(f"Skipping {source} {external_id} (already ingested)")
                return None

            # Set defaults
            if sent_at is None:
                sent_at = datetime.now(timezone.utc)

            # Extract features and insights using AI
            ai_insights = None
            if extract_features and transcript_text:
                try:
                    logger.info(f"Extracting features from {source} {external_id}")

                    # Get customer context if available
                    customer_name = None
                    customer_mrr = None

                    if customer_id:
                        from app.models.customer import Customer
                        customer = self.db.query(Customer).filter(
                            Customer.id == customer_id
                        ).first()
                        if customer:
                            customer_name = customer.name
                            customer_mrr = customer.mrr

                    # Get themes for context-aware extraction
                    themes = self.db.query(Theme).filter(
                        Theme.workspace_id == workspace_id,
                        Theme.is_default == False  # Exclude "Unclassified" theme
                    ).all()

                    themes_list = [
                        {"name": theme.name, "description": theme.description}
                        for theme in themes
                    ]

                    # Extract insights
                    ai_insights = self.ai_extraction_service.extract_insights(
                        transcript=transcript_text,
                        customer_name=customer_name,
                        customer_mrr=customer_mrr,
                        themes=themes_list if themes_list else None
                    )

                    logger.info(
                        f"Extracted {len(ai_insights.get('feature_requests', []))} features, "
                        f"{len(ai_insights.get('bug_reports', []))} bugs"
                    )

                except Exception as e:
                    logger.warning(f"Failed to extract AI insights: {e}")
                    ai_insights = None

            # Create message object
            message = Message(
                external_id=external_id,
                content=transcript_text,  # Store full transcript as content
                source=source,
                channel_name=channel_name,
                channel_id=channel_id,
                author_name=author_name or "Unknown",
                author_id=author_id,
                author_email=author_email,
                customer_id=customer_id,
                message_metadata=metadata,
                ai_insights=ai_insights,
                workspace_id=workspace_id,
                integration_id=integration_id,
                sent_at=sent_at,
                is_processed=False,
                thread_id=None,
                is_thread_reply=False
            )

            self.db.add(message)
            self.db.commit()  # Commit message first to get ID

            logger.info(f"Ingested {source} message: {external_id}")

            # Create features from AI insights
            if ai_insights and 'feature_requests' in ai_insights:
                self._create_features_from_insights(
                    workspace_id=workspace_id,
                    message=message,
                    ai_insights=ai_insights
                )

            # Mark message as processed
            message.is_processed = True
            message.processed_at = datetime.now(timezone.utc)
            self.db.commit()

            return str(message.id)

        except Exception as e:
            logger.error(f"Error ingesting {source} transcript {external_id}: {e}")
            self.db.rollback()
            return None

    def _create_features_from_insights(
        self,
        workspace_id: str,
        message: Message,
        ai_insights: Dict[str, Any]
    ) -> None:
        """
        Create features from AI insights and handle intelligent matching

        Args:
            workspace_id: Workspace UUID
            message: Message object the features came from
            ai_insights: AI extraction results
        """
        try:
            feature_requests = ai_insights.get('feature_requests', [])

            if not feature_requests:
                return

            # Get themes for matching
            themes = self.db.query(Theme).filter(
                Theme.workspace_id == workspace_id
            ).all()

            themes_dict = {theme.name.lower(): theme for theme in themes}

            features_created_count = 0
            features_matched_count = 0

            for feature_data in feature_requests:
                feature_title = feature_data.get('title', '').strip()
                feature_description = feature_data.get('description', '').strip()
                feature_theme = feature_data.get('theme', 'Uncategorized')
                feature_urgency = feature_data.get('urgency', 'medium')

                if not feature_title:
                    continue

                # Find matching theme
                feature_theme_obj = themes_dict.get(feature_theme.lower()) if feature_theme else None

                # Validate theme assignment
                if feature_theme_obj:
                    theme_validation = self.ai_feature_matching_service.validate_theme_assignment(
                        feature_title=feature_title,
                        feature_description=feature_description,
                        suggested_theme=feature_theme_obj.name,
                        theme_description=feature_theme_obj.description or ""
                    )

                    if not theme_validation["is_valid"]:
                        logger.info(
                            f"  ✗ Skipping feature '{feature_title}' - theme validation failed "
                            f"(confidence: {theme_validation['confidence']:.2f} < 0.8). "
                            f"Reason: {theme_validation['reasoning']}"
                        )
                        continue
                    else:
                        logger.info(
                            f"  ✓ Theme validated: '{feature_title}' → '{feature_theme_obj.name}' "
                            f"(confidence: {theme_validation['confidence']:.2f})"
                        )
                else:
                    # No theme found - skip this feature
                    logger.info(
                        f"  ✗ Skipping feature '{feature_title}' - no matching theme found "
                        f"(suggested theme: '{feature_theme}')"
                    )
                    continue

                # Get all existing features in the same theme
                existing_features_in_theme = self.db.query(Feature).filter(
                    Feature.workspace_id == workspace_id,
                    Feature.theme_id == feature_theme_obj.id
                ).all()

                # Prepare data for LLM matching
                existing_features_data = [
                    {
                        "id": str(f.id),
                        "name": f.name,
                        "description": f.description or ""
                    }
                    for f in existing_features_in_theme
                ]

                # Use LLM to find matching feature
                match_result = self.ai_feature_matching_service.find_matching_feature(
                    new_feature={
                        "title": feature_title,
                        "description": feature_description
                    },
                    existing_features=existing_features_data,
                    confidence_threshold=0.7
                )

                if match_result["is_duplicate"]:
                    # Link message to existing feature
                    existing_feature = self.db.query(Feature).filter(
                        Feature.id == match_result["matching_feature_id"]
                    ).first()

                    if existing_feature:
                        # Add message to feature's messages (many-to-many)
                        if message not in existing_feature.messages:
                            existing_feature.messages.append(message)
                            existing_feature.mention_count = len(existing_feature.messages)
                            existing_feature.last_mentioned = message.sent_at
                            existing_feature.updated_at = datetime.now(timezone.utc)

                        features_matched_count += 1
                        logger.info(
                            f"  ✓ Matched to existing: '{existing_feature.name}' "
                            f"(confidence: {match_result['confidence']:.2f}) - {match_result['reasoning']}"
                        )
                    else:
                        logger.warning(
                            f"Matching feature {match_result['matching_feature_id']} not found, creating new"
                        )
                        # Fall through to create new feature
                        match_result["is_duplicate"] = False

                if not match_result["is_duplicate"]:
                    # Create new feature
                    new_feature = Feature(
                        name=feature_title,
                        description=feature_description,
                        workspace_id=workspace_id,
                        theme_id=feature_theme_obj.id if feature_theme_obj else None,
                        status='new',
                        urgency=feature_urgency,
                        mention_count=1,
                        first_mentioned=message.sent_at,
                        last_mentioned=message.sent_at
                    )

                    self.db.add(new_feature)
                    self.db.flush()  # Get the ID

                    # Link message to new feature
                    new_feature.messages.append(message)

                    features_created_count += 1
                    logger.info(
                        f"  ✓ Created new: '{feature_title}' "
                        f"(confidence it's unique: {1.0 - match_result['confidence']:.2f})"
                    )

            # Commit all feature changes
            if features_created_count > 0 or features_matched_count > 0:
                self.db.commit()
                logger.info(
                    f"  → Created {features_created_count} new features, "
                    f"matched {features_matched_count} to existing features"
                )

        except Exception as e:
            logger.error(f"Error creating features from insights: {e}")
            self.db.rollback()


def get_transcript_ingestion_service(db: Session) -> TranscriptIngestionService:
    """Factory function to get TranscriptIngestionService instance"""
    return TranscriptIngestionService(db)

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.message import Message
from app.models.feature import Feature
from app.models.theme import Theme
from app.models.workspace_data_point import WorkspaceDataPoint
from app.services.ai_processing_service import ai_processing_service
from app.core.database import get_db

logger = logging.getLogger(__name__)


class MessageProcessingWithStorageService:
    """
    Service for processing messages with AI and saving results to database
    """

    def __init__(self):
        self.ai_service = ai_processing_service

    def process_and_save_message(
        self,
        message: Message,
        workspace_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Process a message with AI and save the results to database

        Args:
            message: Message to process
            workspace_id: Workspace ID
            db: Database session

        Returns:
            Processing result with database IDs
        """
        try:
            logger.info(f"Processing and saving message {message.id}")

            # Step 1: Process message with AI
            ai_result = self.ai_service.process_message(message, workspace_id=workspace_id)

            if not ai_result.get('is_feature_request', False):
                logger.info(f"Message {message.id} is not a feature request")
                return {
                    "status": "not_feature_request",
                    "message_id": str(message.id),
                    "ai_result": ai_result
                }

            # Step 2: Get or create theme
            theme = None
            theme_name = ai_result.get('theme')
            if theme_name:
                theme = self._get_or_create_theme(db, workspace_id, theme_name)

            # Step 3: Find existing feature or create new one
            feature = self._find_or_create_feature(
                db=db,
                workspace_id=workspace_id,
                feature_title=ai_result.get('feature_title', 'Untitled Feature'),
                feature_description=ai_result.get('feature_description', ''),
                theme=theme,
                urgency=ai_result.get('urgency', 'medium'),
                priority=ai_result.get('priority', 'medium')
            )

            # Step 4: Link message to feature
            if message not in feature.messages:
                feature.messages.append(message)
                feature.mention_count = len(feature.messages)
                feature.last_mentioned = message.sent_at
                feature.updated_at = datetime.utcnow()

            # Step 5: Save extracted data points
            extracted_data = ai_result.get('extracted_data', {})
            data_points_saved = []
            if extracted_data:
                data_points_saved = self._save_extracted_data_points(
                    db=db,
                    workspace_id=workspace_id,
                    feature_id=str(feature.id),
                    message_id=str(message.id),
                    extracted_data=extracted_data,
                    author=message.author_name
                )

            # Commit all changes
            db.commit()
            db.refresh(feature)

            logger.info(f"Successfully processed message {message.id}, "
                       f"feature: {feature.id}, data points: {len(data_points_saved)}")

            return {
                "status": "success",
                "message_id": str(message.id),
                "feature_id": str(feature.id),
                "feature_name": feature.name,
                "theme_id": str(feature.theme_id) if feature.theme_id else None,
                "theme_name": theme.name if theme else None,
                "data_points_saved": len(data_points_saved),
                "is_new_feature": feature.mention_count == 1,
                "ai_result": ai_result
            }

        except Exception as e:
            logger.error(f"Error processing message {message.id}: {e}")
            db.rollback()
            raise

    def _get_or_create_theme(self, db: Session, workspace_id: str, theme_name: str) -> Theme:
        """Get existing theme or return None if not found"""
        # Only use existing themes - don't create new ones
        theme = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            func.lower(Theme.name) == func.lower(theme_name)
        ).first()

        if not theme:
            logger.warning(f"Theme '{theme_name}' not found in workspace {workspace_id}")

        return theme

    def _find_or_create_feature(
        self,
        db: Session,
        workspace_id: str,
        feature_title: str,
        feature_description: str,
        theme: Optional[Theme],
        urgency: str,
        priority: str
    ) -> Feature:
        """
        Find existing similar feature or create new one

        Args:
            db: Database session
            workspace_id: Workspace ID
            feature_title: Feature title from AI
            feature_description: Feature description from AI
            theme: Theme object (can be None)
            urgency: Urgency level
            priority: Priority level

        Returns:
            Feature object (existing or new)
        """
        # Try to find existing feature with similar name in the same theme
        existing_feature = None
        if theme:
            existing_feature = db.query(Feature).filter(
                Feature.workspace_id == workspace_id,
                Feature.theme_id == theme.id,
                func.lower(Feature.name).contains(func.lower(feature_title[:20]))  # Match first 20 chars
            ).first()

        if existing_feature:
            logger.info(f"Found existing feature: {existing_feature.id}")
            return existing_feature

        # Create new feature
        new_feature = Feature(
            name=feature_title,
            description=feature_description,
            urgency=urgency,
            status="new",
            mention_count=0,
            workspace_id=workspace_id,
            theme_id=theme.id if theme else None,
            first_mentioned=datetime.utcnow(),
            last_mentioned=datetime.utcnow()
        )

        db.add(new_feature)
        db.flush()  # Get the ID

        logger.info(f"Created new feature: {new_feature.id}")
        return new_feature

    def _save_extracted_data_points(
        self,
        db: Session,
        workspace_id: str,
        feature_id: str,
        message_id: str,
        extracted_data: Dict[str, Any],
        author: Optional[str]
    ) -> List[WorkspaceDataPoint]:
        """
        Save extracted data points to database

        Args:
            db: Database session
            workspace_id: Workspace ID
            feature_id: Feature ID
            message_id: Message ID
            extracted_data: Dictionary of extracted data
            author: Message author

        Returns:
            List of saved WorkspaceDataPoint objects
        """
        saved_points = []

        for field_key, field_value in extracted_data.items():
            if field_value is None:
                continue

            # Determine data type and category
            data_point_category = self._determine_category(field_key)

            # Create data point
            data_point = WorkspaceDataPoint(
                workspace_id=workspace_id,
                feature_id=feature_id,
                message_id=message_id,
                data_point_key=field_key,
                data_point_category=data_point_category,
                author=author
            )

            # Set the appropriate value field based on type
            if isinstance(field_value, (int, float)):
                data_point.numeric_value = float(field_value)
            elif isinstance(field_value, bool):
                data_point.integer_value = 1 if field_value else 0
            elif isinstance(field_value, list):
                data_point.text_value = ', '.join(str(v) for v in field_value)
            else:
                data_point.text_value = str(field_value)

            db.add(data_point)
            saved_points.append(data_point)

        db.flush()
        logger.info(f"Saved {len(saved_points)} data points for message {message_id}")

        return saved_points

    def _determine_category(self, field_key: str) -> str:
        """Determine the category of a data point based on its key"""
        business_metrics = ['mrr', 'revenue', 'arr', 'deal_size', 'contract_value']
        entities = ['customer_name', 'company_name', 'contact_name', 'company_size', 'industry']
        structured_metrics = ['urgency', 'priority', 'status', 'sentiment']

        field_lower = field_key.lower()

        if any(metric in field_lower for metric in business_metrics):
            return 'business_metrics'
        elif any(entity in field_lower for entity in entities):
            return 'entities'
        elif any(metric in field_lower for metric in structured_metrics):
            return 'structured_metrics'
        else:
            return 'other'

    def batch_process_and_save_messages(
        self,
        workspace_id: str,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Process multiple messages and save to database

        Args:
            workspace_id: Workspace ID
            limit: Maximum number of messages to process

        Returns:
            Processing statistics
        """
        db = next(get_db())
        try:
            # Get unprocessed messages
            query = db.query(Message).filter(
                Message.workspace_id == workspace_id,
                Message.content.isnot(None),
                Message.content != ""
            ).order_by(Message.sent_at.desc())

            if limit:
                query = query.limit(limit)

            messages = query.all()

            if not messages:
                return {
                    "status": "no_messages",
                    "message": "No messages to process"
                }

            # Process each message
            results = []
            features_created = 0
            features_updated = 0
            data_points_saved = 0

            for message in messages:
                try:
                    result = self.process_and_save_message(message, workspace_id, db)
                    results.append(result)

                    if result.get('status') == 'success':
                        if result.get('is_new_feature'):
                            features_created += 1
                        else:
                            features_updated += 1
                        data_points_saved += result.get('data_points_saved', 0)

                except Exception as e:
                    logger.error(f"Failed to process message {message.id}: {e}")
                    results.append({
                        "status": "error",
                        "message_id": str(message.id),
                        "error": str(e)
                    })

            return {
                "status": "success",
                "messages_processed": len(messages),
                "features_created": features_created,
                "features_updated": features_updated,
                "data_points_saved": data_points_saved,
                "results": results
            }

        finally:
            db.close()


# Global service instance
message_processing_with_storage_service = MessageProcessingWithStorageService()

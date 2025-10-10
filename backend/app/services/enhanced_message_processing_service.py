import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.feature import Feature
from app.models.theme import Theme
from app.services.ai_processing_service import ai_processing_service
from app.services.fast_classification_service import fast_classification_service
from app.core.database import get_db

logger = logging.getLogger(__name__)


class EnhancedMessageProcessingService:
    """
    Enhanced service that combines traditional AI processing with fast classification
    using learned signals from approved clusters
    """

    def __init__(self):
        self.ai_service = ai_processing_service
        self.classification_service = fast_classification_service

    def process_message_with_classification(
        self,
        message: Message,
        use_fast_classification: bool = True,
        fallback_to_ai: bool = True
    ) -> Dict[str, Any]:
        """
        Process a message using fast classification first, then fallback to AI if needed

        Args:
            message: Message to process
            use_fast_classification: Whether to try fast classification first
            fallback_to_ai: Whether to fallback to AI processing if fast classification fails

        Returns:
            Combined processing result
        """
        try:
            result = {
                "message_id": str(message.id),
                "fast_classification": None,
                "ai_processing": None,
                "final_classification": None,
                "processing_path": [],
                "confidence": 0.0,
                "is_feature_request": False
            }

            workspace_id = str(message.workspace_id)

            # Phase 1: Try fast classification using learned signals
            if use_fast_classification:
                logger.info(f"Attempting fast classification for message {message.id}")
                result["processing_path"].append("fast_classification")

                fast_result = self.classification_service.classify_message(
                    message=message,
                    workspace_id=workspace_id,
                    confidence_threshold=0.6
                )

                result["fast_classification"] = fast_result

                if fast_result["classified"]:
                    # Fast classification succeeded
                    result["final_classification"] = {
                        "source": "fast_classification",
                        "category": fast_result["category"],
                        "theme": fast_result["theme"],
                        "confidence": fast_result["confidence"],
                        "signals_used": fast_result["signals_used"]
                    }
                    result["confidence"] = fast_result["confidence"]
                    result["is_feature_request"] = True

                    logger.info(f"Fast classification successful for message {message.id}: "
                              f"{fast_result['category']} / {fast_result['theme']} "
                              f"(confidence: {fast_result['confidence']:.3f})")

                    return result

                else:
                    logger.info(f"Fast classification failed for message {message.id}: {fast_result['reason']}")

            # Phase 2: Fallback to traditional AI processing
            if fallback_to_ai:
                logger.info(f"Attempting AI processing for message {message.id}")
                result["processing_path"].append("ai_processing")

                ai_result = self.ai_service.process_message(message, workspace_id=workspace_id)
                result["ai_processing"] = ai_result

                if ai_result.get("is_feature_request", False):
                    # AI processing succeeded
                    result["final_classification"] = {
                        "source": "ai_processing",
                        "category": ai_result.get("category", "Unknown"),
                        "theme": ai_result.get("theme", "Unknown"),
                        "confidence": ai_result.get("confidence", 0.0),
                        "feature_title": ai_result.get("feature_title"),
                        "feature_description": ai_result.get("feature_description")
                    }
                    result["confidence"] = ai_result.get("confidence", 0.0)
                    result["is_feature_request"] = True

                    logger.info(f"AI processing successful for message {message.id}: "
                              f"{ai_result.get('category')} / {ai_result.get('theme')} "
                              f"(confidence: {ai_result.get('confidence', 0.0):.3f})")

                else:
                    logger.info(f"AI processing determined message {message.id} is not a feature request")

            # Mark message as processed
            db = next(get_db())
            try:
                message.is_processed = True
                message.processed_at = datetime.utcnow()
                db.commit()
            finally:
                db.close()

            return result

        except Exception as e:
            logger.error(f"Error processing message {message.id}: {e}")
            return {
                "message_id": str(message.id),
                "error": str(e),
                "fast_classification": None,
                "ai_processing": None,
                "final_classification": None,
                "processing_path": ["error"],
                "confidence": 0.0,
                "is_feature_request": False
            }

    def batch_process_messages(
        self,
        messages: List[Message],
        use_fast_classification: bool = True,
        fallback_to_ai: bool = True,
        max_ai_fallbacks: Optional[int] = 10
    ) -> List[Dict[str, Any]]:
        """
        Process multiple messages in batch, optimizing for performance

        Args:
            messages: List of messages to process
            use_fast_classification: Whether to try fast classification first
            fallback_to_ai: Whether to fallback to AI processing
            max_ai_fallbacks: Maximum number of AI fallbacks to allow (cost control)

        Returns:
            List of processing results
        """
        results = []
        ai_fallback_count = 0

        logger.info(f"Starting batch processing of {len(messages)} messages")

        # Get workspace_id from first message
        workspace_id = str(messages[0].workspace_id) if messages else None

        # First pass: Try fast classification for all messages
        if use_fast_classification:

            if workspace_id:
                logger.info(f"Attempting fast classification for {len(messages)} messages")

                # Use batch classification for better performance
                fast_results = self.classification_service.batch_classify_messages(
                    messages=messages,
                    workspace_id=workspace_id,
                    confidence_threshold=0.6
                )

                # Process fast classification results
                fast_classified = []
                needs_ai_processing = []

                for i, message in enumerate(messages):
                    fast_result = fast_results[i] if i < len(fast_results) else None

                    if fast_result and fast_result.get("classified", False):
                        # Fast classification succeeded
                        result = {
                            "message_id": str(message.id),
                            "fast_classification": fast_result,
                            "ai_processing": None,
                            "final_classification": {
                                "source": "fast_classification",
                                "category": fast_result["category"],
                                "theme": fast_result["theme"],
                                "confidence": fast_result["confidence"],
                                "signals_used": fast_result["signals_used"]
                            },
                            "processing_path": ["fast_classification"],
                            "confidence": fast_result["confidence"],
                            "is_feature_request": True
                        }
                        fast_classified.append(result)

                    else:
                        # Needs AI processing
                        needs_ai_processing.append({
                            "message": message,
                            "fast_result": fast_result
                        })

                results.extend(fast_classified)
                logger.info(f"Fast classification succeeded for {len(fast_classified)} messages, "
                          f"{len(needs_ai_processing)} need AI processing")

        else:
            needs_ai_processing = [{"message": msg, "fast_result": None} for msg in messages]

        # Second pass: AI processing for messages that couldn't be fast-classified
        if fallback_to_ai and needs_ai_processing:
            logger.info(f"Processing {len(needs_ai_processing)} messages with AI")

            for item in needs_ai_processing:
                if max_ai_fallbacks and ai_fallback_count >= max_ai_fallbacks:
                    logger.warning(f"Reached maximum AI fallbacks ({max_ai_fallbacks}), "
                                 f"skipping remaining {len(needs_ai_processing) - ai_fallback_count} messages")
                    break

                message = item["message"]
                fast_result = item["fast_result"]

                try:
                    ai_result = self.ai_service.process_message(message, workspace_id=workspace_id)
                    ai_fallback_count += 1

                    result = {
                        "message_id": str(message.id),
                        "fast_classification": fast_result,
                        "ai_processing": ai_result,
                        "processing_path": ["fast_classification", "ai_processing"] if fast_result else ["ai_processing"],
                        "confidence": ai_result.get("confidence", 0.0),
                        "is_feature_request": ai_result.get("is_feature_request", False)
                    }

                    if ai_result.get("is_feature_request", False):
                        result["final_classification"] = {
                            "source": "ai_processing",
                            "category": ai_result.get("category", "Unknown"),
                            "theme": ai_result.get("theme", "Unknown"),
                            "confidence": ai_result.get("confidence", 0.0),
                            "feature_title": ai_result.get("feature_title"),
                            "feature_description": ai_result.get("feature_description")
                        }
                    else:
                        result["final_classification"] = None

                    results.append(result)

                except Exception as e:
                    logger.error(f"Error in AI processing for message {message.id}: {e}")
                    results.append({
                        "message_id": str(message.id),
                        "fast_classification": fast_result,
                        "ai_processing": {"error": str(e)},
                        "final_classification": None,
                        "processing_path": ["fast_classification", "ai_processing_error"] if fast_result else ["ai_processing_error"],
                        "confidence": 0.0,
                        "is_feature_request": False,
                        "error": str(e)
                    })

        # Update processed status for all messages
        self._mark_messages_processed([msg for msg in messages])

        # Generate summary statistics
        total_processed = len(results)
        fast_classified = len([r for r in results if "fast_classification" in r["processing_path"]])
        ai_processed = len([r for r in results if "ai_processing" in r["processing_path"]])
        feature_requests = len([r for r in results if r["is_feature_request"]])

        logger.info(f"Batch processing complete: {total_processed} total, "
                   f"{fast_classified} fast-classified, {ai_processed} AI-processed, "
                   f"{feature_requests} feature requests found")

        return results

    def _mark_messages_processed(self, messages: List[Message]) -> None:
        """Mark messages as processed in the database"""
        db = next(get_db())
        try:
            current_time = datetime.utcnow()
            for message in messages:
                message.is_processed = True
                message.processed_at = current_time
            db.commit()
        except Exception as e:
            logger.error(f"Error marking messages as processed: {e}")
        finally:
            db.close()

    def get_processing_performance_stats(self, workspace_id: str) -> Dict[str, Any]:
        """Get performance statistics for message processing"""
        try:
            # Get classification stats
            classification_stats = self.classification_service.get_classification_stats(workspace_id)

            # Get message processing stats from database
            db = next(get_db())
            try:
                total_messages = db.query(Message).filter(
                    Message.workspace_id == workspace_id
                ).count()

                processed_messages = db.query(Message).filter(
                    Message.workspace_id == workspace_id,
                    Message.is_processed == True
                ).count()

                recent_messages = db.query(Message).filter(
                    Message.workspace_id == workspace_id,
                    Message.processed_at.isnot(None)
                ).order_by(Message.processed_at.desc()).limit(100).all()

            finally:
                db.close()

            return {
                "message_stats": {
                    "total_messages": total_messages,
                    "processed_messages": processed_messages,
                    "processing_rate": processed_messages / total_messages if total_messages > 0 else 0
                },
                "classification_stats": classification_stats,
                "recent_processing": len(recent_messages)
            }

        except Exception as e:
            logger.error(f"Error getting processing stats: {e}")
            return {"error": str(e)}


# Global service instance
enhanced_message_processing_service = EnhancedMessageProcessingService()
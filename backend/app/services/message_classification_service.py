import re
import logging
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from collections import defaultdict

from app.core.database import get_db
from app.models.message import Message
from app.models.feature import Feature
from app.models.theme import Theme
from app.models.clustering import DiscoveredCluster, ClassificationSignal
from app.services.llm_clustering_service import llm_clustering_service

logger = logging.getLogger(__name__)


class MessageClassificationService:
    """Service for classifying messages using discovered clusters and generating features"""

    def __init__(self):
        self.classification_cache = {}

    def classify_messages_to_features(
        self,
        workspace_id: str,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Classify all messages in a workspace using discovered clusters and create features

        Args:
            workspace_id: ID of the workspace to process
            limit: Optional limit on number of messages to process

        Returns:
            Dictionary with classification results and created features
        """
        db = next(get_db())
        try:
            logger.info(f"Starting message classification for workspace {workspace_id}")

            # Get all approved clusters for this workspace
            approved_clusters = self._get_approved_clusters(db, workspace_id)
            if not approved_clusters:
                logger.warning(f"No approved clusters found for workspace {workspace_id}")
                return {
                    "status": "no_clusters",
                    "message": "No approved clusters available for classification",
                    "features_created": 0
                }

            # Get messages to classify
            messages = self._get_messages_for_classification(db, workspace_id, limit)
            if not messages:
                logger.warning(f"No messages found for classification in workspace {workspace_id}")
                return {
                    "status": "no_messages",
                    "message": "No messages available for classification",
                    "features_created": 0
                }

            # Classify messages against clusters
            classifications = self._classify_messages_against_clusters(messages, approved_clusters)

            # Group classifications and create features
            features_created = self._create_features_from_classifications(
                db, workspace_id, classifications, approved_clusters
            )

            db.commit()

            logger.info(f"Classification complete: {len(features_created)} features created")

            return {
                "status": "success",
                "messages_processed": len(messages),
                "clusters_used": len(approved_clusters),
                "features_created": len(features_created),
                "features": features_created
            }

        except Exception as e:
            logger.error(f"Error in message classification: {e}")
            db.rollback()
            raise
        finally:
            db.close()

    def _get_approved_clusters(self, db: Session, workspace_id: str) -> List[DiscoveredCluster]:
        """Get all approved clusters for a workspace"""
        from app.models.clustering import ClusteringRun

        return db.query(DiscoveredCluster).join(ClusteringRun).filter(
            ClusteringRun.workspace_id == workspace_id,
            DiscoveredCluster.approval_status == "approved"
        ).all()

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

    def _classify_messages_against_clusters(
        self,
        messages: List[Message],
        clusters: List[DiscoveredCluster]
    ) -> List[Dict[str, Any]]:
        """Classify messages against approved clusters using basic pattern matching"""
        classifications = []

        for message in messages:
            best_match = self._find_best_cluster_match(message, clusters)
            if best_match:
                classifications.append({
                    "message": message,
                    "cluster": best_match["cluster"],
                    "confidence": best_match["confidence"],
                    "match_type": best_match["match_type"]
                })

        return classifications

    def _find_best_cluster_match(
        self,
        message: Message,
        clusters: List[DiscoveredCluster]
    ) -> Optional[Dict[str, Any]]:
        """Find the best matching cluster for a message using simple keyword matching"""
        best_match = None
        best_score = 0.0

        message_text = message.content.lower()

        for cluster in clusters:
            score = self._calculate_cluster_similarity(message_text, cluster)
            if score > best_score and score > 0.15:  # Minimum threshold (optimized)
                best_match = {
                    "cluster": cluster,
                    "confidence": score,
                    "match_type": "keyword_similarity"
                }
                best_score = score

        return best_match

    def _calculate_cluster_similarity(self, message_text: str, cluster: DiscoveredCluster) -> float:
        """Calculate similarity between message and cluster using keyword matching"""
        # Simple keyword-based similarity
        cluster_keywords = self._extract_cluster_keywords(cluster)

        matches = 0
        total_keywords = len(cluster_keywords)

        if total_keywords == 0:
            return 0.0

        for keyword in cluster_keywords:
            if keyword.lower() in message_text:
                matches += 1

        return matches / total_keywords

    def _extract_cluster_keywords(self, cluster: DiscoveredCluster) -> List[str]:
        """Extract keywords from cluster name and description"""
        keywords = []

        # Add cluster name words
        cluster_name_words = re.findall(r'\b\w+\b', cluster.cluster_name.lower())
        keywords.extend(cluster_name_words)

        # Add category and theme
        keywords.append(cluster.category.lower())
        keywords.append(cluster.theme.lower())

        # Extract key words from description
        description_words = re.findall(r'\b\w{4,}\b', cluster.description.lower())
        keywords.extend(description_words[:10])  # Limit to top 10 words

        # Remove common stop words
        stop_words = {'that', 'this', 'with', 'from', 'they', 'have', 'been', 'their', 'would', 'could', 'should'}
        keywords = [k for k in keywords if k not in stop_words and len(k) > 2]

        return list(set(keywords))  # Remove duplicates

    def _create_features_from_classifications(
        self,
        db: Session,
        workspace_id: str,
        classifications: List[Dict[str, Any]],
        clusters: List[DiscoveredCluster]
    ) -> List[Dict[str, Any]]:
        """Create Feature records from message classifications"""
        # Group classifications by cluster
        cluster_groups = defaultdict(list)
        for classification in classifications:
            cluster_id = classification["cluster"].id
            cluster_groups[cluster_id].append(classification)

        features_created = []

        for cluster_id, group_classifications in cluster_groups.items():
            cluster = group_classifications[0]["cluster"]

            # Get or create theme for this cluster
            theme = self._get_or_create_theme(db, workspace_id, cluster)

            # Check if feature already exists
            existing_feature = db.query(Feature).filter(
                Feature.workspace_id == workspace_id,
                Feature.name == cluster.cluster_name
            ).first()

            if existing_feature:
                # Update existing feature
                existing_feature.mention_count += len(group_classifications)
                existing_feature.last_mentioned = datetime.utcnow()
                existing_feature.updated_at = datetime.utcnow()

                # Add new messages to the feature
                for classification in group_classifications:
                    if classification["message"] not in existing_feature.messages:
                        existing_feature.messages.append(classification["message"])

                feature_data = {
                    "id": str(existing_feature.id),
                    "name": existing_feature.name,
                    "mention_count": existing_feature.mention_count,
                    "status": "updated"
                }
            else:
                # Create new feature
                urgency = self._determine_urgency(cluster, len(group_classifications))

                new_feature = Feature(
                    name=cluster.cluster_name,
                    description=cluster.description,
                    urgency=urgency,
                    status="new",
                    mention_count=len(group_classifications),
                    workspace_id=workspace_id,
                    theme_id=theme.id,
                    first_mentioned=min(c["message"].sent_at for c in group_classifications if c["message"].sent_at),
                    last_mentioned=max(c["message"].sent_at for c in group_classifications if c["message"].sent_at)
                )

                db.add(new_feature)
                db.flush()  # Get the ID

                # Add messages to the feature
                for classification in group_classifications:
                    new_feature.messages.append(classification["message"])

                feature_data = {
                    "id": str(new_feature.id),
                    "name": new_feature.name,
                    "mention_count": new_feature.mention_count,
                    "status": "created"
                }

            features_created.append(feature_data)

        return features_created

    def _get_or_create_theme(self, db: Session, workspace_id: str, cluster: DiscoveredCluster) -> Theme:
        """Get existing theme or create new one based on cluster category"""
        existing_theme = db.query(Theme).filter(
            Theme.workspace_id == workspace_id,
            Theme.name == cluster.category
        ).first()

        if existing_theme:
            return existing_theme

        # Create new theme
        new_theme = Theme(
            name=cluster.category,
            description=f"Features related to {cluster.category.lower()}",
            workspace_id=workspace_id
        )
        db.add(new_theme)
        db.flush()
        return new_theme

    def _determine_urgency(self, cluster: DiscoveredCluster, mention_count: int) -> str:
        """Determine feature urgency based on cluster confidence and mention count"""
        urgency_score = (cluster.confidence_score * 0.7) + (min(mention_count / 10, 1.0) * 0.3)

        if urgency_score >= 0.8:
            return "critical"
        elif urgency_score >= 0.6:
            return "high"
        elif urgency_score >= 0.4:
            return "medium"
        else:
            return "low"

    def get_classification_stats(self, workspace_id: str) -> Dict[str, Any]:
        """Get statistics about message classification for a workspace"""
        db = next(get_db())
        try:
            # Get total messages
            total_messages = db.query(Message).filter(
                Message.workspace_id == workspace_id
            ).count()

            # Get classified messages (messages linked to features)
            classified_messages = db.query(Message).join(
                Message.features
            ).filter(Message.workspace_id == workspace_id).count()

            # Get total features
            total_features = db.query(Feature).filter(
                Feature.workspace_id == workspace_id
            ).count()

            # Get approved clusters
            approved_clusters = len(self._get_approved_clusters(db, workspace_id))

            return {
                "total_messages": total_messages,
                "classified_messages": classified_messages,
                "classification_rate": classified_messages / total_messages if total_messages > 0 else 0,
                "total_features": total_features,
                "approved_clusters": approved_clusters
            }
        finally:
            db.close()


# Global service instance
message_classification_service = MessageClassificationService()
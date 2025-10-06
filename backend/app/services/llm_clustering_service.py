import os
import logging
from typing import Dict, Any, List, Optional, Tuple
from openai import OpenAI
import json
from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.clustering import ClusteringRun, DiscoveredCluster, ClassificationSignal
from app.core.database import get_db

logger = logging.getLogger(__name__)


class LLMClusteringService:
    """Service for discovering clusters and extracting classification signals using LLM"""

    def __init__(self):
        """Initialize OpenAI client"""
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            # For debugging, create a dummy client
            print("WARNING: OPENAI_API_KEY not set, using dummy client")
            self.client = None
        else:
            self.client = OpenAI(api_key=api_key)

        self.model = "gpt-4o"  # More powerful model for complex clustering analysis

    def start_clustering_run(
        self,
        workspace_id: str,
        run_name: str,
        description: Optional[str] = None,
        confidence_threshold: float = 0.7,
        max_messages: Optional[int] = None
    ) -> ClusteringRun:
        """
        Start a new clustering analysis run

        Args:
            workspace_id: ID of the workspace to analyze
            run_name: Human-readable name for this run
            description: Optional description
            confidence_threshold: Minimum confidence for cluster acceptance
            max_messages: Limit number of messages to analyze (for testing)

        Returns:
            ClusteringRun object
        """
        db = next(get_db())
        try:
            # Create clustering run record
            clustering_run = ClusteringRun(
                workspace_id=workspace_id,
                run_name=run_name,
                description=description,
                confidence_threshold=confidence_threshold,
                status="running"
            )
            db.add(clustering_run)
            db.commit()
            db.refresh(clustering_run)

            logger.info(f"Started clustering run {clustering_run.id} for workspace {workspace_id}")

            # Get messages to analyze
            messages = self._get_unprocessed_messages(db, workspace_id, max_messages)
            clustering_run.messages_analyzed = len(messages)

            if not messages:
                clustering_run.status = "completed"
                clustering_run.completed_at = datetime.utcnow()
                db.commit()
                logger.warning(f"No messages found for clustering run {clustering_run.id}")
                return clustering_run

            # Perform clustering analysis
            clusters = self._discover_clusters(messages, confidence_threshold)

            # Save discovered clusters
            for cluster_data in clusters:
                discovered_cluster = DiscoveredCluster(
                    clustering_run_id=clustering_run.id,
                    cluster_name=cluster_data["cluster_name"],
                    description=cluster_data["description"],
                    category=cluster_data["category"],
                    theme=cluster_data["theme"],
                    confidence_score=cluster_data["confidence_score"],
                    message_count=cluster_data["message_count"],
                    business_impact=cluster_data["business_impact"],
                    example_messages=cluster_data["example_messages"]
                )
                db.add(discovered_cluster)

            clustering_run.clusters_discovered = len(clusters)
            clustering_run.status = "completed"
            clustering_run.completed_at = datetime.utcnow()

            db.commit()
            logger.info(f"Completed clustering run {clustering_run.id}: {len(clusters)} clusters discovered")

            return clustering_run

        except Exception as e:
            logger.error(f"Error in clustering run {clustering_run.id}: {e}")
            clustering_run.status = "failed"
            db.commit()
            raise
        finally:
            db.close()

    def _get_unprocessed_messages(
        self,
        db: Session,
        workspace_id: str,
        max_messages: Optional[int] = None
    ) -> List[Message]:
        """Get messages from the database for analysis"""
        query = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.content.isnot(None),
            Message.content != ""
        ).order_by(Message.sent_at.desc())

        if max_messages:
            query = query.limit(max_messages)

        return query.all()

    def _discover_clusters(self, messages: List[Message], confidence_threshold: float) -> List[Dict[str, Any]]:
        """
        Use LLM to discover clusters from messages

        Args:
            messages: List of messages to analyze
            confidence_threshold: Minimum confidence for cluster acceptance

        Returns:
            List of discovered cluster data
        """
        logger.info(f"Analyzing {len(messages)} messages for cluster discovery")

        # Prepare message data for LLM analysis
        message_summaries = []
        for i, msg in enumerate(messages[:50]):  # Limit to 50 messages for LLM context
            message_summaries.append({
                "id": i,
                "content": msg.content[:500],  # Truncate long messages
                "channel": msg.channel_name,
                "author": msg.author_name,
                "date": msg.sent_at.isoformat() if msg.sent_at else None
            })

        # Create clustering prompt
        prompt = self._create_clustering_prompt(message_summaries)

        try:
            # Call OpenAI API for clustering analysis
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_clustering_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=4000,
                response_format={"type": "json_object"}
            )

            # Parse response
            result = json.loads(response.choices[0].message.content)
            clusters = result.get("clusters", [])

            # Filter by confidence threshold
            high_confidence_clusters = [
                cluster for cluster in clusters
                if cluster.get("confidence_score", 0) >= confidence_threshold
            ]

            logger.info(f"Discovered {len(clusters)} total clusters, {len(high_confidence_clusters)} above threshold")
            return high_confidence_clusters

        except Exception as e:
            logger.error(f"Error in LLM clustering analysis: {e}")
            return []

    def _get_clustering_system_prompt(self) -> str:
        """Get the system prompt for clustering analysis"""
        return """You are an AI expert in analyzing customer feature requests and feedback to discover meaningful clusters and patterns.

Your task is to analyze a collection of customer messages and identify distinct clusters of similar requests, themes, or issues.

For each cluster you discover, provide:
1. A clear, descriptive cluster name
2. Detailed description of what unites these messages
3. Business category (Core Features, Integrations, UI/UX, Performance, Security, Mobile, Analytics, Administration)
4. Theme (Productivity, Security, Customer Experience, Operational Efficiency, Data Management, etc.)
5. Confidence score (0.0 to 1.0) based on how distinct and well-defined the cluster is
6. Business impact description
7. Example message IDs that belong to this cluster

Focus on discovering:
- Feature request patterns (similar functionality being requested)
- Pain point clusters (common problems or frustrations)
- Integration needs (requests for specific third-party connections)
- Workflow improvements (productivity and efficiency requests)
- Technical requirements (performance, security, etc.)

Respond with valid JSON in this format:
{
    "clusters": [
        {
            "cluster_name": "Brief descriptive name",
            "description": "Detailed description of this cluster",
            "category": "High-level business category",
            "theme": "Broader business theme",
            "confidence_score": 0.85,
            "message_count": 5,
            "business_impact": "Description of potential business impact",
            "example_messages": [0, 2, 5, 8, 12],
            "key_characteristics": ["characteristic1", "characteristic2"],
            "suggested_keywords": ["keyword1", "keyword2", "keyword3"],
            "suggested_patterns": ["pattern1", "pattern2"]
        }
    ],
    "analysis_summary": {
        "total_messages_analyzed": 50,
        "clusters_discovered": 8,
        "coverage_percentage": 85.5,
        "main_themes": ["theme1", "theme2"]
    }
}

Be thorough but precise. Only create clusters when there's clear evidence of similar requests or themes."""

    def _create_clustering_prompt(self, message_summaries: List[Dict[str, Any]]) -> str:
        """Create the clustering analysis prompt"""
        messages_text = "\n".join([
            f"Message {msg['id']}: [{msg['channel']}] {msg['author']}: {msg['content']}"
            for msg in message_summaries
        ])

        return f"""Please analyze these customer messages and discover meaningful clusters of similar requests, themes, or issues:

MESSAGES TO ANALYZE:
{messages_text}

ANALYSIS INSTRUCTIONS:
1. Look for patterns in feature requests, pain points, and common themes
2. Group similar messages into distinct clusters
3. Focus on actionable business insights
4. Provide specific examples and clear reasoning
5. Suggest classification signals for future automation

Please analyze these messages and return clusters in the specified JSON format."""

    def approve_cluster(
        self,
        cluster_id: str,
        approved_by_user_id: str,
        customer_feedback: Optional[str] = None
    ) -> DiscoveredCluster:
        """
        Approve a discovered cluster and generate classification signals

        Args:
            cluster_id: ID of the cluster to approve
            approved_by_user_id: ID of the user approving
            customer_feedback: Optional feedback from customer

        Returns:
            Updated DiscoveredCluster object
        """
        db = next(get_db())
        try:
            # Get the cluster from database
            cluster = db.query(DiscoveredCluster).filter(
                DiscoveredCluster.id == cluster_id
            ).first()

            if not cluster:
                raise ValueError(f"Cluster {cluster_id} not found")

            # Update approval status
            cluster.approval_status = "approved"
            cluster.approved_by = approved_by_user_id
            cluster.approved_at = datetime.utcnow()
            cluster.customer_feedback = customer_feedback

            # Commit changes
            db.commit()

            # Note: Skipping classification signal generation for now
            # This can be added back once the basic approval is working

            return cluster

        finally:
            db.close()

    def _generate_classification_signals(self, cluster: DiscoveredCluster) -> List[Dict[str, Any]]:
        """
        Generate classification signals from an approved cluster

        Args:
            cluster: Approved cluster to generate signals from

        Returns:
            List of signal configurations
        """
        try:
            # TEMPORARY: Return static signals for debugging
            logger.info(f"Generating signals for cluster {cluster.cluster_name} (DEBUG MODE)")
            return [
                {
                    "signal_type": "keyword",
                    "signal_name": f"{cluster.cluster_name} Keywords",
                    "keywords": [cluster.cluster_name.lower()],
                    "target_category": cluster.category,
                    "target_theme": cluster.theme,
                    "priority_weight": 0.8
                }
            ]

        except Exception as e:
            logger.error(f"Error generating classification signals for cluster {cluster.id}: {e}")
            # Return basic keyword signal as fallback
            return [{
                "signal_type": "keyword",
                "signal_name": f"{cluster.cluster_name} Keywords",
                "keywords": [cluster.cluster_name.lower()],
                "target_category": cluster.category,
                "target_theme": cluster.theme,
                "priority_weight": 0.5
            }]

    def get_clustering_runs(self, workspace_id: str) -> List[ClusteringRun]:
        """Get all clustering runs for a workspace"""
        db = next(get_db())
        try:
            return db.query(ClusteringRun).filter(
                ClusteringRun.workspace_id == workspace_id
            ).order_by(ClusteringRun.created_at.desc()).all()
        finally:
            db.close()

    def get_pending_clusters(self, workspace_id: str) -> List[DiscoveredCluster]:
        """Get all clusters pending customer approval"""
        db = next(get_db())
        try:
            return db.query(DiscoveredCluster).join(ClusteringRun).filter(
                ClusteringRun.workspace_id == workspace_id,
                DiscoveredCluster.approval_status == "pending"
            ).order_by(DiscoveredCluster.confidence_score.desc()).all()
        finally:
            db.close()


# Global service instance
llm_clustering_service = LLMClusteringService()
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, UUID4
import logging

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.clustering import ClusteringRun, DiscoveredCluster, ClassificationSignal
from app.services.llm_clustering_service import llm_clustering_service

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request/response
class StartClusteringRequest(BaseModel):
    run_name: str
    description: Optional[str] = None
    confidence_threshold: float = 0.7
    max_messages: Optional[int] = None


class ClusteringRunResponse(BaseModel):
    id: UUID4
    workspace_id: UUID4
    run_name: str
    description: Optional[str]
    status: str
    messages_analyzed: int
    clusters_discovered: int
    confidence_threshold: float
    created_at: str
    completed_at: Optional[str]

    class Config:
        from_attributes = True


class DiscoveredClusterResponse(BaseModel):
    id: UUID4
    clustering_run_id: UUID4
    cluster_name: str
    description: str
    category: str
    theme: str
    confidence_score: float
    message_count: int
    business_impact: Optional[str]
    example_messages: Optional[dict]
    approval_status: str
    approved_by: Optional[UUID4]
    approved_at: Optional[str]
    customer_feedback: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class ApproveClusterRequest(BaseModel):
    customer_feedback: Optional[str] = None


class ClassificationSignalResponse(BaseModel):
    id: UUID4
    source_cluster_id: UUID4
    signal_type: str
    signal_name: str
    keywords: Optional[list]
    patterns: Optional[list]
    semantic_threshold: Optional[float]
    business_rules: Optional[dict]
    target_category: str
    target_theme: str
    priority_weight: float
    precision: Optional[float]
    recall: Optional[float]
    usage_count: int
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


@router.post("/start", response_model=ClusteringRunResponse)
async def start_clustering_run(
    request: StartClusteringRequest,
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a new clustering analysis run for a workspace
    """
    try:
        # Verify user has access to workspace
        # (This would typically check workspace permissions)

        clustering_run = llm_clustering_service.start_clustering_run(
            workspace_id=workspace_id,
            run_name=request.run_name,
            description=request.description,
            confidence_threshold=request.confidence_threshold,
            max_messages=request.max_messages
        )

        return ClusteringRunResponse(
            id=clustering_run.id,
            workspace_id=clustering_run.workspace_id,
            run_name=clustering_run.run_name,
            description=clustering_run.description,
            status=clustering_run.status,
            messages_analyzed=clustering_run.messages_analyzed,
            clusters_discovered=clustering_run.clusters_discovered,
            confidence_threshold=clustering_run.confidence_threshold,
            created_at=clustering_run.created_at.isoformat(),
            completed_at=clustering_run.completed_at.isoformat() if clustering_run.completed_at else None
        )

    except Exception as e:
        logger.error(f"Error starting clustering run: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start clustering run: {str(e)}"
        )


@router.get("/runs", response_model=List[ClusteringRunResponse])
async def get_clustering_runs(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all clustering runs for a workspace
    """
    try:
        clustering_runs = llm_clustering_service.get_clustering_runs(workspace_id)

        return [
            ClusteringRunResponse(
                id=run.id,
                workspace_id=run.workspace_id,
                run_name=run.run_name,
                description=run.description,
                status=run.status,
                messages_analyzed=run.messages_analyzed,
                clusters_discovered=run.clusters_discovered,
                confidence_threshold=run.confidence_threshold,
                created_at=run.created_at.isoformat(),
                completed_at=run.completed_at.isoformat() if run.completed_at else None
            )
            for run in clustering_runs
        ]

    except Exception as e:
        logger.error(f"Error getting clustering runs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get clustering runs: {str(e)}"
        )


@router.get("/pending-clusters", response_model=List[DiscoveredClusterResponse])
async def get_pending_clusters(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all clusters pending customer approval for a workspace
    """
    try:
        pending_clusters = llm_clustering_service.get_pending_clusters(workspace_id)

        return [
            DiscoveredClusterResponse(
                id=cluster.id,
                clustering_run_id=cluster.clustering_run_id,
                cluster_name=cluster.cluster_name,
                description=cluster.description,
                category=cluster.category,
                theme=cluster.theme,
                confidence_score=cluster.confidence_score,
                message_count=cluster.message_count,
                business_impact=cluster.business_impact,
                example_messages=cluster.example_messages if isinstance(cluster.example_messages, dict) else None,
                approval_status=cluster.approval_status,
                approved_by=cluster.approved_by,
                approved_at=cluster.approved_at.isoformat() if cluster.approved_at else None,
                customer_feedback=cluster.customer_feedback,
                created_at=cluster.created_at.isoformat()
            )
            for cluster in pending_clusters
        ]

    except Exception as e:
        logger.error(f"Error getting pending clusters: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pending clusters: {str(e)}"
        )


@router.post("/clusters/{cluster_id}/approve", response_model=DiscoveredClusterResponse)
async def approve_cluster(
    cluster_id: str,
    request: ApproveClusterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Approve a discovered cluster and generate classification signals
    """
    try:
        print(f"[API DEBUG] About to call service.approve_cluster")
        cluster = llm_clustering_service.approve_cluster(
            cluster_id=cluster_id,
            approved_by_user_id=str(current_user["id"]),
            customer_feedback=request.customer_feedback
        )

        print(f"[API DEBUG] API received cluster type: {type(cluster)}")
        print(f"[API DEBUG] Cluster has id attribute: {hasattr(cluster, 'id')}")
        logger.info(f"API received cluster type: {type(cluster)}")
        logger.info(f"Cluster has id attribute: {hasattr(cluster, 'id')}")

        # Refresh cluster from the current session to avoid detached instance issues
        cluster = db.query(DiscoveredCluster).filter(
            DiscoveredCluster.id == cluster_id
        ).first()

        if not cluster:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cluster {cluster_id} not found after approval"
            )

        return DiscoveredClusterResponse(
            id=cluster.id,
            clustering_run_id=cluster.clustering_run_id,
            cluster_name=cluster.cluster_name,
            description=cluster.description,
            category=cluster.category,
            theme=cluster.theme,
            confidence_score=cluster.confidence_score,
            message_count=cluster.message_count,
            business_impact=cluster.business_impact,
            example_messages=cluster.example_messages if isinstance(cluster.example_messages, dict) else None,
            approval_status=cluster.approval_status,
            approved_by=cluster.approved_by,
            approved_at=cluster.approved_at.isoformat() if cluster.approved_at else None,
            customer_feedback=cluster.customer_feedback,
            created_at=cluster.created_at.isoformat()
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error approving cluster {cluster_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve cluster: {str(e)}"
        )


@router.post("/clusters/{cluster_id}/reject")
async def reject_cluster(
    cluster_id: str,
    request: ApproveClusterRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject a discovered cluster
    """
    try:
        cluster = db.query(DiscoveredCluster).filter(
            DiscoveredCluster.id == cluster_id
        ).first()

        if not cluster:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cluster {cluster_id} not found"
            )

        cluster.approval_status = "rejected"
        cluster.approved_by = current_user["id"]
        cluster.approved_at = None  # No approval timestamp for rejections
        cluster.customer_feedback = request.customer_feedback

        db.commit()

        return {"message": "Cluster rejected successfully", "cluster_id": cluster_id}

    except Exception as e:
        logger.error(f"Error rejecting cluster {cluster_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject cluster: {str(e)}"
        )


@router.get("/signals", response_model=List[ClassificationSignalResponse])
async def get_classification_signals(
    workspace_id: str,
    signal_type: Optional[str] = None,
    is_active: Optional[bool] = True,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get classification signals for a workspace
    """
    try:
        query = db.query(ClassificationSignal).filter(
            ClassificationSignal.workspace_id == workspace_id
        )

        if signal_type:
            query = query.filter(ClassificationSignal.signal_type == signal_type)

        if is_active is not None:
            query = query.filter(ClassificationSignal.is_active == is_active)

        signals = query.order_by(ClassificationSignal.created_at.desc()).all()

        return [
            ClassificationSignalResponse(
                id=signal.id,
                source_cluster_id=signal.source_cluster_id,
                signal_type=signal.signal_type,
                signal_name=signal.signal_name,
                keywords=signal.keywords,
                patterns=signal.patterns,
                semantic_threshold=signal.semantic_threshold,
                business_rules=signal.business_rules,
                target_category=signal.target_category,
                target_theme=signal.target_theme,
                priority_weight=signal.priority_weight,
                precision=signal.precision,
                recall=signal.recall,
                usage_count=signal.usage_count,
                is_active=signal.is_active,
                created_at=signal.created_at.isoformat()
            )
            for signal in signals
        ]

    except Exception as e:
        logger.error(f"Error getting classification signals: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get classification signals: {str(e)}"
        )


@router.put("/signals/{signal_id}/toggle")
async def toggle_signal_status(
    signal_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle the active status of a classification signal
    """
    try:
        signal = db.query(ClassificationSignal).filter(
            ClassificationSignal.id == signal_id
        ).first()

        if not signal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Signal {signal_id} not found"
            )

        signal.is_active = not signal.is_active
        db.commit()

        return {
            "message": f"Signal {'activated' if signal.is_active else 'deactivated'} successfully",
            "signal_id": signal_id,
            "is_active": signal.is_active
        }

    except Exception as e:
        logger.error(f"Error toggling signal {signal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle signal status: {str(e)}"
        )


@router.get("/test-service")
async def test_service():
    """
    Test endpoint to verify service is working
    """
    try:
        # Test calling a service method
        result = llm_clustering_service.get_clustering_runs("test-workspace")
        return {
            "message": "Service is working",
            "service_type": str(type(llm_clustering_service)),
            "method_exists": hasattr(llm_clustering_service, 'approve_cluster'),
            "runs_count": len(result)
        }
    except Exception as e:
        return {
            "message": "Service error",
            "error": str(e),
            "service_type": str(type(llm_clustering_service))
        }
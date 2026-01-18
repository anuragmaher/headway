"""
Tier-3 Aggregation/Merging Task - Periodic Execution

Periodic task to deduplicate, cluster, and merge extracted facts into Features.
This is the final step before data appears in the user-facing Features table.

Execution Model:
- Runs periodically (every 5-10 minutes) via Celery Beat
- Processes ExtractedFacts with aggregation_status='pending'
- Uses atomic status updates to prevent race conditions
- Does not require row-level locking since it's periodic batch processing
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Set
from uuid import UUID
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.tasks.celery_app import celery_app
from app.models.extracted_fact import ExtractedFact, AggregationRun
from app.models.feature import Feature
from app.models.theme import Theme
from app.services.tiered_ai_service import get_tiered_ai_service
from app.sync_engine.tasks.base import (
    engine,
    cleanup_after_task,
    test_db_connection,
)

logger = logging.getLogger(__name__)

# Batch size for aggregation
AGGREGATION_BATCH_SIZE = 50

# Similarity threshold for merging
SIMILARITY_THRESHOLD = 0.75


def _claim_facts_for_processing(
    db: Session,
    workspace_id: Optional[UUID],
    batch_size: int,
    run_id: UUID,
) -> List[ExtractedFact]:
    """
    Atomically claim facts for processing using UPDATE ... RETURNING pattern.

    This prevents race conditions when multiple workers run simultaneously.
    """
    # Build the query conditions
    conditions = ["aggregation_status = 'pending'"]
    params = {"run_id": str(run_id), "limit": batch_size}

    if workspace_id:
        conditions.append("workspace_id = :workspace_id")
        params["workspace_id"] = str(workspace_id)

    where_clause = " AND ".join(conditions)

    # Atomically claim facts by updating their status
    try:
        result = db.execute(
            text(f"""
                UPDATE extracted_facts
                SET aggregation_status = 'processing',
                    aggregation_run_id = :run_id
                WHERE id IN (
                    SELECT id FROM extracted_facts
                    WHERE {where_clause}
                    ORDER BY created_at ASC
                    LIMIT :limit
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id
            """),
            params
        )
        claimed_ids = [row[0] for row in result.fetchall()]
        db.commit()

        if not claimed_ids:
            return []

        # Fetch the claimed facts
        return db.query(ExtractedFact).filter(
            ExtractedFact.id.in_(claimed_ids)
        ).all()

    except Exception as e:
        logger.error(f"Error claiming facts: {e}")
        db.rollback()
        return []


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.aggregate_facts",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=120,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=1200,  # 20 minute limit (heavy processing)
    soft_time_limit=1140,
)
def aggregate_facts(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = AGGREGATION_BATCH_SIZE,
    similarity_threshold: float = SIMILARITY_THRESHOLD,
) -> Dict[str, Any]:
    """
    Aggregate extracted facts into Features.

    Periodic Execution:
    - Runs every 5-10 minutes via Celery Beat
    - Claims facts atomically using FOR UPDATE SKIP LOCKED
    - Groups pending facts by theme
    - Checks for similarity with existing features
    - Merges similar facts into existing features
    - Creates new features for unique requests

    Args:
        workspace_id: Optional workspace to limit processing
        batch_size: Number of facts to process per batch
        similarity_threshold: Minimum similarity to merge with existing feature

    Returns:
        Dict with processing stats
    """
    try:
        logger.info(f"🔄 Starting Tier-3 aggregation task (workspace={workspace_id})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            ai_service = get_tiered_ai_service()

            total_processed = 0
            total_merged = 0
            total_new_features = 0
            total_duplicates = 0
            total_errors = 0
            aggregation_run_ids = []

            # Get workspaces to process
            if workspace_id:
                workspace_ids = [UUID(workspace_id)]
            else:
                # Get all workspaces with pending facts
                workspace_ids = db.query(ExtractedFact.workspace_id).filter(
                    ExtractedFact.aggregation_status == "pending"
                ).distinct().all()
                workspace_ids = [w[0] for w in workspace_ids]

            if not workspace_ids:
                logger.info("No workspaces with pending facts to process")
                return {
                    "status": "success",
                    "total_processed": 0,
                    "total_new_features": 0,
                    "total_merged": 0,
                    "total_duplicates": 0,
                    "total_errors": 0,
                }

            for ws_id in workspace_ids:
                # Create aggregation run record per workspace
                run = AggregationRun(
                    workspace_id=ws_id,
                    status="running",
                    started_at=datetime.now(timezone.utc),
                )
                db.add(run)
                db.flush()
                aggregation_run_ids.append(str(run.id))

                ws_stats = _aggregate_workspace_facts(
                    db, ai_service, ws_id, batch_size, similarity_threshold, run.id
                )
                total_processed += ws_stats["processed"]
                total_merged += ws_stats["merged"]
                total_new_features += ws_stats["new_features"]
                total_duplicates += ws_stats["duplicates"]
                total_errors += ws_stats["errors"]

                # Update aggregation run for this workspace
                run.status = "completed"
                run.completed_at = datetime.now(timezone.utc)
                run.facts_processed = ws_stats["processed"]
                run.features_created = ws_stats["new_features"]
                run.features_updated = ws_stats["merged"]
                run.duplicates_found = ws_stats["duplicates"]

            db.commit()

            logger.info(
                f"✅ Tier-3 aggregation complete: {total_processed} facts processed, "
                f"{total_new_features} new features, {total_merged} merged, "
                f"{total_duplicates} duplicates, {total_errors} errors"
            )

            return {
                "status": "success",
                "aggregation_run_ids": aggregation_run_ids,
                "total_processed": total_processed,
                "total_new_features": total_new_features,
                "total_merged": total_merged,
                "total_duplicates": total_duplicates,
                "total_errors": total_errors,
            }

    except Exception as e:
        logger.error(f"❌ Tier-3 aggregation task failed: {e}")
        import traceback
        traceback.print_exc()
        raise self.retry(exc=e, countdown=300)
    finally:
        cleanup_after_task()


def _aggregate_workspace_facts(
    db: Session,
    ai_service,
    workspace_id: UUID,
    batch_size: int,
    similarity_threshold: float,
    run_id: UUID,
) -> Dict[str, int]:
    """Aggregate facts for a single workspace with atomic claiming."""
    stats = {"processed": 0, "merged": 0, "new_features": 0, "duplicates": 0, "errors": 0}

    # Atomically claim facts for processing
    facts = _claim_facts_for_processing(db, workspace_id, batch_size, run_id)

    if not facts:
        return stats

    logger.info(f"Claimed {len(facts)} facts for workspace {workspace_id}")

    # Group facts by theme for more efficient processing
    facts_by_theme = defaultdict(list)
    for fact in facts:
        facts_by_theme[fact.theme_id].append(fact)

    # Process each theme group
    for theme_id, theme_facts in facts_by_theme.items():
        theme_stats = _process_theme_facts(
            db, ai_service, workspace_id, theme_id, theme_facts, similarity_threshold
        )
        stats["processed"] += theme_stats["processed"]
        stats["merged"] += theme_stats["merged"]
        stats["new_features"] += theme_stats["new_features"]
        stats["duplicates"] += theme_stats["duplicates"]
        stats["errors"] += theme_stats["errors"]

    return stats


def _process_theme_facts(
    db: Session,
    ai_service,
    workspace_id: UUID,
    theme_id: Optional[UUID],
    facts: List[ExtractedFact],
    similarity_threshold: float,
) -> Dict[str, int]:
    """Process facts for a single theme."""
    stats = {"processed": 0, "merged": 0, "new_features": 0, "duplicates": 0, "errors": 0}

    # Get existing features in this theme
    existing_features = _get_existing_features(db, workspace_id, theme_id)

    # Track content hashes we've seen in this batch for intra-batch deduplication
    seen_hashes: Set[str] = set()

    for fact in facts:
        try:
            # Check for duplicate within batch
            if fact.content_hash and fact.content_hash in seen_hashes:
                fact.aggregation_status = "duplicate"
                fact.aggregated_at = datetime.now(timezone.utc)
                stats["duplicates"] += 1
                stats["processed"] += 1
                continue

            if fact.content_hash:
                seen_hashes.add(fact.content_hash)

            # Check for exact duplicate in database (same hash, already processed)
            existing_dup = db.query(ExtractedFact).filter(
                ExtractedFact.workspace_id == workspace_id,
                ExtractedFact.content_hash == fact.content_hash,
                ExtractedFact.aggregation_status.in_(["aggregated", "merged"]),
                ExtractedFact.id != fact.id,
            ).first()

            if existing_dup:
                fact.aggregation_status = "duplicate"
                fact.aggregated_at = datetime.now(timezone.utc)
                if existing_dup.feature_id:
                    fact.feature_id = existing_dup.feature_id
                stats["duplicates"] += 1
                stats["processed"] += 1
                continue

            # Try to find similar existing feature
            match_result = _find_matching_feature(
                ai_service, fact, existing_features, similarity_threshold
            )

            if match_result["matched"] and match_result.get("feature_id"):
                # Look up the feature from database
                feature = db.query(Feature).filter(
                    Feature.id == UUID(match_result["feature_id"])
                ).first()

                if feature:
                    # Merge with existing feature
                    _merge_fact_into_feature(db, fact, feature)
                    fact.aggregation_status = "merged"
                    fact.feature_id = feature.id
                    fact.aggregated_at = datetime.now(timezone.utc)
                    stats["merged"] += 1
                else:
                    # Feature not found, create new
                    feature = _create_feature_from_fact(db, fact, workspace_id, theme_id)
                    fact.aggregation_status = "aggregated"
                    fact.feature_id = feature.id
                    fact.aggregated_at = datetime.now(timezone.utc)
                    existing_features.append(_feature_to_dict(feature))
                    stats["new_features"] += 1
            else:
                # Create new feature
                feature = _create_feature_from_fact(db, fact, workspace_id, theme_id)
                fact.aggregation_status = "aggregated"
                fact.feature_id = feature.id
                fact.aggregated_at = datetime.now(timezone.utc)
                existing_features.append(_feature_to_dict(feature))
                stats["new_features"] += 1

            stats["processed"] += 1

        except Exception as e:
            logger.error(f"Error processing fact {fact.id}: {e}")
            fact.aggregation_status = "error"
            fact.aggregated_at = datetime.now(timezone.utc)
            stats["errors"] += 1
            stats["processed"] += 1

    return stats


def _get_existing_features(
    db: Session,
    workspace_id: UUID,
    theme_id: Optional[UUID],
) -> List[Dict[str, Any]]:
    """Get existing features for comparison."""
    query = db.query(Feature).filter(
        Feature.workspace_id == workspace_id
    )

    if theme_id:
        query = query.filter(Feature.theme_id == theme_id)

    features = query.order_by(Feature.created_at.desc()).limit(50).all()

    return [_feature_to_dict(f) for f in features]


def _feature_to_dict(feature: Feature) -> Dict[str, Any]:
    """Convert feature to dict for AI comparison."""
    return {
        "id": str(feature.id),
        "name": feature.name,
        "description": feature.description or "",
        "theme_id": str(feature.theme_id) if feature.theme_id else None,
    }


def _find_matching_feature(
    ai_service,
    fact: ExtractedFact,
    existing_features: List[Dict[str, Any]],
    similarity_threshold: float,
) -> Dict[str, Any]:
    """Find a matching feature for the fact."""
    if not existing_features:
        return {"matched": False, "feature": None, "similarity": 0.0}

    try:
        # Use AI to check for aggregation match
        result = ai_service.check_aggregation(
            new_title=fact.feature_title,
            new_description=fact.feature_description or "",
            existing_features=existing_features,
        )

        if result.should_merge and result.similarity_score >= similarity_threshold:
            # Find the matching feature object
            for feature_dict in existing_features:
                if feature_dict["id"] == result.existing_feature_id:
                    return {
                        "matched": True,
                        "feature_id": result.existing_feature_id,
                        "similarity": result.similarity_score,
                    }

        return {"matched": False, "feature": None, "similarity": result.similarity_score}

    except Exception as e:
        logger.warning(f"AI matching failed, treating as new: {e}")
        return {"matched": False, "feature": None, "similarity": 0.0}


def _merge_fact_into_feature(
    db: Session,
    fact: ExtractedFact,
    feature: Feature,
) -> None:
    """Merge an extracted fact into an existing feature."""
    # Increment mention count
    if feature.mention_count is None:
        feature.mention_count = 1
    feature.mention_count += 1

    # Update last mentioned timestamp
    if fact.event_timestamp:
        if feature.last_mentioned_at is None or fact.event_timestamp > feature.last_mentioned_at:
            feature.last_mentioned_at = fact.event_timestamp

    # Add source reference to metadata
    metadata = feature.feature_metadata or {}
    sources = metadata.get("source_facts", [])
    sources.append({
        "fact_id": str(fact.id),
        "source_type": fact.source_type,
        "actor": fact.actor_name,
        "timestamp": fact.event_timestamp.isoformat() if fact.event_timestamp else None,
    })
    metadata["source_facts"] = sources[-20:]  # Keep last 20 sources
    feature.feature_metadata = metadata

    feature.updated_at = datetime.now(timezone.utc)


def _create_feature_from_fact(
    db: Session,
    fact: ExtractedFact,
    workspace_id: UUID,
    theme_id: Optional[UUID],
) -> Feature:
    """Create a new feature from an extracted fact."""
    feature = Feature(
        workspace_id=workspace_id,
        theme_id=theme_id,
        name=fact.feature_title[:255],  # Truncate if too long
        description=fact.feature_description,
        priority=_map_priority_hint(fact.priority_hint),
        urgency=_map_urgency_hint(fact.urgency_hint),
        mention_count=1,
        first_mentioned_at=fact.event_timestamp,
        last_mentioned_at=fact.event_timestamp,
        feature_metadata={
            "source_facts": [{
                "fact_id": str(fact.id),
                "source_type": fact.source_type,
                "actor": fact.actor_name,
                "timestamp": fact.event_timestamp.isoformat() if fact.event_timestamp else None,
            }],
            "problem_statement": fact.problem_statement,
            "desired_outcome": fact.desired_outcome,
            "user_persona": fact.user_persona,
            "use_case": fact.use_case,
            "keywords": fact.keywords,
            "extraction_confidence": fact.extraction_confidence,
        },
    )
    db.add(feature)
    db.flush()  # Get the ID

    return feature


def _map_priority_hint(hint: Optional[str]) -> str:
    """Map AI priority hint to feature priority."""
    if not hint:
        return "medium"
    hint_lower = hint.lower()
    if hint_lower in ("high", "critical", "urgent"):
        return "high"
    elif hint_lower in ("low", "minor", "nice-to-have"):
        return "low"
    return "medium"


def _map_urgency_hint(hint: Optional[str]) -> str:
    """Map AI urgency hint to feature urgency."""
    if not hint:
        return "medium"
    hint_lower = hint.lower()
    if hint_lower in ("high", "critical", "immediate", "asap"):
        return "high"
    elif hint_lower in ("low", "whenever", "no-rush"):
        return "low"
    return "medium"


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.cleanup_old_facts",
    bind=True,
    time_limit=600,
    soft_time_limit=540,
)
def cleanup_old_facts(
    self,
    workspace_id: Optional[str] = None,
    days_to_keep: int = 90,
) -> Dict[str, Any]:
    """
    Clean up old aggregated facts to prevent table bloat.

    Keeps facts for auditing but removes very old processed facts.
    """
    try:
        logger.info(f"🧹 Starting fact cleanup task (keep {days_to_keep} days)")

        with Session(engine) as db:
            if not test_db_connection(db):
                return {"status": "error", "reason": "database_connection_failed"}

            from datetime import timedelta
            cutoff = datetime.now(timezone.utc) - timedelta(days=days_to_keep)

            query = db.query(ExtractedFact).filter(
                ExtractedFact.aggregation_status.in_(["aggregated", "merged", "duplicate"]),
                ExtractedFact.aggregated_at < cutoff,
            )

            if workspace_id:
                query = query.filter(ExtractedFact.workspace_id == UUID(workspace_id))

            deleted_count = query.delete(synchronize_session=False)
            db.commit()

            logger.info(f"✅ Cleaned up {deleted_count} old facts")

            return {
                "status": "success",
                "deleted_count": deleted_count,
            }

    except Exception as e:
        logger.error(f"❌ Fact cleanup failed: {e}")
        return {"status": "error", "reason": str(e)}
    finally:
        cleanup_after_task()


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.cleanup_stale_processing",
    bind=True,
    time_limit=300,
    soft_time_limit=270,
)
def cleanup_stale_processing(
    self,
    stale_minutes: int = 30,
) -> Dict[str, Any]:
    """
    Reset facts stuck in 'processing' status back to 'pending'.

    This handles cases where a worker crashed mid-processing.
    """
    try:
        logger.info(f"🔧 Cleaning up facts stuck in processing > {stale_minutes} minutes")

        with Session(engine) as db:
            if not test_db_connection(db):
                return {"status": "error", "reason": "database_connection_failed"}

            from datetime import timedelta
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_minutes)

            # Reset stale processing facts back to pending
            updated_count = db.query(ExtractedFact).filter(
                ExtractedFact.aggregation_status == "processing",
                ExtractedFact.updated_at < cutoff,
            ).update(
                {"aggregation_status": "pending", "aggregation_run_id": None},
                synchronize_session=False
            )
            db.commit()

            if updated_count > 0:
                logger.info(f"✅ Reset {updated_count} stale facts to pending")

            return {
                "status": "success",
                "reset_count": updated_count,
            }

    except Exception as e:
        logger.error(f"❌ Stale processing cleanup failed: {e}")
        return {"status": "error", "reason": str(e)}
    finally:
        cleanup_after_task()

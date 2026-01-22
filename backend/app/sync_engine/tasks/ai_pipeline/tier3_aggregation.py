"""
Tier-3 Aggregation/Maintenance Tasks

Periodic maintenance tasks for the AI pipeline.

NOTE: In the new schema (v2.0), CustomerAsks are created directly in Tier-2 extraction.
This file now only contains maintenance/cleanup tasks:
- Cleanup old extracted facts
- Reset stale processing states
- Update aggregation statistics

The old aggregation logic (creating Features from ExtractedFacts) is no longer needed
because Tier-2 now directly creates/updates CustomerAsks.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.tasks.celery_app import celery_app
from app.models.extracted_fact import ExtractedFact, AggregationRun
from app.models.customer_ask import CustomerAsk
from app.sync_engine.tasks.base import (
    engine,
    cleanup_after_task,
    test_db_connection,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.aggregate_facts",
    bind=True,
    retry_kwargs={"max_retries": 2},
    default_retry_delay=120,
    time_limit=600,
    soft_time_limit=540,
)
def aggregate_facts(
    self,
    workspace_id: Optional[str] = None,
    batch_size: int = 50,
    similarity_threshold: float = 0.75,
) -> Dict[str, Any]:
    """
    Legacy aggregation task - now just updates statistics.

    In the new schema, CustomerAsks are created directly in Tier-2 extraction.
    This task now only:
    - Marks any remaining 'pending' facts as 'aggregated' (legacy cleanup)
    - Updates aggregation statistics
    """
    try:
        logger.info(f"📊 Starting aggregation stats update (workspace={workspace_id})")

        with Session(engine) as db:
            if not test_db_connection(db):
                logger.error("❌ Database connection failed!")
                return {"status": "error", "reason": "database_connection_failed"}

            # Mark any remaining pending facts as aggregated
            # (In new flow, Tier-2 should already set them to 'aggregated')
            query = db.query(ExtractedFact).filter(
                ExtractedFact.aggregation_status == "pending"
            )
            if workspace_id:
                query = query.filter(ExtractedFact.workspace_id == UUID(workspace_id))

            pending_facts = query.all()
            updated_count = 0

            for fact in pending_facts:
                # Link to customer_ask if available
                if fact.customer_ask_id:
                    fact.aggregation_status = "aggregated"
                    fact.aggregated_at = datetime.now(timezone.utc)
                    updated_count += 1

            if updated_count > 0:
                db.commit()
                logger.info(f"✅ Updated {updated_count} pending facts to aggregated")

            # Calculate statistics
            stats = _calculate_aggregation_stats(db, workspace_id)

            return {
                "status": "success",
                "updated_count": updated_count,
                "stats": stats,
            }

    except Exception as e:
        logger.error(f"❌ Aggregation task failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        cleanup_after_task()


def _calculate_aggregation_stats(
    db: Session,
    workspace_id: Optional[str],
) -> Dict[str, int]:
    """Calculate aggregation statistics."""
    base_query = db.query(ExtractedFact)
    if workspace_id:
        base_query = base_query.filter(ExtractedFact.workspace_id == UUID(workspace_id))

    return {
        "total_facts": base_query.count(),
        "pending": base_query.filter(ExtractedFact.aggregation_status == "pending").count(),
        "aggregated": base_query.filter(ExtractedFact.aggregation_status == "aggregated").count(),
        "error": base_query.filter(ExtractedFact.aggregation_status == "error").count(),
    }


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


@celery_app.task(
    name="app.sync_engine.tasks.ai_pipeline.update_customer_ask_stats",
    bind=True,
    time_limit=300,
    soft_time_limit=270,
)
def update_customer_ask_stats(
    self,
    workspace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Update statistics for CustomerAsks based on linked ExtractedFacts.

    This ensures mention counts and timestamps are accurate.
    """
    try:
        logger.info(f"📊 Updating CustomerAsk statistics (workspace={workspace_id})")

        with Session(engine) as db:
            if not test_db_connection(db):
                return {"status": "error", "reason": "database_connection_failed"}

            # Get all customer_asks that need stat updates
            query = db.query(CustomerAsk)
            if workspace_id:
                query = query.filter(CustomerAsk.workspace_id == UUID(workspace_id))

            customer_asks = query.all()
            updated_count = 0

            for ca in customer_asks:
                # Count linked facts
                fact_count = db.query(func.count(ExtractedFact.id)).filter(
                    ExtractedFact.customer_ask_id == ca.id
                ).scalar()

                # Get first and last mention timestamps
                timestamps = db.query(
                    func.min(ExtractedFact.event_timestamp),
                    func.max(ExtractedFact.event_timestamp),
                ).filter(
                    ExtractedFact.customer_ask_id == ca.id,
                    ExtractedFact.event_timestamp.isnot(None),
                ).first()

                # Update if different
                if fact_count and (ca.mention_count != fact_count):
                    ca.mention_count = fact_count
                    updated_count += 1

                if timestamps[0] and (ca.first_mentioned_at is None or timestamps[0] < ca.first_mentioned_at):
                    ca.first_mentioned_at = timestamps[0]

                if timestamps[1] and (ca.last_mentioned_at is None or timestamps[1] > ca.last_mentioned_at):
                    ca.last_mentioned_at = timestamps[1]

            if updated_count > 0:
                db.commit()
                logger.info(f"✅ Updated stats for {updated_count} customer_asks")

            return {
                "status": "success",
                "customer_asks_updated": updated_count,
            }

    except Exception as e:
        logger.error(f"❌ CustomerAsk stats update failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}
    finally:
        cleanup_after_task()

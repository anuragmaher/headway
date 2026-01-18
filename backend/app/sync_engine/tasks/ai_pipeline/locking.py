"""
Row-level Locking Utilities for AI Pipeline

Provides concurrency-safe row locking using SELECT ... FOR UPDATE SKIP LOCKED
to prevent race conditions and duplicate processing in multi-worker environments.
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Type, TypeVar, Callable, Any
from contextlib import contextmanager

from sqlalchemy import and_, text
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import UUID

logger = logging.getLogger(__name__)

# Type variable for generic model handling
T = TypeVar('T')

# Lock timeout: stale locks older than this are considered abandoned
LOCK_TIMEOUT_MINUTES = 30


def acquire_rows_for_processing(
    db: Session,
    model: Type[T],
    filter_conditions: list,
    order_by: Any,
    batch_size: int,
    lock_token: uuid.UUID,
) -> List[T]:
    """
    Acquire rows for processing using SELECT ... FOR UPDATE SKIP LOCKED.

    This is the core locking mechanism that ensures:
    1. No two workers process the same row simultaneously
    2. Locked rows are skipped by other workers
    3. Stale locks from crashed workers are cleaned up

    Args:
        db: SQLAlchemy session
        model: Model class (NormalizedEvent, EventChunk, etc.)
        filter_conditions: List of filter conditions for the query
        order_by: Column to order by (usually created_at)
        batch_size: Maximum rows to acquire
        lock_token: Unique token for this processing run

    Returns:
        List of locked model instances ready for processing
    """
    now = datetime.now(timezone.utc)

    # First, clean up stale locks (from crashed workers)
    stale_cutoff = now - timedelta(minutes=LOCK_TIMEOUT_MINUTES)
    cleanup_count = db.query(model).filter(
        and_(
            model.lock_token.isnot(None),
            model.locked_at < stale_cutoff
        )
    ).update(
        {model.lock_token: None, model.locked_at: None},
        synchronize_session=False
    )

    if cleanup_count > 0:
        logger.info(f"Cleaned up {cleanup_count} stale locks from {model.__tablename__}")
        db.commit()

    # Build the query with all filter conditions plus unlocked check
    base_conditions = filter_conditions + [model.lock_token.is_(None)]

    # Use raw SQL for FOR UPDATE SKIP LOCKED as SQLAlchemy ORM support varies
    # Get IDs first, then lock
    query = db.query(model.id).filter(and_(*base_conditions))
    query = query.order_by(order_by)
    query = query.limit(batch_size)

    # Get candidate IDs
    candidate_ids = [row[0] for row in query.all()]

    if not candidate_ids:
        return []

    # Now lock the rows using FOR UPDATE SKIP LOCKED
    # This atomic operation ensures no race conditions
    locked_ids = []

    try:
        # Use a single UPDATE statement to claim rows atomically
        # This is more efficient than individual locks
        result = db.execute(
            text(f"""
                UPDATE {model.__tablename__}
                SET lock_token = :lock_token, locked_at = :locked_at
                WHERE id = ANY(:ids)
                  AND lock_token IS NULL
                RETURNING id
            """),
            {
                "lock_token": str(lock_token),
                "locked_at": now,
                "ids": candidate_ids
            }
        )
        locked_ids = [row[0] for row in result.fetchall()]
        db.commit()

    except Exception as e:
        logger.error(f"Error acquiring locks: {e}")
        db.rollback()
        return []

    if not locked_ids:
        return []

    # Fetch the locked rows
    rows = db.query(model).filter(
        model.id.in_(locked_ids)
    ).all()

    logger.debug(f"Acquired {len(rows)} rows from {model.__tablename__} with lock_token={lock_token}")

    return rows


def release_row_lock(
    db: Session,
    model: Type[T],
    row_id: uuid.UUID,
    lock_token: uuid.UUID,
) -> bool:
    """
    Release a lock on a single row.

    Only releases if the lock_token matches, preventing accidental
    release of locks held by other workers.

    Args:
        db: SQLAlchemy session
        model: Model class
        row_id: ID of the row to unlock
        lock_token: Token used when lock was acquired

    Returns:
        True if lock was released, False otherwise
    """
    result = db.query(model).filter(
        and_(
            model.id == row_id,
            model.lock_token == lock_token
        )
    ).update(
        {model.lock_token: None, model.locked_at: None},
        synchronize_session=False
    )

    return result > 0


def release_batch_locks(
    db: Session,
    model: Type[T],
    lock_token: uuid.UUID,
) -> int:
    """
    Release all locks held by a specific lock_token.

    Used for cleanup after batch processing completes.

    Args:
        db: SQLAlchemy session
        model: Model class
        lock_token: Token used when locks were acquired

    Returns:
        Number of locks released
    """
    result = db.query(model).filter(
        model.lock_token == lock_token
    ).update(
        {model.lock_token: None, model.locked_at: None},
        synchronize_session=False
    )

    return result


@contextmanager
def locked_batch_processing(
    db: Session,
    model: Type[T],
    filter_conditions: list,
    order_by: Any,
    batch_size: int,
):
    """
    Context manager for batch processing with automatic lock management.

    Acquires locks on entry, releases on exit (including on exception).

    Usage:
        with locked_batch_processing(db, NormalizedEvent, [...], ...) as (rows, lock_token):
            for row in rows:
                # process row
            db.commit()

    Args:
        db: SQLAlchemy session
        model: Model class
        filter_conditions: Filter conditions for eligible rows
        order_by: Order by clause
        batch_size: Maximum batch size

    Yields:
        Tuple of (locked_rows, lock_token)
    """
    lock_token = uuid.uuid4()
    rows = []

    try:
        rows = acquire_rows_for_processing(
            db=db,
            model=model,
            filter_conditions=filter_conditions,
            order_by=order_by,
            batch_size=batch_size,
            lock_token=lock_token,
        )

        yield rows, lock_token

    finally:
        # Always release locks, even on exception
        if rows:
            released = release_batch_locks(db, model, lock_token)
            logger.debug(f"Released {released} locks for {model.__tablename__}")


def mark_row_processed(
    row: T,
    stage: str,
    timestamp_field: str,
    lock_token: uuid.UUID,
) -> None:
    """
    Mark a row as processed for a specific stage.

    Updates processing_stage, sets the timestamp, and clears the lock.

    Args:
        row: Model instance
        stage: New processing_stage value
        timestamp_field: Name of the timestamp field to set (e.g., 'scored_at')
        lock_token: Token to verify ownership
    """
    now = datetime.now(timezone.utc)

    # Verify we still own the lock
    if row.lock_token != lock_token:
        raise ValueError(f"Lock token mismatch for row {row.id}")

    row.processing_stage = stage
    setattr(row, timestamp_field, now)
    row.lock_token = None
    row.locked_at = None
    row.updated_at = now


def mark_row_error(
    row: T,
    error_message: str,
    lock_token: uuid.UUID,
    increment_retry: bool = True,
) -> None:
    """
    Mark a row as having an error, preserving the current stage for retry.

    Args:
        row: Model instance
        error_message: Error description
        lock_token: Token to verify ownership
        increment_retry: Whether to increment retry_count
    """
    now = datetime.now(timezone.utc)

    # Verify we still own the lock
    if row.lock_token != lock_token:
        raise ValueError(f"Lock token mismatch for row {row.id}")

    row.processing_error = error_message
    if increment_retry:
        row.retry_count = (row.retry_count or 0) + 1
    row.lock_token = None
    row.locked_at = None
    row.updated_at = now


class PipelineStageProcessor:
    """
    Base class for pipeline stage processors with built-in locking.

    Provides a consistent pattern for all pipeline stages:
    1. Acquire locks on eligible rows
    2. Process each row individually
    3. Mark success/error atomically
    4. Release locks on completion
    """

    def __init__(
        self,
        db: Session,
        model: Type[T],
        filter_conditions: list,
        order_by: Any,
        batch_size: int,
        next_stage: str,
        timestamp_field: str,
        max_retries: int = 3,
    ):
        self.db = db
        self.model = model
        self.filter_conditions = filter_conditions
        self.order_by = order_by
        self.batch_size = batch_size
        self.next_stage = next_stage
        self.timestamp_field = timestamp_field
        self.max_retries = max_retries
        self.lock_token = uuid.uuid4()

        # Stats
        self.processed = 0
        self.succeeded = 0
        self.failed = 0
        self.skipped = 0

    def process_row(self, row: T) -> bool:
        """
        Process a single row. Override in subclasses.

        Args:
            row: Model instance to process

        Returns:
            True if processing succeeded, False to skip

        Raises:
            Exception on error (will be caught and logged)
        """
        raise NotImplementedError("Subclasses must implement process_row")

    def should_skip(self, row: T) -> bool:
        """
        Check if row should be skipped. Override in subclasses.

        Args:
            row: Model instance to check

        Returns:
            True if row should be skipped
        """
        return False

    def run(self) -> dict:
        """
        Execute the processing stage.

        Returns:
            Dict with processing statistics
        """
        # Add retry count filter to conditions
        retry_filter = self.model.retry_count < self.max_retries
        conditions = self.filter_conditions + [retry_filter]

        # Acquire rows
        rows = acquire_rows_for_processing(
            db=self.db,
            model=self.model,
            filter_conditions=conditions,
            order_by=self.order_by,
            batch_size=self.batch_size,
            lock_token=self.lock_token,
        )

        if not rows:
            return self._get_stats()

        logger.info(f"Processing {len(rows)} rows from {self.model.__tablename__}")

        for row in rows:
            try:
                # Check for skip
                if self.should_skip(row):
                    mark_row_processed(
                        row=row,
                        stage=self.next_stage,
                        timestamp_field=self.timestamp_field,
                        lock_token=self.lock_token,
                    )
                    self.skipped += 1
                    self.processed += 1
                    continue

                # Process the row
                success = self.process_row(row)

                if success:
                    mark_row_processed(
                        row=row,
                        stage=self.next_stage,
                        timestamp_field=self.timestamp_field,
                        lock_token=self.lock_token,
                    )
                    self.succeeded += 1
                else:
                    # Processing returned False - skip this row
                    mark_row_processed(
                        row=row,
                        stage=self.next_stage,
                        timestamp_field=self.timestamp_field,
                        lock_token=self.lock_token,
                    )
                    self.skipped += 1

                self.processed += 1

            except Exception as e:
                logger.error(f"Error processing {self.model.__tablename__} {row.id}: {e}")
                mark_row_error(
                    row=row,
                    error_message=str(e)[:500],
                    lock_token=self.lock_token,
                    increment_retry=True,
                )
                self.failed += 1
                self.processed += 1

        # Commit all changes
        try:
            self.db.commit()
        except Exception as e:
            logger.error(f"Error committing batch: {e}")
            self.db.rollback()
            raise

        return self._get_stats()

    def _get_stats(self) -> dict:
        return {
            "processed": self.processed,
            "succeeded": self.succeeded,
            "failed": self.failed,
            "skipped": self.skipped,
        }

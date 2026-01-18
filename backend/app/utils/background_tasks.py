"""
Background task utilities for memory-efficient async operations.

This module provides a bounded ThreadPoolExecutor for fire-and-forget tasks
like notifications, preventing unlimited thread creation under high load.
"""

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Any

logger = logging.getLogger(__name__)

# Bounded thread pool for background tasks (e.g., Slack notifications)
# Max 5 workers prevents unbounded thread creation under high load
_notification_executor: ThreadPoolExecutor | None = None
MAX_NOTIFICATION_WORKERS = 5


def get_notification_executor() -> ThreadPoolExecutor:
    """
    Get or create the shared notification executor.

    Uses a bounded ThreadPoolExecutor to prevent memory issues
    from creating unlimited daemon threads.

    Returns:
        ThreadPoolExecutor with bounded worker pool
    """
    global _notification_executor
    if _notification_executor is None:
        _notification_executor = ThreadPoolExecutor(
            max_workers=MAX_NOTIFICATION_WORKERS,
            thread_name_prefix="notification_"
        )
    return _notification_executor


def submit_notification_task(func: Callable[..., Any], *args, **kwargs) -> None:
    """
    Submit a notification task to the bounded executor.

    This is a fire-and-forget operation - errors are logged but not raised.
    If the executor is full, the task will queue and execute when a worker
    becomes available.

    Args:
        func: The function to execute
        *args: Positional arguments to pass to func
        **kwargs: Keyword arguments to pass to func
    """
    try:
        executor = get_notification_executor()
        future = executor.submit(func, *args, **kwargs)
        # Add callback to log any errors
        future.add_done_callback(_handle_notification_result)
    except Exception as e:
        logger.error(f"Failed to submit notification task: {e}")


def _handle_notification_result(future) -> None:
    """Handle completion of a notification task, logging any errors."""
    try:
        # This will raise if the task raised an exception
        future.result()
    except Exception as e:
        logger.error(f"Notification task failed: {e}")


def shutdown_notification_executor(wait: bool = False) -> None:
    """
    Shutdown the notification executor.

    Call this during application shutdown to clean up threads.

    Args:
        wait: If True, wait for pending tasks to complete
    """
    global _notification_executor
    if _notification_executor is not None:
        logger.info("Shutting down notification executor...")
        _notification_executor.shutdown(wait=wait)
        _notification_executor = None

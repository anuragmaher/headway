"""
Cache Service - Redis-based caching for sync items and other data.

Provides a production-ready caching layer with:
- TTL-based expiration
- JSON serialization
- Graceful degradation when Redis is unavailable
- Namespace-based key management
"""

import json
import logging
from typing import Any, Optional, List, Dict
from datetime import timedelta

import redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Cache TTL constants
SYNC_ITEMS_TTL = timedelta(hours=24)  # Sync items cached for 24 hours
SYNC_STATUS_TTL = timedelta(minutes=5)  # Sync status cached briefly
DEFAULT_TTL = timedelta(hours=1)


class CacheService:
    """Redis-based caching service with graceful degradation."""

    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._connected = False
        self._connect()

    def _connect(self) -> None:
        """Establish Redis connection with error handling."""
        try:
            self._client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            # Test connection
            self._client.ping()
            self._connected = True
            logger.info("Redis cache connected successfully")
        except RedisError as e:
            logger.warning(f"Redis connection failed, caching disabled: {e}")
            self._connected = False
            self._client = None

    def _ensure_connection(self) -> bool:
        """Ensure Redis connection is active, attempt reconnect if needed."""
        if self._connected and self._client:
            try:
                self._client.ping()
                return True
            except RedisError:
                self._connected = False

        if not self._connected:
            self._connect()

        return self._connected

    def _make_key(self, namespace: str, *parts: str) -> str:
        """Create a namespaced cache key."""
        return f"headway:{namespace}:{':'.join(str(p) for p in parts)}"

    def get(self, namespace: str, *key_parts: str) -> Optional[Any]:
        """
        Get a value from cache.

        Args:
            namespace: Cache namespace (e.g., 'sync_items', 'sync_status')
            key_parts: Parts of the cache key

        Returns:
            Cached value or None if not found/error
        """
        if not self._ensure_connection():
            return None

        try:
            key = self._make_key(namespace, *key_parts)
            data = self._client.get(key)
            if data:
                return json.loads(data)
            return None
        except (RedisError, json.JSONDecodeError) as e:
            logger.warning(f"Cache get failed for {namespace}: {e}")
            return None

    def set(
        self,
        namespace: str,
        *key_parts: str,
        value: Any,
        ttl: Optional[timedelta] = None
    ) -> bool:
        """
        Set a value in cache.

        Args:
            namespace: Cache namespace
            key_parts: Parts of the cache key
            value: Value to cache (must be JSON serializable)
            ttl: Time-to-live (defaults to DEFAULT_TTL)

        Returns:
            True if cached successfully, False otherwise
        """
        if not self._ensure_connection():
            return False

        try:
            key = self._make_key(namespace, *key_parts)
            ttl = ttl or DEFAULT_TTL
            data = json.dumps(value, default=str)
            self._client.setex(key, int(ttl.total_seconds()), data)
            return True
        except (RedisError, TypeError) as e:
            logger.warning(f"Cache set failed for {namespace}: {e}")
            return False

    def delete(self, namespace: str, *key_parts: str) -> bool:
        """Delete a key from cache."""
        if not self._ensure_connection():
            return False

        try:
            key = self._make_key(namespace, *key_parts)
            self._client.delete(key)
            return True
        except RedisError as e:
            logger.warning(f"Cache delete failed for {namespace}: {e}")
            return False

    def delete_pattern(self, namespace: str, pattern: str) -> int:
        """Delete all keys matching a pattern in a namespace."""
        if not self._ensure_connection():
            return 0

        try:
            full_pattern = self._make_key(namespace, pattern)
            keys = self._client.keys(full_pattern)
            if keys:
                return self._client.delete(*keys)
            return 0
        except RedisError as e:
            logger.warning(f"Cache delete_pattern failed: {e}")
            return 0

    def get_list(self, namespace: str, *key_parts: str) -> Optional[List[Any]]:
        """Get a list from cache."""
        return self.get(namespace, *key_parts)

    def set_list(
        self,
        namespace: str,
        *key_parts: str,
        value: List[Any],
        ttl: Optional[timedelta] = None
    ) -> bool:
        """Set a list in cache."""
        return self.set(namespace, *key_parts, value=value, ttl=ttl)

    def invalidate_sync_cache(self, workspace_id: str, sync_id: str) -> bool:
        """Invalidate cache for a specific sync."""
        return self.delete("sync_items", workspace_id, sync_id, "*")

    def invalidate_workspace_cache(self, workspace_id: str) -> int:
        """Invalidate all cache for a workspace."""
        count = 0
        count += self.delete_pattern("sync_items", f"{workspace_id}:*")
        count += self.delete_pattern("sync_status", f"{workspace_id}:*")
        return count


# Singleton instance
_cache_service: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """Get or create the cache service singleton."""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service


# Convenience functions for sync items caching
def cache_sync_items(
    workspace_id: str,
    sync_id: str,
    page: int,
    items: Dict[str, Any]
) -> bool:
    """Cache sync items for a specific page."""
    cache = get_cache_service()
    return cache.set(
        "sync_items",
        workspace_id,
        sync_id,
        str(page),
        value=items,
        ttl=SYNC_ITEMS_TTL
    )


def get_cached_sync_items(
    workspace_id: str,
    sync_id: str,
    page: int
) -> Optional[Dict[str, Any]]:
    """Get cached sync items for a specific page."""
    cache = get_cache_service()
    return cache.get("sync_items", workspace_id, sync_id, str(page))


def invalidate_sync_items_cache(workspace_id: str, sync_id: str) -> bool:
    """Invalidate all cached pages for a sync."""
    cache = get_cache_service()
    return cache.delete_pattern("sync_items", f"{workspace_id}:{sync_id}:*") > 0

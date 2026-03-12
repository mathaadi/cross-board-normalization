"""Redis Caching Layer — optional cache for board_statistics lookups.

If REDIS_URL is not set or Redis is unreachable, all operations gracefully
degrade to no-ops so the application works identically without Redis.
"""

import os
import json
import logging

logger = logging.getLogger(__name__)

_redis_client = None
_redis_checked = False

CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "3600"))  # 1 hour default


def get_redis_client():
    """Lazy-initialise and return a Redis client (or None if unavailable)."""
    global _redis_client, _redis_checked

    if _redis_checked:
        return _redis_client

    _redis_checked = True
    redis_url = os.getenv("REDIS_URL")

    if not redis_url:
        logger.info("REDIS_URL not set — caching disabled.")
        return None

    try:
        import redis
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        _redis_client.ping()
        logger.info("Redis connected successfully.")
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}) — caching disabled.")
        _redis_client = None

    return _redis_client


def _cache_key(board_id: int, subject: str, year_bucket_id: int) -> str:
    """Build a deterministic cache key for a board statistic."""
    return f"board_stat:{board_id}:{subject}:{year_bucket_id}"


def get_cached_statistic(board_id: int, subject: str, year_bucket_id: int) -> dict | None:
    """Retrieve a cached board statistic, or None on miss / Redis unavailable."""
    client = get_redis_client()
    if client is None:
        return None

    try:
        key = _cache_key(board_id, subject, year_bucket_id)
        data = client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.debug(f"Cache get error: {e}")

    return None


def set_cached_statistic(
    board_id: int,
    subject: str,
    year_bucket_id: int,
    stat_data: dict,
) -> None:
    """Store a board statistic in Redis with TTL. No-op if Redis unavailable."""
    client = get_redis_client()
    if client is None:
        return

    try:
        key = _cache_key(board_id, subject, year_bucket_id)
        client.setex(key, CACHE_TTL, json.dumps(stat_data))
    except Exception as e:
        logger.debug(f"Cache set error: {e}")


def invalidate_statistic(board_id: int, subject: str, year_bucket_id: int) -> None:
    """Remove a specific statistic from cache (e.g. after update). No-op if Redis unavailable."""
    client = get_redis_client()
    if client is None:
        return

    try:
        key = _cache_key(board_id, subject, year_bucket_id)
        client.delete(key)
    except Exception as e:
        logger.debug(f"Cache invalidate error: {e}")


def flush_all_statistics() -> int:
    """Remove all cached board statistics. Returns count deleted, 0 if Redis unavailable."""
    client = get_redis_client()
    if client is None:
        return 0

    try:
        keys = client.keys("board_stat:*")
        if keys:
            client.delete(*keys)
        return len(keys)
    except Exception as e:
        logger.debug(f"Cache flush error: {e}")
        return 0

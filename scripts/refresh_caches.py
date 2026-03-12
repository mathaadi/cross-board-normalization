"""Batch job: refresh / warm the Redis cache with all board_statistics.

Run manually or via cron:
    python scripts/refresh_caches.py

Schedule hourly with:
    0 * * * * cd /path/to/project && python scripts/refresh_caches.py
"""

import sys
import os

# Add project root to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, engine, Base
from app.models.models import Board, YearBucket, BoardStatistic
from app.services.cache import (
    get_redis_client,
    set_cached_statistic,
    flush_all_statistics,
)


def warm_cache(db):
    """Pre-load all board statistics into Redis cache."""
    client = get_redis_client()
    if client is None:
        print("  ❌ Redis is not available. Set REDIS_URL environment variable.")
        print("     Example: REDIS_URL=redis://localhost:6379/0 python scripts/refresh_caches.py")
        return

    # Flush existing cached statistics first
    flushed = flush_all_statistics()
    print(f"  🗑  Flushed {flushed} existing cached entries.")

    # Load all statistics
    stats = db.query(BoardStatistic).all()
    cached = 0

    for stat in stats:
        stat_data = {
            "mean_score": stat.mean_score,
            "std_dev": stat.std_dev,
            "sample_size": stat.sample_size,
            "m2": stat.m2,
        }
        set_cached_statistic(
            board_id=stat.board_id,
            subject=stat.subject,
            year_bucket_id=stat.year_bucket_id,
            stat_data=stat_data,
        )
        cached += 1

    print(f"  ✅ Cached {cached} board statistic entries in Redis.")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("\n🔄 Refreshing Redis cache...\n")
        warm_cache(db)
        print()
    finally:
        db.close()


if __name__ == "__main__":
    main()

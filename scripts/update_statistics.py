"""Batch job: full recomputation of board_statistics.

Run manually or via cron:
    python scripts/update_statistics.py

Schedule daily with:
    0 2 * * * cd /path/to/project && python scripts/update_statistics.py
"""

import sys
import os

# Add project root to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, engine, Base
from app.services.statistics_engine import recompute_all_statistics


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        count = recompute_all_statistics(db)
        print(f"[update_statistics] Recomputed {count} statistic group(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()

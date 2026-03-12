"""Batch job: validate dataset integrity.

Run manually or via cron:
    python scripts/validate_datasets.py

Schedule weekly with:
    0 3 * * 0 cd /path/to/project && python scripts/validate_datasets.py
"""

import sys
import os

# Add project root to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, engine, Base
from app.models.models import Board, YearBucket, StudentScore, BoardStatistic


def validate(db):
    """Run all validation checks and print a report."""
    issues = []

    # ── 1. Orphaned scores: board_id not in boards table ─────────
    board_ids = {b.board_id for b in db.query(Board).all()}
    orphaned_board = (
        db.query(StudentScore)
        .filter(~StudentScore.board_id.in_(board_ids))
        .count()
    )
    if orphaned_board:
        issues.append(f"  ⚠  {orphaned_board} score(s) reference non-existent board_id")

    # ── 2. Orphaned scores: year_bucket_id not in year_buckets ───
    bucket_ids = {yb.bucket_id for yb in db.query(YearBucket).all()}
    orphaned_bucket = (
        db.query(StudentScore)
        .filter(
            StudentScore.year_bucket_id.isnot(None),
            ~StudentScore.year_bucket_id.in_(bucket_ids),
        )
        .count()
    )
    if orphaned_bucket:
        issues.append(f"  ⚠  {orphaned_bucket} score(s) reference non-existent year_bucket_id")

    # ── 3. Null year_bucket_id ───────────────────────────────────
    null_bucket = (
        db.query(StudentScore)
        .filter(StudentScore.year_bucket_id.is_(None))
        .count()
    )
    if null_bucket:
        issues.append(f"  ⚠  {null_bucket} score(s) have NULL year_bucket_id")

    # ── 4. Invalid percentage scores ─────────────────────────────
    bad_pct = (
        db.query(StudentScore)
        .filter(
            (StudentScore.percentage_score < 0) | (StudentScore.percentage_score > 100)
        )
        .count()
    )
    if bad_pct:
        issues.append(f"  ⚠  {bad_pct} score(s) have percentage outside 0–100 range")

    # ── 5. Marks exceeding max_marks ─────────────────────────────
    over_max = (
        db.query(StudentScore)
        .filter(StudentScore.marks > StudentScore.max_marks)
        .count()
    )
    if over_max:
        issues.append(f"  ⚠  {over_max} score(s) have marks > max_marks")

    # ── 6. Negative marks or max_marks ───────────────────────────
    neg_marks = (
        db.query(StudentScore)
        .filter((StudentScore.marks < 0) | (StudentScore.max_marks <= 0))
        .count()
    )
    if neg_marks:
        issues.append(f"  ⚠  {neg_marks} score(s) have negative marks or non-positive max_marks")

    # ── 7. Board statistics with sample_size 0 ───────────────────
    zero_stats = (
        db.query(BoardStatistic)
        .filter(BoardStatistic.sample_size == 0)
        .count()
    )
    if zero_stats:
        issues.append(f"  ⚠  {zero_stats} board_statistics row(s) have sample_size = 0")

    # ── Report ───────────────────────────────────────────────────
    total_scores = db.query(StudentScore).count()
    total_stats = db.query(BoardStatistic).count()

    print("=" * 60)
    print("  Dataset Validation Report")
    print("=" * 60)
    print(f"  Total student scores : {total_scores}")
    print(f"  Total board stats    : {total_stats}")
    print(f"  Boards               : {len(board_ids)}")
    print(f"  Year buckets         : {len(bucket_ids)}")
    print("-" * 60)

    if issues:
        print(f"  Found {len(issues)} issue(s):\n")
        for issue in issues:
            print(issue)
    else:
        print("  ✅ All checks passed — dataset is clean!")

    print("=" * 60)
    return len(issues)


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        validate(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()

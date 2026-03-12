"""Statistics Engine — batch and incremental statistics computation.

Batch mode:  groupby(board, subject, year_bucket) via Pandas.
Incremental: Welford's online algorithm for running mean/variance.
"""

import math
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy.orm import Session

from app.models.models import StudentScore, BoardStatistic


# ── Incremental (Welford's Algorithm) ───────────────────────────

def update_statistics_incremental(
    db: Session,
    board_id: int,
    subject: str,
    year_bucket_id: int,
    new_score: float,
) -> BoardStatistic:
    """Update statistics for a given (board, subject, year_bucket) group
    using Welford's online algorithm — no full recomputation needed."""

    stat = (
        db.query(BoardStatistic)
        .filter_by(board_id=board_id, subject=subject, year_bucket_id=year_bucket_id)
        .first()
    )

    if stat is None:
        # First observation for this group
        stat = BoardStatistic(
            board_id=board_id,
            subject=subject,
            year_bucket_id=year_bucket_id,
            mean_score=new_score,
            std_dev=0.0,
            sample_size=1,
            m2=0.0,
            last_updated=datetime.now(timezone.utc),
        )
        db.add(stat)
    else:
        n = stat.sample_size + 1
        old_mean = stat.mean_score
        new_mean = old_mean + (new_score - old_mean) / n
        new_m2 = stat.m2 + (new_score - old_mean) * (new_score - new_mean)

        stat.mean_score = new_mean
        stat.m2 = new_m2
        stat.std_dev = math.sqrt(new_m2 / n) if n > 1 else 0.0
        stat.sample_size = n
        stat.last_updated = datetime.now(timezone.utc)

    db.commit()
    db.refresh(stat)
    return stat


# ── Batch Recomputation ─────────────────────────────────────────

def recompute_all_statistics(db: Session) -> int:
    """Full batch recomputation of board_statistics from student_scores.
    Returns the number of statistic rows created/updated."""

    rows = db.query(StudentScore).all()
    if not rows:
        return 0

    data = [
        {
            "board_id": r.board_id,
            "subject": r.subject,
            "year_bucket_id": r.year_bucket_id,
            "percentage_score": r.percentage_score,
        }
        for r in rows
        if r.percentage_score is not None and r.year_bucket_id is not None
    ]

    if not data:
        return 0

    df = pd.DataFrame(data)
    grouped = df.groupby(["board_id", "subject", "year_bucket_id"])["percentage_score"]
    stats = grouped.agg(["mean", "std", "count"]).reset_index()
    stats.columns = ["board_id", "subject", "year_bucket_id", "mean_score", "std_dev", "sample_size"]
    stats["std_dev"] = stats["std_dev"].fillna(0.0)

    # Also compute m2 for each group so incremental updates work after batch
    # m2 = sum((x - mean)^2) = std_dev^2 * n  (population variance * n)
    stats["m2"] = stats["std_dev"] ** 2 * stats["sample_size"]

    count = 0
    now = datetime.now(timezone.utc)
    for _, row in stats.iterrows():
        existing = (
            db.query(BoardStatistic)
            .filter_by(
                board_id=int(row["board_id"]),
                subject=row["subject"],
                year_bucket_id=int(row["year_bucket_id"]),
            )
            .first()
        )
        if existing:
            existing.mean_score = float(row["mean_score"])
            existing.std_dev = float(row["std_dev"])
            existing.sample_size = int(row["sample_size"])
            existing.m2 = float(row["m2"])
            existing.last_updated = now
        else:
            db.add(
                BoardStatistic(
                    board_id=int(row["board_id"]),
                    subject=row["subject"],
                    year_bucket_id=int(row["year_bucket_id"]),
                    mean_score=float(row["mean_score"]),
                    std_dev=float(row["std_dev"]),
                    sample_size=int(row["sample_size"]),
                    m2=float(row["m2"]),
                    last_updated=now,
                )
            )
        count += 1

    db.commit()
    return count

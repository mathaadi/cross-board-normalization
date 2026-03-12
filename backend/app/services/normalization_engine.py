"""Normalization Engine — Z-score, Universal Score, and Percentile."""

from scipy.stats import norm
from sqlalchemy.orm import Session

from app.models.models import Board, BoardStatistic, YearBucket
from app.services.year_bucket_service import assign_year_bucket
from app.services.feature_engineering import compute_percentage
from app.services.cache import get_cached_statistic, set_cached_statistic


class NormalizationResult:
    def __init__(
        self,
        percentage_score: float,
        z_score: float,
        normalized_score: float,
        percentile: float,
        year_bucket_label: str,
        mean_used: float,
        std_dev_used: float,
        sample_size: int,
    ):
        self.percentage_score = percentage_score
        self.z_score = z_score
        self.normalized_score = normalized_score
        self.percentile = percentile
        self.year_bucket_label = year_bucket_label
        self.mean_used = mean_used
        self.std_dev_used = std_dev_used
        self.sample_size = sample_size


def normalize_score(
    db: Session,
    board_name: str,
    subject: str,
    year: int,
    marks: float,
    max_marks: float,
) -> NormalizationResult:
    """Full normalization pipeline: percentage → Z-score → universal → percentile."""

    # 1. Look up board
    board = db.query(Board).filter(Board.board_name == board_name).first()
    if not board:
        raise ValueError(f"Board '{board_name}' not found")

    # 2. Assign year bucket
    bucket = assign_year_bucket(db, year)
    if not bucket:
        raise ValueError(f"No year bucket covers year {year}")

    # 3. Percentage
    pct = compute_percentage(marks, max_marks)

    # 4. Fetch statistics (try cache first, then DB)
    cached = get_cached_statistic(board.board_id, subject, bucket.bucket_id)
    if cached and cached.get("sample_size", 0) >= 2:
        # Use cached values — build a lightweight object
        class _CachedStat:
            mean_score = cached["mean_score"]
            std_dev = cached["std_dev"]
            sample_size = cached["sample_size"]
        stat = _CachedStat()
    else:
        stat = (
            db.query(BoardStatistic)
            .filter_by(board_id=board.board_id, subject=subject, year_bucket_id=bucket.bucket_id)
            .first()
        )
        # Store in cache for next time
        if stat:
            set_cached_statistic(
                board.board_id, subject, bucket.bucket_id,
                {"mean_score": stat.mean_score, "std_dev": stat.std_dev,
                 "sample_size": stat.sample_size, "m2": stat.m2},
            )

    if not stat or stat.sample_size < 2:
        # Not enough data — return raw percentage scaled to 0-100
        return NormalizationResult(
            percentage_score=pct,
            z_score=0.0,
            normalized_score=50.0,
            percentile=50.0,
            year_bucket_label=bucket.bucket_label,
            mean_used=pct,
            std_dev_used=0.0,
            sample_size=stat.sample_size if stat else 0,
        )

    # 5. Z-score
    std = stat.std_dev if stat.std_dev > 0 else 1.0
    z = (pct - stat.mean_score) / std

    # 6. Universal score (mean=50, std=10)
    universal = 50 + 10 * z

    # 7. Percentile via CDF
    percentile = round(float(norm.cdf(z)) * 100, 2)

    return NormalizationResult(
        percentage_score=pct,
        z_score=round(z, 4),
        normalized_score=round(universal, 2),
        percentile=percentile,
        year_bucket_label=bucket.bucket_label,
        mean_used=round(stat.mean_score, 2),
        std_dev_used=round(stat.std_dev, 2),
        sample_size=stat.sample_size,
    )

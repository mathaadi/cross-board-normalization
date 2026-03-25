"""Statistics Graph Service — Dynamic Aggregation for distribution and trends.

Computes real-time data for:
1. Trends: average score grouped by year.
2. Distribution: histogram of percentage scores in 10-point buckets.

Strictly additive — does not modify any existing logic.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.models import StudentScore, Board

def get_dynamic_board_stats(db: Session, board_name: str, subject: str) -> dict:
    """Computes trends and score distribution for a specific board and subject."""
    
    # Fetch all relevant scores to compute exact distribution and trends
    # (Doing bucketing in Python ensures cross-database compatibility)
    scores_query = (
        db.query(StudentScore.exam_year, StudentScore.percentage_score)
        .join(Board, StudentScore.board_id == Board.board_id)
        .filter(
            Board.board_name == board_name,
            StudentScore.subject == subject,
            StudentScore.percentage_score.isnot(None)
        )
        .all()
    )

    if not scores_query:
        return {"trend": [], "distribution": []}

    trends_dict = {}
    distribution_buckets = {f"{i}-{i+10}": 0 for i in range(0, 100, 10)}
    
    for row in scores_query:
        year = row.exam_year
        score = row.percentage_score
        
        # ── Trends Aggregation ──
        if year not in trends_dict:
            trends_dict[year] = {"sum": 0.0, "count": 0}
        trends_dict[year]["sum"] += score
        trends_dict[year]["count"] += 1
        
        # ── Distribution Aggregation ──
        bucket_idx = min(int(score // 10) * 10, 90)  # cap 100 at the 90-100 bucket
        bucket_key = f"{bucket_idx}-{bucket_idx+10}"
        distribution_buckets[bucket_key] += 1

    # Format trends for the line chart
    trend = [
        {
            "year": yr,
            "mean": round(data["sum"] / data["count"], 2)
        }
        for yr, data in sorted(trends_dict.items())
    ]
    
    # Format distribution for the bar chart / histogram
    distribution = [
        {"bucket": k, "count": v}
        for k, v in distribution_buckets.items()
    ]
    
    return {
        "trend": trend,
        "distribution": distribution
    }

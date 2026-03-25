"""Advanced Normalization Service (V3) — Incremental Mean & Variance Pipeline.

Strictly additive — parallel computation.
Implements:
- Incremental online computation of Mean & Variance.
- Z-Score: (x - mean) / std_dev
- Normalized Score V2: 50 + 10 * Z
- Percentile: standard normal CDF

Calculated per (Board, Subject, Year).
"""

import math
from scipy.stats import norm
from sqlalchemy.orm import Session
from app.models.models import StudentScore, Board

def compute_advanced_normalization(
    db: Session, board_name: str, subject: str, exam_year: int,
    target_marks: float = None, target_max_marks: float = None
) -> dict | list[dict]:
    """Computes incremental advanced normalization metrics."""
    
    # Fetch valid scores for the cohort
    rows = (
        db.query(
            StudentScore.student_id,
            StudentScore.student_name,
            StudentScore.marks,
            StudentScore.percentage_score
        )
        .join(Board, StudentScore.board_id == Board.board_id)
        .filter(
            Board.board_name == board_name,
            StudentScore.subject == subject,
            StudentScore.exam_year == exam_year,
            StudentScore.percentage_score.isnot(None),
            StudentScore.student_name.isnot(None)
        )
        .all()
    )

    if not rows:
        return []

    # 1. Incremental Mean & Variance Pass
    n = 0
    mean = 0.0
    var_sum = 0.0
    
    for row in rows:
        x = row.percentage_score
        n += 1
        if n == 1:
            mean = x
            var_sum = 0.0
        else:
            old_mean = mean
            mean = old_mean + (x - old_mean) / n
            var_sum = var_sum + (x - old_mean) * (x - mean)
            
    # Sample variance (n-1) or Population variance (n)
    # The prompt explicitly asks for "old_var + ...", we use population standard dicts typically
    variance = var_sum / n if n > 0 else 0.0
    std_dev = math.sqrt(variance)

    # 2. Return Custom Score Math if Requested
    if target_marks is not None and target_max_marks is not None and target_max_marks > 0:
        pct = (target_marks / target_max_marks) * 100.0
        z = ((pct - mean) / std_dev) if std_dev > 0 else 0.0
        normalized_score_v2 = 50 + 10 * z
        percentile = float(norm.cdf(z)) * 100
        return {
            "z_score": round(z, 4),
            "normalized_score_v2": round(normalized_score_v2, 2),
            "percentile": round(percentile, 2),
            "mean_used": round(mean, 2)
        }

    # 3. Z-Score and Percentile Pass for cohort list
    results = []
    for r in rows:
        pct = r.percentage_score
        if std_dev > 0:
            z = (pct - mean) / std_dev
        else:
            z = 0.0
            
        normalized_score_v2 = 50 + 10 * z
        percentile = float(norm.cdf(z)) * 100
        
        results.append({
            "student_id": r.student_id,
            "student_name": r.student_name,
            "marks": r.marks,
            "percentage": round(pct, 2),
            "z_score": round(z, 4),
            "normalized_score_v2": round(normalized_score_v2, 2),
            "percentile": round(percentile, 2)
        })
        
    # Sort logically so the highest scores are first
    results.sort(key=lambda x: x["normalized_score_v2"], reverse=True)
    return results

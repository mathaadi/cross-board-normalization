"""Normalization V2 — Batch Z-score + Percentile Analytics.

This is a PARALLEL normalization module that adds batch analytics capabilities.
It does NOT replace the existing normalization.py (min-max) or normalization_engine.py
(single-score Z-score pipeline).

Purpose:
    Compute Z-score and percentile rankings for all students grouped by (board, subject).

Core Formulas:
    z = (x - μ) / σ
    percentile = Φ(z) × 100  (via standard normal CDF)

Assumptions:
    - μ and σ are computed per (board, subject) across all year buckets
    - This gives statistically meaningful cohort sizes
    - Deterministic and explainable — no ML models

Edge Cases:
    - σ = 0 → z_score = 0.0, percentile = 50.0
    - Missing marks / NULL percentage_score → excluded from computation
    - Single student in cohort → z_score = 0.0, percentile = 50.0
"""

import math
from scipy.stats import norm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import StudentScore, Board


def compute_normalization_metrics(
    db: Session,
    board_name: str | None = None,
    subject: str | None = None,
) -> list[dict]:
    """Compute Z-score and percentile for students grouped by (board, subject).

    Args:
        db: Database session.
        board_name: Optional board filter.
        subject: Optional subject filter.

    Returns:
        List of group dicts, each containing:
            board_name, subject, mean, std_dev, sample_size,
            students: [{student_id, student_name, marks, max_marks,
                        percentage, z_score, percentile}]
    """
    # Build base query for valid scores
    query = (
        db.query(
            Board.board_name,
            StudentScore.subject,
            StudentScore.student_id,
            StudentScore.student_name,
            StudentScore.marks,
            StudentScore.max_marks,
            StudentScore.percentage_score,
        )
        .join(Board, StudentScore.board_id == Board.board_id)
        .filter(
            StudentScore.percentage_score.isnot(None),
            StudentScore.student_name.isnot(None),
        )
    )

    if board_name:
        query = query.filter(Board.board_name == board_name)
    if subject:
        query = query.filter(StudentScore.subject == subject.strip().title())

    rows = query.all()

    if not rows:
        return []

    # Group by (board_name, subject)
    groups: dict[tuple[str, str], list] = {}
    for row in rows:
        key = (row.board_name, row.subject)
        if key not in groups:
            groups[key] = []
        groups[key].append(row)

    results = []
    for (b_name, subj), group_rows in sorted(groups.items()):
        scores = [r.percentage_score for r in group_rows]
        n = len(scores)

        # Compute mean
        mean = sum(scores) / n

        # Compute population std dev
        if n > 1:
            variance = sum((s - mean) ** 2 for s in scores) / n
            std_dev = math.sqrt(variance)
        else:
            std_dev = 0.0

        # Compute Z-score and percentile for each student
        students = []
        for r in group_rows:
            if std_dev > 0:
                z = (r.percentage_score - mean) / std_dev
                percentile = round(float(norm.cdf(z)) * 100, 2)
            else:
                z = 0.0
                percentile = 50.0

            students.append({
                "student_id": r.student_id,
                "student_name": r.student_name,
                "marks": r.marks,
                "max_marks": r.max_marks,
                "percentage": round(r.percentage_score, 2),
                "z_score": round(z, 4),
                "percentile": percentile,
            })

        # Sort students by percentile descending
        students.sort(key=lambda s: s["percentile"], reverse=True)

        results.append({
            "board_name": b_name,
            "subject": subj,
            "mean": round(mean, 2),
            "std_dev": round(std_dev, 2),
            "sample_size": n,
            "students": students[:50],  # Cap at 50 per group for performance
        })

    return results

"""Board Stats Service — Board-level aggregation analytics.

Computes per-board: distinct student count, unique subject count, and average percentage.
Uses SQL-level aggregation for efficiency (no full Python scan).

This is a NEW module — does not modify any existing services.
"""

from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from app.models.models import StudentScore, Board


def get_board_level_stats(db: Session) -> list[dict]:
    """Compute board-level statistics dynamically from student_scores.

    Returns list of dicts:
        [{board_name, student_count, subject_count, avg_percentage}, ...]

    Edge cases handled:
        - Boards with no students → excluded (only boards with data shown)
        - NULL percentage_score rows → excluded from avg calculation
        - NULL student_name rows → excluded from distinct count
    """
    results = (
        db.query(
            Board.board_name,
            func.count(distinct(StudentScore.student_name)).label("student_count"),
            func.count(distinct(StudentScore.subject)).label("subject_count"),
            func.avg(StudentScore.percentage_score).label("avg_percentage"),
        )
        .join(StudentScore, StudentScore.board_id == Board.board_id)
        .filter(
            StudentScore.percentage_score.isnot(None),
            StudentScore.student_name.isnot(None),
        )
        .group_by(Board.board_name)
        .order_by(func.count(distinct(StudentScore.student_name)).desc())
        .all()
    )

    return [
        {
            "board_name": row.board_name,
            "student_count": row.student_count,
            "subject_count": row.subject_count,
            "avg_percentage": round(row.avg_percentage, 2) if row.avg_percentage else 0.0,
        }
        for row in results
    ]

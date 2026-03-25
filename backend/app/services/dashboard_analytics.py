"""Dashboard Analytics Service — Board & Stream Distribution.

Computes:
    1. Board distribution: proportion of students per board
    2. Stream distribution per board: % of students in each stream per board

Uses DISTINCT student_name counts since each student has multiple rows (one per subject).

This is a NEW module — does not modify any existing services.
"""

from sqlalchemy import func, distinct, case
from sqlalchemy.orm import Session

from app.models.models import StudentScore, Board


def get_dashboard_distribution(db: Session) -> dict:
    """Compute board and stream distribution data for dashboard charts.

    Returns:
        {
            board_distribution: [{board, count, percentage}],
            stream_distribution: [{board, streams: [{stream, count, percentage}]}]
        }
    """
    # ── Board Distribution ─────────────────────────────────────────
    board_counts = (
        db.query(
            Board.board_name,
            func.count(distinct(StudentScore.student_name)).label("count"),
        )
        .join(StudentScore, StudentScore.board_id == Board.board_id)
        .filter(StudentScore.student_name.isnot(None))
        .group_by(Board.board_name)
        .order_by(func.count(distinct(StudentScore.student_name)).desc())
        .all()
    )

    total_students = sum(r.count for r in board_counts) if board_counts else 1

    board_distribution = [
        {
            "board": row.board_name,
            "count": row.count,
            "percentage": round(row.count / total_students * 100, 1),
        }
        for row in board_counts
    ]

    # ── Stream Distribution Per Board ──────────────────────────────
    stream_counts = (
        db.query(
            Board.board_name,
            StudentScore.stream,
            func.count(distinct(StudentScore.student_name)).label("count"),
        )
        .join(StudentScore, StudentScore.board_id == Board.board_id)
        .filter(
            StudentScore.student_name.isnot(None),
            StudentScore.stream.isnot(None),
            StudentScore.stream != "",
        )
        .group_by(Board.board_name, StudentScore.stream)
        .order_by(Board.board_name, func.count(distinct(StudentScore.student_name)).desc())
        .all()
    )

    # Organize by board
    board_streams: dict[str, list] = {}
    board_totals: dict[str, int] = {}
    for row in stream_counts:
        if row.board_name not in board_streams:
            board_streams[row.board_name] = []
            board_totals[row.board_name] = 0
        board_streams[row.board_name].append({
            "stream": row.stream,
            "count": row.count,
        })
        board_totals[row.board_name] += row.count

    stream_distribution = []
    for board_name in sorted(board_streams.keys()):
        total = board_totals[board_name] or 1
        streams = [
            {
                "stream": s["stream"],
                "count": s["count"],
                "percentage": round(s["count"] / total * 100, 1),
            }
            for s in board_streams[board_name]
        ]
        stream_distribution.append({
            "board": board_name,
            "streams": streams,
        })

    return {
        "board_distribution": board_distribution,
        "stream_distribution": stream_distribution,
    }

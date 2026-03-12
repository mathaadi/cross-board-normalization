"""API routes for boards, year buckets, and statistics."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Board, YearBucket, BoardStatistic, StudentScore
from app.schemas.schemas import BoardOut, YearBucketOut, BoardStatisticOut, StatsOverview

router = APIRouter(prefix="/api", tags=["boards"])


@router.get("/boards", response_model=list[BoardOut])
def list_boards(db: Session = Depends(get_db)):
    """Return all boards."""
    return db.query(Board).filter(Board.active == True).all()


@router.get("/year-buckets", response_model=list[YearBucketOut])
def list_year_buckets(db: Session = Depends(get_db)):
    """Return all year buckets."""
    return db.query(YearBucket).order_by(YearBucket.start_year).all()


@router.get("/board-statistics", response_model=list[BoardStatisticOut])
def list_board_statistics(
    board: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return board statistics with optional filters."""
    query = db.query(BoardStatistic)

    if board:
        board_obj = db.query(Board).filter(Board.board_name == board).first()
        if board_obj:
            query = query.filter(BoardStatistic.board_id == board_obj.board_id)

    if subject:
        query = query.filter(BoardStatistic.subject == subject.strip().title())

    stats = query.all()
    results = []
    for s in stats:
        board_obj = db.query(Board).filter(Board.board_id == s.board_id).first()
        bucket_obj = db.query(YearBucket).filter(YearBucket.bucket_id == s.year_bucket_id).first()
        results.append(
            BoardStatisticOut(
                board_id=s.board_id,
                board_name=board_obj.board_name if board_obj else "Unknown",
                subject=s.subject,
                year_bucket=bucket_obj.bucket_label if bucket_obj else "Unknown",
                mean_score=round(s.mean_score, 2),
                std_dev=round(s.std_dev, 2),
                sample_size=s.sample_size,
                last_updated=s.last_updated,
            )
        )
    return results


@router.get("/stats-overview", response_model=StatsOverview)
def stats_overview(db: Session = Depends(get_db)):
    """Return high-level counts for the dashboard."""
    total_boards = db.query(Board).filter(Board.active == True).count()
    total_scores = db.query(StudentScore).count()
    # distinct subjects
    subjects = db.query(StudentScore.subject).distinct().count()
    total_statistics = db.query(BoardStatistic).count()
    return StatsOverview(
        total_boards=total_boards,
        total_scores=total_scores,
        total_subjects=subjects,
        total_statistics=total_statistics,
    )

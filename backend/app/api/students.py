"""Student Explorer API — search students, view normalized scores."""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, distinct
from typing import Optional

from app.database import get_db
from app.models.models import Board, StudentScore, YearBucket
from app.services.normalization_engine import normalize_score

router = APIRouter()


@router.get("/api/students/search")
def search_students(
    q: Optional[str] = Query(None, description="Search by name"),
    board: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    subject: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Search students with optional filters. Returns unique student profiles."""
    query = (
        db.query(
            StudentScore.student_name,
            Board.board_name,
            StudentScore.exam_year,
            StudentScore.class_level,
            StudentScore.stream,
            StudentScore.recent_education,
            func.count(StudentScore.student_id).label("subject_count"),
        )
        .join(Board, StudentScore.board_id == Board.board_id)
        .filter(StudentScore.student_name.isnot(None))
    )

    if q:
        query = query.filter(StudentScore.student_name.ilike(f"%{q}%"))
    if board:
        query = query.filter(Board.board_name == board)
    if year:
        query = query.filter(StudentScore.exam_year == year)
    if subject:
        query = query.filter(StudentScore.subject == subject)

    results = (
        query.group_by(
            StudentScore.student_name,
            Board.board_name,
            StudentScore.exam_year,
            StudentScore.class_level,
            StudentScore.stream,
            StudentScore.recent_education,
        )
        .order_by(StudentScore.student_name)
        .limit(limit)
        .all()
    )

    return [
        {
            "student_name": r.student_name,
            "board_name": r.board_name,
            "exam_year": r.exam_year,
            "class_level": r.class_level,
            "stream": r.stream,
            "recent_education": r.recent_education,
            "subject_count": r.subject_count,
        }
        for r in results
    ]


@router.get("/api/student-normalized-scores")
def get_student_normalized_scores(
    student_name: str = Query(..., description="Student name"),
    board: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Get all scores for a student with normalized scores computed dynamically
    using the EXISTING normalization engine (no modifications)."""
    query = (
        db.query(StudentScore, Board.board_name, YearBucket.bucket_label)
        .join(Board, StudentScore.board_id == Board.board_id)
        .outerjoin(YearBucket, StudentScore.year_bucket_id == YearBucket.bucket_id)
        .filter(StudentScore.student_name == student_name)
    )

    if board:
        query = query.filter(Board.board_name == board)
    if year:
        query = query.filter(StudentScore.exam_year == year)

    records = query.order_by(StudentScore.subject).all()

    if not records:
        raise HTTPException(status_code=404, detail=f"No scores found for student '{student_name}'")

    # Build response with normalized scores from the existing engine
    first_score, first_board, _ = records[0]
    subjects = []
    for score, board_name, bucket_label in records:
        # Call the EXISTING normalization model — no modifications
        try:
            norm_result = normalize_score(
                db=db,
                board_name=board_name,
                subject=score.subject,
                year=score.exam_year,
                marks=score.marks,
                max_marks=score.max_marks,
            )
            normalized = norm_result.normalized_score
            z_score = norm_result.z_score
            percentile = norm_result.percentile
            mean_used = norm_result.mean_used
            std_dev_used = norm_result.std_dev_used
        except Exception:
            normalized = None
            z_score = None
            percentile = None
            mean_used = None
            std_dev_used = None

        subjects.append({
            "subject": score.subject,
            "raw_score": score.marks,
            "max_marks": score.max_marks,
            "percentage": score.percentage_score,
            "normalized_score": normalized,
            "z_score": z_score,
            "percentile": percentile,
            "mean_used": mean_used,
            "std_dev_used": std_dev_used,
            "year_bucket": bucket_label,
        })

    return {
        "student_name": student_name,
        "board": first_board,
        "year": first_score.exam_year,
        "class_level": first_score.class_level,
        "stream": first_score.stream,
        "recent_education": first_score.recent_education,
        "subjects": subjects,
    }


@router.get("/api/students/filters")
def get_student_filters(db: Session = Depends(get_db)):
    """Get unique values for filter dropdowns."""
    years = [r[0] for r in db.query(distinct(StudentScore.exam_year)).filter(
        StudentScore.student_name.isnot(None)
    ).order_by(StudentScore.exam_year).all()]

    subjects = [r[0] for r in db.query(distinct(StudentScore.subject)).filter(
        StudentScore.student_name.isnot(None)
    ).order_by(StudentScore.subject).all()]

    boards = [r[0] for r in db.query(distinct(Board.board_name)).join(
        StudentScore, StudentScore.board_id == Board.board_id
    ).filter(StudentScore.student_name.isnot(None)).order_by(Board.board_name).all()]

    return {"years": years, "subjects": subjects, "boards": boards}

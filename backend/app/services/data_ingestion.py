"""Data Ingestion Service — validates, stores, and processes new score records."""

from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import Optional

from app.models.models import Board, StudentScore
from app.services.year_bucket_service import assign_year_bucket
from app.services.feature_engineering import compute_percentage
from app.services.statistics_engine import update_statistics_incremental


def ingest_score(
    db: Session,
    board_name: str,
    subject: str,
    year: int,
    marks: float,
    max_marks: float,
    student_name: Optional[str] = None,
    class_level: str = "Class 12",
    stream: Optional[str] = None,
    recent_education: Optional[str] = None,
) -> StudentScore:
    """Validate and ingest a single marksheet record.

    Pipeline:
        1. Validate inputs
        2. Resolve board
        3. Assign year bucket
        4. Compute percentage
        5. Store record (with student name, class level, stream)
        6. Update statistics incrementally
    """

    # ── Validation ───────────────────────────────────────────────
    if marks < 0:
        raise HTTPException(status_code=400, detail="marks must be >= 0")
    if max_marks <= 0:
        raise HTTPException(status_code=400, detail="max_marks must be > 0")
    if marks > max_marks:
        raise HTTPException(status_code=400, detail="marks cannot exceed max_marks")
    if not (1990 <= year <= 2030):
        raise HTTPException(status_code=400, detail="year must be between 1990 and 2030")

    # ── Resolve board ────────────────────────────────────────────
    board = db.query(Board).filter(Board.board_name == board_name).first()
    if not board:
        raise HTTPException(status_code=404, detail=f"Board '{board_name}' not found")

    # ── Year bucket ──────────────────────────────────────────────
    bucket = assign_year_bucket(db, year)
    if not bucket:
        raise HTTPException(status_code=404, detail=f"No year bucket covers year {year}")

    # ── Feature engineering ──────────────────────────────────────
    pct = compute_percentage(marks, max_marks)

    # ── Store ────────────────────────────────────────────────────
    record = StudentScore(
        student_name=student_name.strip() if student_name else None,
        board_id=board.board_id,
        class_level=class_level,
        stream=stream,
        subject=subject.strip().title(),
        marks=marks,
        max_marks=max_marks,
        exam_year=year,
        year_bucket_id=bucket.bucket_id,
        percentage_score=pct,
        recent_education=recent_education,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # ── Incremental stats update ─────────────────────────────────
    update_statistics_incremental(
        db,
        board_id=board.board_id,
        subject=record.subject,
        year_bucket_id=bucket.bucket_id,
        new_score=pct,
    )

    return record

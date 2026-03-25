"""API routes for normalization and data ingestion."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import (
    NormalizeScoreRequest,
    NormalizeScoreResponse,
    IngestScoreRequest,
    IngestScoreResponse,
)
from app.services.normalization_engine import normalize_score
from app.services.data_ingestion import ingest_score

router = APIRouter(prefix="/api", tags=["normalization"])


@router.post("/normalize-score", response_model=NormalizeScoreResponse)
def api_normalize_score(req: NormalizeScoreRequest, db: Session = Depends(get_db)):
    """Normalize a student's score and return Z-score, universal score, and percentile."""
    if req.marks > req.max_marks:
        raise HTTPException(status_code=400, detail="marks cannot exceed max_marks")

    try:
        result = normalize_score(
            db,
            board_name=req.board,
            subject=req.subject.strip().title(),
            year=req.year,
            marks=req.marks,
            max_marks=req.max_marks,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return NormalizeScoreResponse(
        board=req.board,
        subject=req.subject,
        year=req.year,
        marks=req.marks,
        max_marks=req.max_marks,
        percentage_score=result.percentage_score,
        z_score=result.z_score,
        normalized_score=result.normalized_score,
        percentile=result.percentile,
        year_bucket=result.year_bucket_label,
        mean_used=result.mean_used,
        std_dev_used=result.std_dev_used,
        sample_size=result.sample_size,
    )


@router.post("/ingest-score", response_model=IngestScoreResponse, status_code=201)
def api_ingest_score(req: IngestScoreRequest, db: Session = Depends(get_db)):
    """Ingest a new marksheet record into the system."""
    record = ingest_score(
        db,
        board_name=req.board,
        subject=req.subject,
        year=req.year,
        marks=req.marks,
        max_marks=req.max_marks,
        student_name=req.student_name,
        class_level=req.class_level,
        stream=req.stream,
        stream_id=req.stream_id,
        recent_education=req.recent_education,
        organization_id=req.organization_id,
        course_id=req.course_id,
        program_id=req.program_id,
    )

    bucket_label = record.year_bucket_rel.bucket_label if record.year_bucket_rel else "Unknown"

    return IngestScoreResponse(
        student_id=record.student_id,
        student_name=record.student_name,
        board=req.board,
        class_level=record.class_level or "Class 12",
        stream=record.stream,
        subject=record.subject,
        exam_year=record.exam_year,
        marks=record.marks,
        max_marks=record.max_marks,
        percentage_score=record.percentage_score,
        year_bucket=bucket_label,
        message="Score ingested and statistics updated successfully",
        organization_id=record.organization_id,
        course_id=record.course_id,
        program_id=record.program_id,
    )

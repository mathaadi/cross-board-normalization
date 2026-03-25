"""Student Extension Routes — NEW endpoints for sorting, export, detail, and OCR.

All routes are additive. Existing students.py routes are NOT modified.
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models.models import (
    Board, StudentScore, Organization, Course, CourseType,
)
from app.services.normalization import simple_normalize
from app.services.advanced_normalization_service import compute_advanced_normalization
from app.services.export_utils import generate_students_csv

router = APIRouter()


# ── Helper: build base student query with aggregation ───────────

def _build_student_query(
    db: Session,
    q: Optional[str] = None,
    class_level: Optional[str] = None,
    performance_label: Optional[str] = None,
    board: Optional[str] = None,
    sort_by: Optional[str] = None,
    order: str = "asc",
):
    """Build a grouped student query with filters and sorting.

    Returns the query (un-executed) and the base for counting.
    """
    subq = (
        db.query(
            func.min(StudentScore.student_id).label("student_id"),
            StudentScore.student_name,
            Board.board_name,
            StudentScore.exam_year,
            StudentScore.class_level,
            StudentScore.stream,
            StudentScore.attendance,
            StudentScore.performance_label,
            StudentScore.organization_id,
            StudentScore.course_id,
            func.count(StudentScore.student_id).label("subject_count"),
            func.avg(StudentScore.percentage_score).label("avg_percentage"),
        )
        .join(Board, StudentScore.board_id == Board.board_id)
        .filter(StudentScore.student_name.isnot(None))
    )

    # Apply filters (same as existing /api/students)
    if q:
        subq = subq.filter(StudentScore.student_name.ilike(f"%{q}%"))
    if class_level:
        subq = subq.filter(StudentScore.class_level == class_level)
    if performance_label:
        subq = subq.filter(StudentScore.performance_label == performance_label)
    if board:
        subq = subq.filter(Board.board_name == board)

    subq = subq.group_by(
        StudentScore.student_name,
        Board.board_name,
        StudentScore.exam_year,
        StudentScore.class_level,
        StudentScore.stream,
        StudentScore.attendance,
        StudentScore.performance_label,
        StudentScore.organization_id,
        StudentScore.course_id,
    )

    # Apply sorting
    if sort_by == "programme" or sort_by == "program":
        # Sort by program (course) name — need to join Course
        if order == "desc":
            subq = subq.order_by(Course.name.desc() if subq.column_descriptions else StudentScore.student_name)
        else:
            subq = subq.order_by(StudentScore.student_name)
    elif sort_by == "organisation" or sort_by == "organization":
        if order == "desc":
            subq = subq.order_by(StudentScore.organization_id.desc())
        else:
            subq = subq.order_by(StudentScore.organization_id.asc())
    else:
        subq = subq.order_by(StudentScore.student_name)

    return subq


def _resolve_names(db: Session, rows) -> list[dict]:
    """Resolve organization/program names and compute normalized scores."""
    org_cache = {}
    program_cache = {}

    def get_org_name(oid):
        if oid is None:
            return None
        if oid not in org_cache:
            o = db.query(Organization).filter(Organization.id == oid).first()
            org_cache[oid] = o.name if o else None
        return org_cache[oid]

    def get_program_name(pid):
        if pid is None:
            return None
        if pid not in program_cache:
            c = db.query(Course).filter(Course.id == pid).first()
            program_cache[pid] = c.name if c else None
        return program_cache[pid]

    students = []
    for r in rows:
        avg_pct = round(r.avg_percentage, 1) if r.avg_percentage else None
        students.append({
            "student_id": r.student_id,
            "student_name": r.student_name,
            "board_name": r.board_name,
            "exam_year": r.exam_year,
            "class_level": r.class_level,
            "stream": r.stream,
            "performance_label": r.performance_label,
            "subject_count": r.subject_count,
            "avg_percentage": avg_pct,
            "normalized_score": avg_pct,  # simple normalization = percentage
            "organization_name": get_org_name(r.organization_id),
            "program_name": get_program_name(r.course_id),
        })
    return students


# ── Sorted Student List ─────────────────────────────────────────

@router.get("/api/students-ext")
def get_students_extended(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="Search by name"),
    class_level: Optional[str] = Query(None),
    performance_label: Optional[str] = Query(None),
    board: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None, description="Sort by: program, organisation"),
    order: str = Query("asc", description="asc or desc"),
    db: Session = Depends(get_db),
):
    """Paginated student list WITH sorting by program/organisation.

    Works alongside all existing filters. Does NOT modify existing /api/students.
    """
    subq = _build_student_query(
        db, q=q, class_level=class_level,
        performance_label=performance_label, board=board,
        sort_by=sort_by, order=order,
    )

    # Count total
    count_results = subq.all()
    total_count = len(count_results)
    total_pages = max(1, math.ceil(total_count / page_size))
    offset = (page - 1) * page_size

    # Apply sort_by with proper ordering on the paginated result
    # Re-run query with sort for the page
    results = []
    all_students = _resolve_names(db, count_results)

    # Sort in Python for reliable program/organisation sorting
    if sort_by in ("programme", "program"):
        all_students.sort(
            key=lambda s: (s.get("program_name") or "").lower(),
            reverse=(order == "desc"),
        )
    elif sort_by in ("organisation", "organization"):
        all_students.sort(
            key=lambda s: (s.get("organization_name") or "").lower(),
            reverse=(order == "desc"),
        )

    # Paginate
    page_students = all_students[offset:offset + page_size]

    return {
        "students": page_students,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


# ── CSV Export ──────────────────────────────────────────────────

@router.get("/api/students/export")
def export_students_csv(
    q: Optional[str] = Query(None),
    class_level: Optional[str] = Query(None),
    performance_label: Optional[str] = Query(None),
    board: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    db: Session = Depends(get_db),
):
    """Export currently filtered/sorted student data as CSV download."""
    subq = _build_student_query(
        db, q=q, class_level=class_level,
        performance_label=performance_label, board=board,
        sort_by=sort_by, order=order,
    )
    rows = subq.all()
    students = _resolve_names(db, rows)

    # Sort if requested
    if sort_by in ("programme", "program"):
        students.sort(
            key=lambda s: (s.get("program_name") or "").lower(),
            reverse=(order == "desc"),
        )
    elif sort_by in ("organisation", "organization"):
        students.sort(
            key=lambda s: (s.get("organization_name") or "").lower(),
            reverse=(order == "desc"),
        )

    return generate_students_csv(students)


# ── Student Detail with Normalized Scores ───────────────────────

@router.get("/api/students/{student_id}/details")
def get_student_details(
    student_id: int,
    db: Session = Depends(get_db),
):
    """Get detailed student view with subject-wise marks and normalized scores.

    Uses simple min-max percentage normalization (marks / max_marks × 100).
    """
    # Find the student's first record to get the name
    first_record = (
        db.query(StudentScore)
        .filter(StudentScore.student_id == student_id)
        .first()
    )
    if not first_record:
        raise HTTPException(status_code=404, detail=f"Student with ID {student_id} not found.")

    student_name = first_record.student_name

    # Get all score records for this student
    records = (
        db.query(StudentScore, Board.board_name)
        .join(Board, StudentScore.board_id == Board.board_id)
        .filter(StudentScore.student_name == student_name)
        .filter(StudentScore.exam_year == first_record.exam_year)
        .order_by(StudentScore.subject)
        .all()
    )

    if not records:
        raise HTTPException(status_code=404, detail="No scores found for this student.")

    # Resolve organization and program names
    org_name = None
    program_name = None
    if first_record.organization_id:
        org = db.query(Organization).filter(Organization.id == first_record.organization_id).first()
        org_name = org.name if org else None
    if first_record.course_id:
        course = db.query(Course).filter(Course.id == first_record.course_id).first()
        program_name = course.name if course else None

    subjects = []
    for score, board_name in records:
        try:
            # Query the V2 Advanced Normalizer incrementally
            target_res = compute_advanced_normalization(
                db, board_name=board_name, subject=score.subject, exam_year=first_record.exam_year,
                target_marks=score.marks, target_max_marks=score.max_marks
            )
            if isinstance(target_res, dict) and "normalized_score_v2" in target_res:
                norm_score = target_res.get("normalized_score_v2")
            else:
                norm_score = simple_normalize(score.marks, score.max_marks)
        except Exception:
            try:
                norm_score = simple_normalize(score.marks, score.max_marks)
            except Exception:
                norm_score = None

        subjects.append({
            "subject": score.subject,
            "marks": score.marks,
            "max_marks": score.max_marks,
            "percentage": score.percentage_score,
            "normalized_score": norm_score,
        })

    # Compute averages
    valid_norms = [s["normalized_score"] for s in subjects if s["normalized_score"] is not None]
    avg_normalized = round(sum(valid_norms) / len(valid_norms), 2) if valid_norms else None

    valid_pcts = [s["percentage"] for s in subjects if s["percentage"] is not None]
    avg_percentage = round(sum(valid_pcts) / len(valid_pcts), 2) if valid_pcts else None

    return {
        "student_id": student_id,
        "student_name": student_name,
        "board_name": records[0][1] if records else None,
        "class_level": first_record.class_level,
        "stream": first_record.stream,
        "exam_year": first_record.exam_year,
        "organization_name": org_name,
        "program_name": program_name,
        "performance_label": first_record.performance_label,
        "avg_percentage": avg_percentage,
        "avg_normalized_score": avg_normalized,
        "subjects": subjects,
        "normalization_method": "Incremental Normalization V2 (Z-Score Map)",
    }


# ── OCR Upload + Process ───────────────────────────────────────

@router.post("/api/academic/ocr")
async def upload_marksheet_ocr(
    file: UploadFile = File(..., description="Marksheet image (JPG/PNG) or PDF"),
):
    """Upload a marksheet image and extract academic data using OCR.

    Returns structured JSON with student name, class, subjects, marks,
    and confidence level.
    """
    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPG, PNG, PDF.",
        )

    # Read file
    try:
        image_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # Process with OCR service
    from app.services.ocr_service import process_marksheet
    result = process_marksheet(image_bytes)

    return {
        "success": len(result.get("errors", [])) == 0,
        "data": {
            "name": result.get("name"),
            "class": result.get("class", "unknown"),
            "confidence": result.get("confidence", 0.0),
            "subjects": result.get("subjects", []),
            "total": result.get("total"),
            "percentage": result.get("percentage"),
        },
        "errors": result.get("errors", []),
        "raw_text_preview": (result.get("raw_text", "")[:500] + "...")
            if len(result.get("raw_text", "")) > 500
            else result.get("raw_text", ""),
    }

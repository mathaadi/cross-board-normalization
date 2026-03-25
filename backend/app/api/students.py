"""Student Explorer API — search, directory, normalized scores, analytics."""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, distinct
from typing import Optional
from collections import OrderedDict

from app.database import get_db
from app.models.models import Board, StudentScore, YearBucket, Organization, Course, CourseType, Stream
from app.services.normalization_engine import normalize_score

router = APIRouter()


# ── Paginated flat student list ─────────────────────────────────

@router.get("/api/students")
def get_students_list(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    q: Optional[str] = Query(None, description="Search by name (partial, case-insensitive)"),
    class_level: Optional[str] = Query(None, description="Filter by class level"),
    performance_label: Optional[str] = Query(None, description="Filter by performance label"),
    board: Optional[str] = Query(None, description="Filter by board name"),
    db: Session = Depends(get_db),
):
    """Paginated flat student list with performance labels.

    Returns one row per unique student (aggregated across subjects).
    Default: first 20 students on initial load.
    """
    # Subquery: aggregate per student
    subq = (
        db.query(
            StudentScore.student_name,
            Board.board_name,
            StudentScore.exam_year,
            StudentScore.class_level,
            StudentScore.stream,
            StudentScore.attendance,
            StudentScore.performance_label,
            func.count(StudentScore.student_id).label("subject_count"),
            func.avg(StudentScore.percentage_score).label("avg_percentage"),
        )
        .join(Board, StudentScore.board_id == Board.board_id)
        .filter(StudentScore.student_name.isnot(None))
    )

    # Apply filters
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
    )

    # Count total unique students (before pagination)
    count_results = subq.all()
    total_count = len(count_results)

    # Paginate
    import math
    total_pages = max(1, math.ceil(total_count / page_size))
    offset = (page - 1) * page_size

    results = (
        subq.order_by(StudentScore.student_name)
        .offset(offset)
        .limit(page_size)
        .all()
    )

    students = [
        {
            "student_name": r.student_name,
            "board_name": r.board_name,
            "exam_year": r.exam_year,
            "class_level": r.class_level,
            "stream": r.stream,
            "attendance": r.attendance,
            "performance_label": r.performance_label,
            "subject_count": r.subject_count,
            "avg_percentage": round(r.avg_percentage, 1) if r.avg_percentage else None,
        }
        for r in results
    ]

    return {
        "students": students,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/api/students/search")
def search_students(
    q: Optional[str] = Query(None, description="Search by name"),
    board: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    subject: Optional[str] = Query(None),
    class_level: Optional[str] = Query(None),
    organization_id: Optional[int] = Query(None),
    program_id: Optional[int] = Query(None),
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
            StudentScore.organization_id,
            StudentScore.course_id,
            StudentScore.program_id,
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
    if class_level:
        query = query.filter(StudentScore.class_level == class_level)
    if organization_id:
        query = query.filter(StudentScore.organization_id == organization_id)
    if program_id:
        query = query.filter(StudentScore.program_id == program_id)

    results = (
        query.group_by(
            StudentScore.student_name,
            Board.board_name,
            StudentScore.exam_year,
            StudentScore.class_level,
            StudentScore.stream,
            StudentScore.recent_education,
            StudentScore.organization_id,
            StudentScore.course_id,
            StudentScore.program_id,
        )
        .order_by(StudentScore.student_name)
        .limit(limit)
        .all()
    )

    # Cache org/program names
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

    return [
        {
            "student_name": r.student_name,
            "board_name": r.board_name,
            "exam_year": r.exam_year,
            "class_level": r.class_level,
            "stream": r.stream,
            "recent_education": r.recent_education,
            "subject_count": r.subject_count,
            "organization_name": get_org_name(r.organization_id),
            "program_name": get_program_name(r.program_id),
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
    """Get all scores for a student with normalized scores computed dynamically."""
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

    first_score, first_board, _ = records[0]

    # Get org/program names
    org_name = None
    program_name = None
    if first_score.organization_id:
        org = db.query(Organization).filter(Organization.id == first_score.organization_id).first()
        org_name = org.name if org else None
    if first_score.program_id:
        prog = db.query(Course).filter(Course.id == first_score.program_id).first()
        program_name = prog.name if prog else None

    subjects = []
    for score, board_name, bucket_label in records:
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
        "organization_name": org_name,
        "program_name": program_name,
        "subjects": subjects,
    }


# ── Hierarchical Student Directory ──────────────────────────────

@router.get("/api/students/directory")
def get_students_directory(
    year: Optional[int] = Query(None),
    organization_id: Optional[int] = Query(None),
    course_type_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    program_id: Optional[int] = Query(None),
    board: Optional[str] = Query(None),
    class_level: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    """Return students in hierarchical structure: Organization → CourseType → Program → Students."""
    query = (
        db.query(
            StudentScore.student_id,
            StudentScore.student_name,
            Board.board_name,
            StudentScore.exam_year,
            StudentScore.subject,
            StudentScore.marks,
            StudentScore.max_marks,
            StudentScore.percentage_score,
            StudentScore.class_level,
            StudentScore.stream,
            StudentScore.organization_id,
            StudentScore.course_id,
            StudentScore.program_id,
        )
        .join(Board, StudentScore.board_id == Board.board_id)
        .filter(StudentScore.student_name.isnot(None))
    )

    if year:
        query = query.filter(StudentScore.exam_year == year)
    if organization_id:
        query = query.filter(StudentScore.organization_id == organization_id)
    if course_type_id:
        query = query.join(Course, StudentScore.course_id == Course.id).filter(
            Course.course_type_id == course_type_id
        )
    if course_id:
        query = query.filter(StudentScore.course_id == course_id)
    if program_id:
        query = query.filter(StudentScore.program_id == program_id)
    if board:
        query = query.filter(Board.board_name == board)
    if class_level:
        query = query.filter(StudentScore.class_level == class_level)

    records = query.order_by(StudentScore.student_name).limit(limit).all()

    org_cache = {}
    course_cache = {}

    def get_org_name(oid):
        if oid is None:
            return "Unassigned"
        if oid not in org_cache:
            o = db.query(Organization).filter(Organization.id == oid).first()
            org_cache[oid] = o.name if o else "Unknown"
        return org_cache[oid]

    def get_course_info(cid):
        if cid is None:
            return ("Unassigned", "Unassigned")
        if cid not in course_cache:
            c = db.query(Course).filter(Course.id == cid).first()
            if c:
                ct = c.course_type_rel
                course_cache[cid] = (c.name, ct.name if ct else "Unknown")
            else:
                course_cache[cid] = ("Unknown", "Unknown")
        return course_cache[cid]

    hierarchy = OrderedDict()

    for r in records:
        org_name = get_org_name(r.organization_id)
        course_name, course_type_name = get_course_info(r.program_id or r.course_id)

        if org_name not in hierarchy:
            hierarchy[org_name] = OrderedDict()
        if course_type_name not in hierarchy[org_name]:
            hierarchy[org_name][course_type_name] = OrderedDict()
        if course_name not in hierarchy[org_name][course_type_name]:
            hierarchy[org_name][course_type_name][course_name] = []

        hierarchy[org_name][course_type_name][course_name].append({
            "student_id": r.student_id,
            "student_name": r.student_name,
            "board_name": r.board_name,
            "exam_year": r.exam_year,
            "subject": r.subject,
            "marks": r.marks,
            "max_marks": r.max_marks,
            "percentage": r.percentage_score,
            "class_level": r.class_level,
            "stream": r.stream,
        })

    organizations_out = []
    total_students = 0

    for org_name, types in hierarchy.items():
        course_types_out = []
        for type_name, courses in types.items():
            courses_out = []
            for course_name, students in courses.items():
                courses_out.append({
                    "course_name": course_name,
                    "student_count": len(students),
                    "students": students,
                })
                total_students += len(students)
            course_types_out.append({
                "course_type_name": type_name,
                "course_count": len(courses_out),
                "courses": courses_out,
            })
        organizations_out.append({
            "organization_name": org_name,
            "course_type_count": len(course_types_out),
            "course_types": course_types_out,
        })

    return {
        "year": year,
        "total_students": total_students,
        "organizations": organizations_out,
    }


# ── Analytics ───────────────────────────────────────────────────

@router.get("/api/students/analytics")
def get_students_analytics(
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return demographic analytics aggregations."""
    base = db.query(StudentScore).filter(StudentScore.student_name.isnot(None))
    if year:
        base = base.filter(StudentScore.exam_year == year)

    # By Organization
    by_org = {}
    org_rows = (
        base.with_entities(StudentScore.organization_id, func.count(StudentScore.student_id))
        .group_by(StudentScore.organization_id)
        .all()
    )
    for oid, cnt in org_rows:
        if oid:
            o = db.query(Organization).filter(Organization.id == oid).first()
            by_org[o.name if o else "Unknown"] = cnt
        else:
            by_org["Unassigned"] = cnt

    # By Course Type
    by_ctype = {}
    ctype_rows = (
        base.join(Course, StudentScore.course_id == Course.id, isouter=True)
        .join(CourseType, Course.course_type_id == CourseType.id, isouter=True)
        .with_entities(CourseType.name, func.count(StudentScore.student_id))
        .group_by(CourseType.name)
        .all()
    )
    for name, cnt in ctype_rows:
        by_ctype[name or "Unassigned"] = cnt

    # By Program (Course)
    by_program = {}
    program_rows = (
        base.join(Course, StudentScore.program_id == Course.id, isouter=True)
        .with_entities(Course.name, func.count(StudentScore.student_id))
        .group_by(Course.name)
        .all()
    )
    for name, cnt in program_rows:
        by_program[name or "Unassigned"] = cnt

    # Cross distribution: Organization × CourseType
    cross = {}
    cross_rows = (
        base.join(Organization, StudentScore.organization_id == Organization.id, isouter=True)
        .join(Course, StudentScore.course_id == Course.id, isouter=True)
        .join(CourseType, Course.course_type_id == CourseType.id, isouter=True)
        .with_entities(
            Organization.name, CourseType.name, func.count(StudentScore.student_id)
        )
        .group_by(Organization.name, CourseType.name)
        .all()
    )
    for org_name, ctype_name, cnt in cross_rows:
        org_key = org_name or "Unassigned"
        ct_key = ctype_name or "Unassigned"
        if org_key not in cross:
            cross[org_key] = {}
        cross[org_key][ct_key] = cnt

    return {
        "year": year,
        "by_organization": by_org,
        "by_course_type": by_ctype,
        "by_program": by_program,
        "cross_distribution": cross,
    }


# ── Filters ─────────────────────────────────────────────────────

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

    class_levels = [r[0] for r in db.query(distinct(StudentScore.class_level)).filter(
        StudentScore.student_name.isnot(None),
        StudentScore.class_level.isnot(None),
    ).order_by(StudentScore.class_level).all()]

    return {
        "years": years,
        "subjects": subjects,
        "boards": boards,
        "class_levels": class_levels,
    }

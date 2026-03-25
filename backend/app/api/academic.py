"""Academic entities API — Organizations, Course Types, Courses, Subjects, Streams."""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional

from app.database import get_db
from app.models.models import (
    Organization, CourseType, Course, SubjectCatalog, Stream,
    StudentScore, StudentSubjectMapping, Board, CourseSubjectConstraint,
    organization_courses, org_course_type_mapping,
    board_subject_mapping, stream_subject_mapping,
)
from app.schemas.schemas import (
    OrganizationOut, CourseTypeOut, CourseOut, SubjectCatalogOut,
    StreamOut, AcademicMetaResponse, AcademicRecordCreate, AcademicRecordResponse,
    ValidateSubjectCombinationRequest, ValidationResult,
)
from app.services.year_bucket_service import assign_year_bucket
from app.services.feature_engineering import compute_percentage
from app.services.statistics_engine import update_statistics_incremental

router = APIRouter(prefix="/api/academic", tags=["academic"])


@router.get("/organizations", response_model=list[OrganizationOut])
def list_organizations(db: Session = Depends(get_db)):
    """Return all active organizations."""
    return db.query(Organization).filter(Organization.active == True).order_by(Organization.name).all()


@router.get("/course-types", response_model=list[CourseTypeOut])
def list_course_types(
    organization_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return course types. If organization_id provided, returns ONLY types mapped to that org."""
    if organization_id:
        # Query via mapping table
        ct_rows = db.execute(
            org_course_type_mapping.select().where(
                org_course_type_mapping.c.organization_id == organization_id
            )
        ).fetchall()
        ct_ids = [r.course_type_id for r in ct_rows]
        if not ct_ids:
            return []
        return db.query(CourseType).filter(CourseType.id.in_(ct_ids)).order_by(CourseType.name).all()
    return db.query(CourseType).order_by(CourseType.name).all()


@router.get("/courses")
def list_courses(
    organization_id: Optional[int] = Query(None),
    course_type_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return courses (programs) filtered by organization and/or course type."""
    query = db.query(Course)

    if organization_id:
        query = query.join(
            organization_courses,
            Course.id == organization_courses.c.course_id,
        ).filter(organization_courses.c.organization_id == organization_id)

    if course_type_id:
        query = query.filter(Course.course_type_id == course_type_id)

    courses = query.order_by(Course.name).all()

    return [
        {
            "id": c.id,
            "name": c.name,
            "course_type_id": c.course_type_id,
            "course_type_name": c.course_type_rel.name if c.course_type_rel else None,
            "description": c.description,
        }
        for c in courses
    ]


@router.get("/streams", response_model=list[StreamOut])
def list_streams(
    class_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return streams, optionally filtered by class level."""
    query = db.query(Stream)
    if class_level:
        query = query.filter(
            (Stream.class_level == class_level) | (Stream.class_level == "Both")
        )
    return query.order_by(Stream.name).all()


@router.get("/subjects")
def list_subjects(
    course_id: Optional[int] = Query(None),
    board_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    class_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return subjects filtered by board, stream, class level, or course.

    Priority logic:
    - If board_id + stream_id provided: intersection of board subjects AND stream subjects
    - If board_id + class_level: board subjects for that class level
    - If stream_id only: stream subjects
    - If course_id only: course subjects (legacy)
    - No filters: all subjects
    """
    if board_id and stream_id:
        # Intersection: subjects mapped to BOTH this board AND this stream
        board_subj_rows = db.execute(
            board_subject_mapping.select().where(
                board_subject_mapping.c.board_id == board_id
            )
        ).fetchall()
        board_subj_ids = set(r.subject_id for r in board_subj_rows)

        # If class_level provided, filter board subjects further
        if class_level:
            board_subj_rows_filtered = [r for r in board_subj_rows if r.class_level == class_level]
            board_subj_ids = set(r.subject_id for r in board_subj_rows_filtered)

        stream_subj_rows = db.execute(
            stream_subject_mapping.select().where(
                stream_subject_mapping.c.stream_id == stream_id
            )
        ).fetchall()
        stream_subj_ids = set(r.subject_id for r in stream_subj_rows)

        common_ids = board_subj_ids & stream_subj_ids
        if not common_ids:
            return []
        subjects = db.query(SubjectCatalog).filter(SubjectCatalog.id.in_(common_ids)).order_by(SubjectCatalog.name).all()

    elif board_id:
        # Subjects for this board
        q = board_subject_mapping.select().where(
            board_subject_mapping.c.board_id == board_id
        )
        if class_level:
            q = q.where(board_subject_mapping.c.class_level == class_level)
        rows = db.execute(q).fetchall()
        subj_ids = [r.subject_id for r in rows]
        if not subj_ids:
            return []
        subjects = db.query(SubjectCatalog).filter(SubjectCatalog.id.in_(subj_ids)).order_by(SubjectCatalog.name).all()

    elif stream_id:
        rows = db.execute(
            stream_subject_mapping.select().where(
                stream_subject_mapping.c.stream_id == stream_id
            )
        ).fetchall()
        subj_ids = [r.subject_id for r in rows]
        if not subj_ids:
            return []
        subjects = db.query(SubjectCatalog).filter(SubjectCatalog.id.in_(subj_ids)).order_by(SubjectCatalog.name).all()

    elif course_id:
        subjects = db.query(SubjectCatalog).filter(SubjectCatalog.course_id == course_id).order_by(SubjectCatalog.name).all()

    else:
        subjects = db.query(SubjectCatalog).order_by(SubjectCatalog.name).all()

    return [
        {"id": s.id, "name": s.name, "course_id": s.course_id}
        for s in subjects
    ]


@router.get("/meta")
def academic_meta(
    organization_id: Optional[int] = Query(None),
    course_type_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return all dropdown data in one call — supports dependent filtering."""
    orgs = db.query(Organization).filter(Organization.active == True).order_by(Organization.name).all()

    # Course types — filtered by org if provided
    if organization_id:
        ct_rows = db.execute(
            org_course_type_mapping.select().where(
                org_course_type_mapping.c.organization_id == organization_id
            )
        ).fetchall()
        ct_ids = [r.course_type_id for r in ct_rows]
        ctypes = db.query(CourseType).filter(CourseType.id.in_(ct_ids)).order_by(CourseType.name).all() if ct_ids else []
    else:
        ctypes = db.query(CourseType).order_by(CourseType.name).all()

    # Courses/Programs — filtered by org + type
    courses_q = db.query(Course)
    if organization_id:
        courses_q = courses_q.join(
            organization_courses,
            Course.id == organization_courses.c.course_id,
        ).filter(organization_courses.c.organization_id == organization_id)
    if course_type_id:
        courses_q = courses_q.filter(Course.course_type_id == course_type_id)
    courses = courses_q.order_by(Course.name).all()

    # Subjects — filtered by course
    subjects_q = db.query(SubjectCatalog)
    if course_id:
        subjects_q = subjects_q.filter(SubjectCatalog.course_id == course_id)
    subjects = subjects_q.order_by(SubjectCatalog.name).all()

    return {
        "organizations": [
            {"id": o.id, "name": o.name, "location": o.location, "active": o.active}
            for o in orgs
        ],
        "course_types": [
            {"id": ct.id, "name": ct.name, "description": ct.description}
            for ct in ctypes
        ],
        "courses": [
            {
                "id": c.id,
                "name": c.name,
                "course_type_id": c.course_type_id,
                "course_type_name": c.course_type_rel.name if c.course_type_rel else None,
                "description": c.description,
            }
            for c in courses
        ],
        "subjects": [
            {"id": s.id, "name": s.name, "course_id": s.course_id}
            for s in subjects
        ],
    }


# ── Academic Record Submission ───────────────────────────────────

@router.post("/academic-record", response_model=AcademicRecordResponse, status_code=201)
def create_academic_record(data: AcademicRecordCreate, db: Session = Depends(get_db)):
    """Create a full academic record with multi-subject scores."""

    # Validate board exists
    board = db.query(Board).filter(Board.board_id == data.board_id).first()
    if not board:
        raise HTTPException(404, f"Board with id {data.board_id} not found")

    # Validate organization exists
    org = db.query(Organization).filter(Organization.id == data.organization_id).first()
    if not org:
        raise HTTPException(404, f"Organization with id {data.organization_id} not found")

    # Validate course type mapped to org
    oct_exists = db.execute(
        org_course_type_mapping.select().where(
            org_course_type_mapping.c.organization_id == data.organization_id,
            org_course_type_mapping.c.course_type_id == data.course_type_id,
        )
    ).fetchone()
    if not oct_exists:
        ct = db.query(CourseType).filter(CourseType.id == data.course_type_id).first()
        ct_name = ct.name if ct else f"ID {data.course_type_id}"
        raise HTTPException(400, f"Organization '{org.name}' does not offer course type '{ct_name}'")

    # Validate program mapped to org
    op_exists = db.execute(
        organization_courses.select().where(
            organization_courses.c.organization_id == data.organization_id,
            organization_courses.c.course_id == data.program_id,
        )
    ).fetchone()
    if not op_exists:
        program = db.query(Course).filter(Course.id == data.program_id).first()
        p_name = program.name if program else f"ID {data.program_id}"
        raise HTTPException(400, f"Organization '{org.name}' does not offer program '{p_name}'")

    # Validate program belongs to course type
    program = db.query(Course).filter(Course.id == data.program_id).first()
    if not program or program.course_type_id != data.course_type_id:
        raise HTTPException(400, "Program does not belong to the selected course type")

    # Validate stream (if Class 12)
    stream = None
    stream_name = None
    if data.class_level == "Class 12":
        if not data.stream_id:
            raise HTTPException(400, "Stream is required for Class 12")
        stream = db.query(Stream).filter(Stream.id == data.stream_id).first()
        if not stream:
            raise HTTPException(404, f"Stream with id {data.stream_id} not found")
        stream_name = stream.name

    # Validate subjects exist and are mapped to board
    for entry in data.subjects:
        subj = db.query(SubjectCatalog).filter(SubjectCatalog.id == entry.subject_id).first()
        if not subj:
            raise HTTPException(404, f"Subject with id {entry.subject_id} not found")

        # Check board-subject mapping
        bsm = db.execute(
            board_subject_mapping.select().where(
                board_subject_mapping.c.board_id == data.board_id,
                board_subject_mapping.c.subject_id == entry.subject_id,
                board_subject_mapping.c.class_level == data.class_level,
            )
        ).fetchone()
        if not bsm:
            raise HTTPException(400, f"Subject '{subj.name}' is not offered by board '{board.board_name}' for {data.class_level}")

        if entry.marks > entry.max_marks:
            raise HTTPException(400, f"Marks ({entry.marks}) cannot exceed max marks ({entry.max_marks}) for subject '{subj.name}'")

    # Check subject constraints
    constraint = db.query(CourseSubjectConstraint).filter(
        CourseSubjectConstraint.course_id == data.program_id
    ).first()
    if constraint:
        if len(data.subjects) < constraint.min_subjects:
            raise HTTPException(400, f"Minimum {constraint.min_subjects} subjects required, got {len(data.subjects)}")
        if len(data.subjects) > constraint.max_subjects:
            raise HTTPException(400, f"Maximum {constraint.max_subjects} subjects allowed, got {len(data.subjects)}")

    # Check for duplicate subjects
    subj_ids = [e.subject_id for e in data.subjects]
    if len(subj_ids) != len(set(subj_ids)):
        raise HTTPException(400, "Duplicate subjects are not allowed")

    # Assign year bucket
    bucket = assign_year_bucket(db, data.exam_year)

    # Create records — one StudentScore per subject for backward compat with normalization
    ct = db.query(CourseType).filter(CourseType.id == data.course_type_id).first()
    created_subjects = []
    first_student_id = None

    for entry in data.subjects:
        subj = db.query(SubjectCatalog).filter(SubjectCatalog.id == entry.subject_id).first()
        pct = compute_percentage(entry.marks, entry.max_marks)

        record = StudentScore(
            student_name=data.student_name.strip(),
            board_id=data.board_id,
            class_level=data.class_level,
            stream=stream_name,
            stream_id=data.stream_id,
            subject=subj.name,
            marks=entry.marks,
            max_marks=entry.max_marks,
            exam_year=data.exam_year,
            year_bucket_id=bucket.bucket_id if bucket else None,
            percentage_score=pct,
            organization_id=data.organization_id,
            course_id=data.program_id,
            program_id=data.program_id,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        if first_student_id is None:
            first_student_id = record.student_id

        # Also create StudentSubjectMapping
        ssm = StudentSubjectMapping(
            student_id=record.student_id,
            subject_id=entry.subject_id,
            marks=entry.marks,
            max_marks=entry.max_marks,
            percentage=pct,
        )
        db.add(ssm)

        # Update statistics
        if bucket:
            update_statistics_incremental(
                db,
                board_id=data.board_id,
                subject=subj.name,
                year_bucket_id=bucket.bucket_id,
                new_score=pct,
            )

        created_subjects.append({
            "subject": subj.name,
            "marks": entry.marks,
            "max_marks": entry.max_marks,
            "percentage": pct,
        })

    db.commit()

    return AcademicRecordResponse(
        student_id=first_student_id,
        student_name=data.student_name,
        board_name=board.board_name,
        class_level=data.class_level,
        stream_name=stream_name,
        organization_name=org.name,
        course_type_name=ct.name if ct else "Unknown",
        program_name=program.name,
        exam_year=data.exam_year,
        subjects=created_subjects,
        message=f"Academic record created with {len(created_subjects)} subjects",
    )


# ── Validate Subject Combination ─────────────────────────────────

@router.post("/validate-subject-combination", response_model=ValidationResult)
def validate_subject_combination(data: ValidateSubjectCombinationRequest, db: Session = Depends(get_db)):
    """Validate that a subject combination is valid for the given board, class level, and stream."""
    errors = []
    warnings = []

    board = db.query(Board).filter(Board.board_id == data.board_id).first()
    if not board:
        return ValidationResult(is_valid=False, errors=["Board not found"])

    # Check each subject
    for sid in data.subject_ids:
        subj = db.query(SubjectCatalog).filter(SubjectCatalog.id == sid).first()
        if not subj:
            errors.append(f"Subject with id {sid} not found")
            continue

        bsm = db.execute(
            board_subject_mapping.select().where(
                board_subject_mapping.c.board_id == data.board_id,
                board_subject_mapping.c.subject_id == sid,
                board_subject_mapping.c.class_level == data.class_level,
            )
        ).fetchone()
        if not bsm:
            errors.append(f"'{subj.name}' is not available for {board.board_name} ({data.class_level})")

    # Check stream mapping if stream provided
    if data.stream_id:
        stream_rows = db.execute(
            stream_subject_mapping.select().where(
                stream_subject_mapping.c.stream_id == data.stream_id
            )
        ).fetchall()
        stream_subj_ids = set(r.subject_id for r in stream_rows)
        for sid in data.subject_ids:
            if sid not in stream_subj_ids:
                subj = db.query(SubjectCatalog).filter(SubjectCatalog.id == sid).first()
                if subj:
                    warnings.append(f"'{subj.name}' is not part of the selected stream")

    # Check duplicates
    if len(data.subject_ids) != len(set(data.subject_ids)):
        errors.append("Duplicate subjects detected")

    # Check constraints
    if data.program_id:
        constraint = db.query(CourseSubjectConstraint).filter(
            CourseSubjectConstraint.course_id == data.program_id
        ).first()
        if constraint:
            if len(data.subject_ids) < constraint.min_subjects:
                errors.append(f"Need at least {constraint.min_subjects} subjects")
            if len(data.subject_ids) > constraint.max_subjects:
                errors.append(f"Cannot exceed {constraint.max_subjects} subjects")

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )

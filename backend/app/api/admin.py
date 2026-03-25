"""Admin CRUD API — Boards, Organizations, Streams, Subjects, Mappings."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.models import (
    Board, Organization, CourseType, Course, Stream, SubjectCatalog,
    CourseSubjectConstraint,
    organization_courses, org_course_type_mapping,
    board_subject_mapping, stream_subject_mapping,
)
from app.schemas.schemas import (
    BoardOut, BoardCreate, BoardUpdate,
    OrganizationOut, OrganizationCreate, OrganizationUpdate,
    StreamOut, StreamCreate,
    SubjectCatalogOut, SubjectCreate,
    CourseTypeOut, CourseOut,
    MappingCreate,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Boards CRUD ──────────────────────────────────────────────────

@router.get("/boards", response_model=list[BoardOut])
def admin_list_boards(db: Session = Depends(get_db)):
    return db.query(Board).order_by(Board.board_name).all()


@router.post("/boards", response_model=BoardOut, status_code=201)
def admin_create_board(data: BoardCreate, db: Session = Depends(get_db)):
    existing = db.query(Board).filter(Board.board_name == data.board_name).first()
    if existing:
        raise HTTPException(400, f"Board '{data.board_name}' already exists")
    board = Board(**data.model_dump())
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


@router.put("/boards/{board_id}", response_model=BoardOut)
def admin_update_board(board_id: int, data: BoardUpdate, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.board_id == board_id).first()
    if not board:
        raise HTTPException(404, "Board not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(board, k, v)
    db.commit()
    db.refresh(board)
    return board


@router.delete("/boards/{board_id}")
def admin_delete_board(board_id: int, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.board_id == board_id).first()
    if not board:
        raise HTTPException(404, "Board not found")
    db.delete(board)
    db.commit()
    return {"detail": "Board deleted"}


# ── Organizations CRUD ───────────────────────────────────────────

@router.get("/organizations", response_model=list[OrganizationOut])
def admin_list_orgs(db: Session = Depends(get_db)):
    return db.query(Organization).order_by(Organization.name).all()


@router.post("/organizations", response_model=OrganizationOut, status_code=201)
def admin_create_org(data: OrganizationCreate, db: Session = Depends(get_db)):
    existing = db.query(Organization).filter(Organization.name == data.name).first()
    if existing:
        raise HTTPException(400, f"Organization '{data.name}' already exists")
    org = Organization(**data.model_dump())
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.put("/organizations/{org_id}", response_model=OrganizationOut)
def admin_update_org(org_id: int, data: OrganizationUpdate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(org, k, v)
    db.commit()
    db.refresh(org)
    return org


@router.delete("/organizations/{org_id}")
def admin_delete_org(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    db.delete(org)
    db.commit()
    return {"detail": "Organization deleted"}


@router.get("/org-detail")
def admin_org_detail(organization_id: int = Query(...), db: Session = Depends(get_db)):
    """Full detail for an org: course types + programs per course type."""
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")

    # Org → Course Types (from mapping)
    ct_rows = db.execute(
        org_course_type_mapping.select().where(
            org_course_type_mapping.c.organization_id == organization_id
        )
    ).fetchall()
    ct_ids = [r.course_type_id for r in ct_rows]
    course_types_out = []

    for ct_id in ct_ids:
        ct = db.query(CourseType).filter(CourseType.id == ct_id).first()
        if not ct:
            continue

        # Programs (courses) offered by this org + this course type
        programs = (
            db.query(Course)
            .join(organization_courses, Course.id == organization_courses.c.course_id)
            .filter(
                organization_courses.c.organization_id == organization_id,
                Course.course_type_id == ct_id,
            )
            .order_by(Course.name)
            .all()
        )

        course_types_out.append({
            "id": ct.id,
            "name": ct.name,
            "description": ct.description,
            "programs": [
                {"id": p.id, "name": p.name, "description": p.description}
                for p in programs
            ],
        })

    return {
        "id": org.id,
        "name": org.name,
        "location": org.location,
        "active": org.active,
        "course_types": course_types_out,
    }


# ── Streams CRUD ─────────────────────────────────────────────────

@router.get("/streams", response_model=list[StreamOut])
def admin_list_streams(db: Session = Depends(get_db)):
    return db.query(Stream).order_by(Stream.name).all()


@router.post("/streams", response_model=StreamOut, status_code=201)
def admin_create_stream(data: StreamCreate, db: Session = Depends(get_db)):
    existing = db.query(Stream).filter(Stream.name == data.name).first()
    if existing:
        raise HTTPException(400, f"Stream '{data.name}' already exists")
    stream = Stream(**data.model_dump())
    db.add(stream)
    db.commit()
    db.refresh(stream)
    return stream


@router.delete("/streams/{stream_id}")
def admin_delete_stream(stream_id: int, db: Session = Depends(get_db)):
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(404, "Stream not found")
    db.delete(stream)
    db.commit()
    return {"detail": "Stream deleted"}


# ── Subjects CRUD ────────────────────────────────────────────────

@router.get("/subjects", response_model=list[SubjectCatalogOut])
def admin_list_subjects(db: Session = Depends(get_db)):
    return db.query(SubjectCatalog).order_by(SubjectCatalog.name).all()


@router.post("/subjects", response_model=SubjectCatalogOut, status_code=201)
def admin_create_subject(data: SubjectCreate, db: Session = Depends(get_db)):
    subj = SubjectCatalog(**data.model_dump())
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return subj


@router.delete("/subjects/{subject_id}")
def admin_delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subj = db.query(SubjectCatalog).filter(SubjectCatalog.id == subject_id).first()
    if not subj:
        raise HTTPException(404, "Subject not found")
    db.delete(subj)
    db.commit()
    return {"detail": "Subject deleted"}


# ── Board ↔ Subject Mapping ──────────────────────────────────────

@router.get("/board-subject-mapping")
def admin_list_board_subjects(
    board_id: Optional[int] = Query(None),
    class_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = board_subject_mapping.select()
    if board_id:
        q = q.where(board_subject_mapping.c.board_id == board_id)
    if class_level:
        q = q.where(board_subject_mapping.c.class_level == class_level)
    rows = db.execute(q).fetchall()

    result = []
    for r in rows:
        subj = db.query(SubjectCatalog).filter(SubjectCatalog.id == r.subject_id).first()
        board = db.query(Board).filter(Board.board_id == r.board_id).first()
        result.append({
            "id": r.id,
            "board_id": r.board_id,
            "board_name": board.board_name if board else "Unknown",
            "subject_id": r.subject_id,
            "subject_name": subj.name if subj else "Unknown",
            "class_level": r.class_level,
        })
    return result


@router.post("/board-subject-mapping", status_code=201)
def admin_add_board_subject(data: MappingCreate, db: Session = Depends(get_db)):
    db.execute(board_subject_mapping.insert().values(
        board_id=data.source_id,
        subject_id=data.target_id,
        class_level=data.class_level or "Class 12",
    ))
    db.commit()
    return {"detail": "Board-Subject mapping added"}


@router.delete("/board-subject-mapping/{mapping_id}")
def admin_remove_board_subject(mapping_id: int, db: Session = Depends(get_db)):
    db.execute(board_subject_mapping.delete().where(board_subject_mapping.c.id == mapping_id))
    db.commit()
    return {"detail": "Board-Subject mapping removed"}


# ── Stream ↔ Subject Mapping ────────────────────────────────────

@router.get("/stream-subject-mapping")
def admin_list_stream_subjects(
    stream_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = stream_subject_mapping.select()
    if stream_id:
        q = q.where(stream_subject_mapping.c.stream_id == stream_id)
    rows = db.execute(q).fetchall()

    result = []
    for r in rows:
        subj = db.query(SubjectCatalog).filter(SubjectCatalog.id == r.subject_id).first()
        stream = db.query(Stream).filter(Stream.id == r.stream_id).first()
        result.append({
            "id": r.id,
            "stream_id": r.stream_id,
            "stream_name": stream.name if stream else "Unknown",
            "subject_id": r.subject_id,
            "subject_name": subj.name if subj else "Unknown",
        })
    return result


@router.post("/stream-subject-mapping", status_code=201)
def admin_add_stream_subject(data: MappingCreate, db: Session = Depends(get_db)):
    db.execute(stream_subject_mapping.insert().values(
        stream_id=data.source_id,
        subject_id=data.target_id,
    ))
    db.commit()
    return {"detail": "Stream-Subject mapping added"}


@router.delete("/stream-subject-mapping/{mapping_id}")
def admin_remove_stream_subject(mapping_id: int, db: Session = Depends(get_db)):
    db.execute(stream_subject_mapping.delete().where(stream_subject_mapping.c.id == mapping_id))
    db.commit()
    return {"detail": "Stream-Subject mapping removed"}


# ── Org ↔ Course Type Mapping ────────────────────────────────────

@router.get("/org-course-type-mapping")
def admin_list_org_course_types(
    organization_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = org_course_type_mapping.select()
    if organization_id:
        q = q.where(org_course_type_mapping.c.organization_id == organization_id)
    rows = db.execute(q).fetchall()

    result = []
    for r in rows:
        org = db.query(Organization).filter(Organization.id == r.organization_id).first()
        ct = db.query(CourseType).filter(CourseType.id == r.course_type_id).first()
        result.append({
            "organization_id": r.organization_id,
            "organization_name": org.name if org else "Unknown",
            "course_type_id": r.course_type_id,
            "course_type_name": ct.name if ct else "Unknown",
        })
    return result


@router.post("/org-course-type-mapping", status_code=201)
def admin_add_org_course_type(data: MappingCreate, db: Session = Depends(get_db)):
    # Check if already exists
    existing = db.execute(
        org_course_type_mapping.select().where(
            org_course_type_mapping.c.organization_id == data.source_id,
            org_course_type_mapping.c.course_type_id == data.target_id,
        )
    ).fetchone()
    if existing:
        raise HTTPException(400, "Mapping already exists")
    db.execute(org_course_type_mapping.insert().values(
        organization_id=data.source_id,
        course_type_id=data.target_id,
    ))
    db.commit()
    return {"detail": "Org-CourseType mapping added"}


@router.delete("/org-course-type-mapping")
def admin_remove_org_course_type(
    organization_id: int = Query(...),
    course_type_id: int = Query(...),
    db: Session = Depends(get_db),
):
    db.execute(org_course_type_mapping.delete().where(
        org_course_type_mapping.c.organization_id == organization_id,
        org_course_type_mapping.c.course_type_id == course_type_id,
    ))
    db.commit()
    return {"detail": "Org-CourseType mapping removed"}


# ── Org ↔ Program (Course) Mapping ──────────────────────────────

@router.post("/org-program-mapping", status_code=201)
def admin_add_org_program(data: MappingCreate, db: Session = Depends(get_db)):
    """Add a program (course) to an organization."""
    existing = db.execute(
        organization_courses.select().where(
            organization_courses.c.organization_id == data.source_id,
            organization_courses.c.course_id == data.target_id,
        )
    ).fetchone()
    if existing:
        raise HTTPException(400, "Mapping already exists")
    db.execute(organization_courses.insert().values(
        organization_id=data.source_id,
        course_id=data.target_id,
    ))
    db.commit()
    return {"detail": "Org-Program mapping added"}


@router.delete("/org-program-mapping")
def admin_remove_org_program(
    organization_id: int = Query(...),
    course_id: int = Query(...),
    db: Session = Depends(get_db),
):
    db.execute(organization_courses.delete().where(
        organization_courses.c.organization_id == organization_id,
        organization_courses.c.course_id == course_id,
    ))
    db.commit()
    return {"detail": "Org-Program mapping removed"}

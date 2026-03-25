"""Cross-Board Normalization System — FastAPI Entry Point."""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import engine, SessionLocal, Base
from app.models.models import (
    Board, YearBucket, Organization, CourseType, Course, SubjectCatalog,
    Stream, CourseSubjectConstraint, StudentScore,
    organization_courses, org_course_type_mapping,
    board_subject_mapping, stream_subject_mapping,
)
from app.api import normalization, boards, students, academic, admin, student_extension_routes, analytics, advanced_normalization
from app.services.data_generation import generate_synthetic_students


# ── Seed data ────────────────────────────────────────────────────

SEED_BOARDS = [
    {"board_name": "CBSE", "board_category": "National", "country": "India"},
    {"board_name": "ICSE", "board_category": "National", "country": "India"},
    {"board_name": "Maharashtra Board", "board_category": "State", "country": "India"},
    {"board_name": "Karnataka Board", "board_category": "State", "country": "India"},
    {"board_name": "Tamil Nadu Board", "board_category": "State", "country": "India"},
    {"board_name": "UP Board", "board_category": "State", "country": "India"},
    {"board_name": "West Bengal Board", "board_category": "State", "country": "India"},
    {"board_name": "Kerala Board", "board_category": "State", "country": "India"},
    {"board_name": "AP Board", "board_category": "State", "country": "India"},
    {"board_name": "Rajasthan Board", "board_category": "State", "country": "India"},
]

SEED_BUCKETS = [
    {"start_year": 2000, "end_year": 2003, "bucket_label": "2000–2003"},
    {"start_year": 2004, "end_year": 2007, "bucket_label": "2004–2007"},
    {"start_year": 2008, "end_year": 2011, "bucket_label": "2008–2011"},
    {"start_year": 2012, "end_year": 2015, "bucket_label": "2012–2015"},
    {"start_year": 2016, "end_year": 2019, "bucket_label": "2016–2019"},
    {"start_year": 2020, "end_year": 2023, "bucket_label": "2020–2023"},
    {"start_year": 2024, "end_year": 2027, "bucket_label": "2024–2027"},
]

SEED_ORGANIZATIONS = [
    {"name": "IIT Gandhinagar", "location": "Gujarat"},
    {"name": "IIT Jammu", "location": "Jammu & Kashmir"},
    {"name": "IIT Bombay", "location": "Maharashtra"},
    {"name": "IIT Delhi", "location": "Delhi"},
    {"name": "IIT Madras", "location": "Tamil Nadu"},
    {"name": "IIT Patna", "location": "Bihar"},
    {"name": "NIT Trichy", "location": "Tamil Nadu"},
    {"name": "BITS Pilani", "location": "Rajasthan"},
]

SEED_COURSE_TYPES = [
    {"name": "UG", "description": "Undergraduate Programs"},
    {"name": "PG", "description": "Postgraduate Programs"},
    {"name": "PGD", "description": "Post Graduate Diploma"},
    {"name": "Diploma", "description": "Diploma Certificate Program"},
    {"name": "Certification", "description": "Professional Certification"},
]

SEED_STREAMS = [
    {"name": "General", "class_level": "Class 10", "description": "General stream for Class 10"},
    {"name": "Science (PCM)", "class_level": "Class 12", "description": "Physics, Chemistry, Mathematics"},
    {"name": "Science (PCB)", "class_level": "Class 12", "description": "Physics, Chemistry, Biology"},
    {"name": "Commerce", "class_level": "Class 12", "description": "Commerce stream"},
    {"name": "Arts", "class_level": "Class 12", "description": "Humanities/Arts stream"},
]

# Subjects — standalone catalog (not tied to a specific course)
SEED_SUBJECTS = [
    # Class 10 subjects
    "Mathematics", "Science", "Social Studies", "English", "Hindi",
    "Computer Applications", "Sanskrit",
    # Class 12 Science
    "Physics", "Chemistry", "Biology", "Computer Science", "Physical Education",
    # Class 12 Commerce
    "Accountancy", "Business Studies", "Economics", "Informatics Practices",
    # Class 12 Arts
    "History", "Political Science", "Geography", "Sociology", "Psychology",
]

# Board → Subject mappings: (board_name, subject_name, class_level)
SEED_BOARD_SUBJECTS = {
    "CBSE": {
        "Class 10": ["Mathematics", "Science", "Social Studies", "English", "Hindi", "Computer Applications", "Sanskrit"],
        "Class 12": ["Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Physical Education",
                     "English", "Hindi", "Accountancy", "Business Studies", "Economics", "Informatics Practices",
                     "History", "Political Science", "Geography", "Sociology", "Psychology"],
    },
    "ICSE": {
        "Class 10": ["Mathematics", "Science", "Social Studies", "English", "Hindi", "Computer Applications"],
        "Class 12": ["Mathematics", "Physics", "Chemistry", "Biology", "Computer Science", "Physical Education",
                     "English", "Accountancy", "Business Studies", "Economics",
                     "History", "Political Science", "Geography", "Sociology"],
    },
    "Maharashtra Board": {
        "Class 10": ["Mathematics", "Science", "Social Studies", "English", "Hindi"],
        "Class 12": ["Mathematics", "Physics", "Chemistry", "Biology", "English",
                     "Accountancy", "Business Studies", "Economics",
                     "History", "Political Science", "Geography"],
    },
    "Karnataka Board": {
        "Class 10": ["Mathematics", "Science", "Social Studies", "English", "Hindi", "Sanskrit"],
        "Class 12": ["Mathematics", "Physics", "Chemistry", "Biology", "English",
                     "Computer Science", "Accountancy", "Business Studies", "Economics",
                     "History", "Political Science", "Geography"],
    },
}

# Stream → Subject mappings
SEED_STREAM_SUBJECTS = {
    "General": ["Mathematics", "Science", "Social Studies", "English", "Hindi", "Computer Applications"],
    "Science (PCM)": ["Mathematics", "Physics", "Chemistry", "English", "Computer Science", "Physical Education"],
    "Science (PCB)": ["Physics", "Chemistry", "Biology", "English", "Physical Education"],
    "Commerce": ["Accountancy", "Business Studies", "Economics", "English", "Mathematics", "Informatics Practices"],
    "Arts": ["History", "Political Science", "Geography", "English", "Economics", "Sociology"],
}

# Organization → Course Type mappings
SEED_ORG_COURSE_TYPES = {
    "IIT Gandhinagar": ["UG", "PG", "PGD", "Certification"],
    "IIT Jammu": ["UG", "PG"],
    "IIT Bombay": ["UG", "PG", "PGD"],
    "IIT Delhi": ["UG", "PG", "PGD"],
    "IIT Madras": ["UG", "PG", "PGD", "Certification"],
    "IIT Patna": ["UG", "PG"],
    "NIT Trichy": ["UG", "PG", "Diploma"],
    "BITS Pilani": ["UG", "PG", "Diploma"],
}

# (course_name, course_type_name, description, offered_by_orgs)
SEED_COURSES = [
    ("B.Tech Computer Science", "UG", "BTech in Computer Science & Engineering",
     ["IIT Bombay", "IIT Delhi", "IIT Madras", "IIT Gandhinagar", "IIT Patna", "NIT Trichy", "BITS Pilani"]),
    ("B.Tech Electrical Engineering", "UG", "BTech in Electrical Engineering",
     ["IIT Bombay", "IIT Delhi", "IIT Madras", "IIT Gandhinagar", "NIT Trichy"]),
    ("B.Tech Mechanical Engineering", "UG", "BTech in Mechanical Engineering",
     ["IIT Bombay", "IIT Delhi", "IIT Patna", "NIT Trichy", "BITS Pilani"]),
    ("BSc Physics", "UG", "Bachelor of Science in Physics",
     ["IIT Gandhinagar", "IIT Jammu", "BITS Pilani"]),
    ("BSc Mathematics", "UG", "Bachelor of Science in Mathematics",
     ["IIT Gandhinagar", "IIT Jammu", "IIT Delhi"]),
    ("M.Tech CSE", "PG", "Master of Technology in Computer Science",
     ["IIT Bombay", "IIT Delhi", "IIT Madras", "IIT Gandhinagar"]),
    ("M.Tech EE", "PG", "Master of Technology in Electrical Engineering",
     ["IIT Bombay", "IIT Delhi", "IIT Madras"]),
    ("MBA", "PG", "Master of Business Administration",
     ["IIT Bombay", "IIT Delhi", "IIT Madras"]),
    ("MSc Physics", "PG", "Master of Science in Physics",
     ["IIT Gandhinagar", "IIT Jammu"]),
    ("MSc Mathematics", "PG", "Master of Science in Mathematics",
     ["IIT Gandhinagar", "IIT Jammu", "IIT Delhi"]),
    ("PGD Data Science", "PGD", "PGD in Data Science & AI",
     ["IIT Gandhinagar", "IIT Bombay", "IIT Madras"]),
    ("PGD Cybersecurity", "PGD", "PGD in Cybersecurity",
     ["IIT Bombay", "IIT Delhi"]),
    ("PGD AI & ML", "PGD", "PGD in Artificial Intelligence & Machine Learning",
     ["IIT Gandhinagar", "IIT Delhi", "IIT Madras"]),
    ("Diploma Mechanical", "Diploma", "Diploma in Mechanical Engineering",
     ["NIT Trichy", "BITS Pilani"]),
    ("Diploma Electronics", "Diploma", "Diploma in Electronics",
     ["NIT Trichy"]),
    ("Certification Renewable Energy", "Certification", "Certification in Renewable Energy",
     ["IIT Gandhinagar", "IIT Madras"]),
    ("Certification IoT", "Certification", "Certification in IoT & Embedded Systems",
     ["IIT Gandhinagar"]),
]


def _seed(db):
    """Populate all reference tables if empty."""

    # ── Boards ───────────────────────────────────────────────
    if db.query(Board).count() == 0:
        for b in SEED_BOARDS:
            db.add(Board(**b))
        db.commit()

    # ── Year buckets ─────────────────────────────────────────
    if db.query(YearBucket).count() == 0:
        for yb in SEED_BUCKETS:
            db.add(YearBucket(**yb))
        db.commit()

    # ── Organizations ────────────────────────────────────────
    if db.query(Organization).count() == 0:
        for o in SEED_ORGANIZATIONS:
            db.add(Organization(**o))
        db.commit()

    # ── Course Types ─────────────────────────────────────────
    if db.query(CourseType).count() == 0:
        for ct in SEED_COURSE_TYPES:
            db.add(CourseType(**ct))
        db.commit()

    # ── Streams ──────────────────────────────────────────────
    if db.query(Stream).count() == 0:
        for s in SEED_STREAMS:
            db.add(Stream(**s))
        db.commit()

    # ── Subjects (standalone catalog) ────────────────────────
    if db.query(SubjectCatalog).count() == 0:
        for name in SEED_SUBJECTS:
            # Check for duplicate names
            if not db.query(SubjectCatalog).filter(SubjectCatalog.name == name).first():
                db.add(SubjectCatalog(name=name))
        db.commit()

    # ── Org → Course Type mappings ───────────────────────────
    existing_oct = db.execute(org_course_type_mapping.select()).fetchall()
    if not existing_oct:
        for org_name, ct_names in SEED_ORG_COURSE_TYPES.items():
            org = db.query(Organization).filter(Organization.name == org_name).first()
            if not org:
                continue
            for ct_name in ct_names:
                ct = db.query(CourseType).filter(CourseType.name == ct_name).first()
                if ct:
                    db.execute(org_course_type_mapping.insert().values(
                        organization_id=org.id, course_type_id=ct.id
                    ))
        db.commit()

    # ── Courses (Programs) + Org linkages ────────────────────
    if db.query(Course).count() == 0:
        for course_name, ctype_name, desc, org_names in SEED_COURSES:
            ctype = db.query(CourseType).filter(CourseType.name == ctype_name).first()
            if not ctype:
                continue

            course = Course(name=course_name, course_type_id=ctype.id, description=desc)
            db.add(course)
            db.commit()
            db.refresh(course)

            # Link to organizations
            for org_name in org_names:
                org = db.query(Organization).filter(Organization.name == org_name).first()
                if org:
                    db.execute(
                        organization_courses.insert().values(
                            organization_id=org.id, course_id=course.id
                        )
                    )

            # Add default subject constraint
            db.add(CourseSubjectConstraint(course_id=course.id, min_subjects=3, max_subjects=8))
            db.commit()

    # ── Board → Subject mappings ─────────────────────────────
    existing_bsm = db.execute(board_subject_mapping.select()).fetchall()
    if not existing_bsm:
        for board_name, levels in SEED_BOARD_SUBJECTS.items():
            board = db.query(Board).filter(Board.board_name == board_name).first()
            if not board:
                continue
            for class_level, subject_names in levels.items():
                for subj_name in subject_names:
                    subj = db.query(SubjectCatalog).filter(SubjectCatalog.name == subj_name).first()
                    if subj:
                        db.execute(board_subject_mapping.insert().values(
                            board_id=board.board_id, subject_id=subj.id, class_level=class_level
                        ))
        db.commit()

    # ── Stream → Subject mappings ────────────────────────────
    existing_ssm = db.execute(stream_subject_mapping.select()).fetchall()
    if not existing_ssm:
        for stream_name, subject_names in SEED_STREAM_SUBJECTS.items():
            stream = db.query(Stream).filter(Stream.name == stream_name).first()
            if not stream:
                continue
            for subj_name in subject_names:
                subj = db.query(SubjectCatalog).filter(SubjectCatalog.name == subj_name).first()
                if subj:
                    db.execute(stream_subject_mapping.insert().values(
                        stream_id=stream.id, subject_id=subj.id
                    ))
        db.commit()


# ── Lifespan ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed(db)
        # Auto-generate ~1000 named students if not enough exist
        named_count = db.query(StudentScore).filter(
            StudentScore.student_name.isnot(None)
        ).count()
        if named_count < 100:
            generate_synthetic_students(db, target_students=1000)
    finally:
        db.close()
    yield


# ── App ──────────────────────────────────────────────────────────

app = FastAPI(
    title="Cross-Board Normalization System",
    description="Normalize student exam scores across different education boards using Z-score standardization.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(normalization.router)
app.include_router(boards.router)
app.include_router(students.router)
app.include_router(academic.router)
app.include_router(admin.router)
app.include_router(student_extension_routes.router)
app.include_router(analytics.router)
app.include_router(advanced_normalization.router)

# ── Serve Frontend Static Build ──────────────────────────────────
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA — all non-API routes get index.html."""
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))
else:
    @app.get("/")
    def root():
        return {"message": "Cross-Board Normalization API", "docs": "/docs"}

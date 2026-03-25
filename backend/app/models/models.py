from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database import Base


# ── Junction Tables (Many-to-Many) ──────────────────────────────

organization_courses = Table(
    "organization_courses",
    Base.metadata,
    Column("organization_id", Integer, ForeignKey("organizations.id"), primary_key=True),
    Column("course_id", Integer, ForeignKey("courses.id"), primary_key=True),
)

org_course_type_mapping = Table(
    "org_course_type_mapping",
    Base.metadata,
    Column("organization_id", Integer, ForeignKey("organizations.id"), primary_key=True),
    Column("course_type_id", Integer, ForeignKey("course_types.id"), primary_key=True),
)

board_subject_mapping = Table(
    "board_subject_mapping",
    Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("board_id", Integer, ForeignKey("boards.board_id"), nullable=False),
    Column("subject_id", Integer, ForeignKey("subjects_catalog.id"), nullable=False),
    Column("class_level", String(20), nullable=False, default="Class 12"),
)

stream_subject_mapping = Table(
    "stream_subject_mapping",
    Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("stream_id", Integer, ForeignKey("streams.id"), nullable=False),
    Column("subject_id", Integer, ForeignKey("subjects_catalog.id"), nullable=False),
)


# ── Reference Entities ──────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False)
    location = Column(String(200), nullable=True)
    active = Column(Boolean, default=True)

    courses = relationship("Course", secondary=organization_courses, back_populates="organizations")
    course_types = relationship("CourseType", secondary=org_course_type_mapping, back_populates="organizations")
    scores = relationship("StudentScore", back_populates="organization_rel")


class CourseType(Base):
    __tablename__ = "course_types"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(300), nullable=True)

    courses = relationship("Course", back_populates="course_type_rel")
    organizations = relationship("Organization", secondary=org_course_type_mapping, back_populates="course_types")


class Course(Base):
    """Represents a Program (e.g., M.Tech CSE, MBA, BSc Physics)."""
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    course_type_id = Column(Integer, ForeignKey("course_types.id"), nullable=False, index=True)
    description = Column(String(500), nullable=True)

    course_type_rel = relationship("CourseType", back_populates="courses")
    organizations = relationship("Organization", secondary=organization_courses, back_populates="courses")
    subjects = relationship("SubjectCatalog", back_populates="course_rel")
    scores = relationship("StudentScore", back_populates="course_rel")
    constraints = relationship("CourseSubjectConstraint", back_populates="course_rel", uselist=False)


class Stream(Base):
    __tablename__ = "streams"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    class_level = Column(String(20), nullable=False)  # "Class 10", "Class 12", "Both"
    description = Column(String(300), nullable=True)

    scores = relationship("StudentScore", back_populates="stream_rel")


class SubjectCatalog(Base):
    __tablename__ = "subjects_catalog"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True, index=True)

    course_rel = relationship("Course", back_populates="subjects")


class CourseSubjectConstraint(Base):
    __tablename__ = "course_subject_constraints"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, unique=True)
    min_subjects = Column(Integer, nullable=False, default=1)
    max_subjects = Column(Integer, nullable=False, default=10)

    course_rel = relationship("Course", back_populates="constraints")


# ── Core Entities ───────────────────────────────────────────────

class Board(Base):
    __tablename__ = "boards"

    board_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    board_name = Column(String(100), unique=True, nullable=False)
    board_category = Column(String(50), nullable=True)
    country = Column(String(50), default="India")
    active = Column(Boolean, default=True)

    scores = relationship("StudentScore", back_populates="board_rel")
    statistics = relationship("BoardStatistic", back_populates="board_rel")


class YearBucket(Base):
    __tablename__ = "year_buckets"

    bucket_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    start_year = Column(Integer, nullable=False)
    end_year = Column(Integer, nullable=False)
    bucket_label = Column(String(20), nullable=False)

    scores = relationship("StudentScore", back_populates="year_bucket_rel")


class StudentScore(Base):
    __tablename__ = "student_scores"

    student_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_name = Column(String(200), nullable=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.board_id"), nullable=False)
    class_level = Column(String(20), nullable=True, default="Class 12")
    stream = Column(String(50), nullable=True)  # Legacy text field
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True, index=True)
    subject = Column(String(100), nullable=False)
    marks = Column(Float, nullable=False)
    max_marks = Column(Float, nullable=False)
    exam_year = Column(Integer, nullable=False, index=True)
    year_bucket_id = Column(Integer, ForeignKey("year_buckets.bucket_id"), nullable=True)
    percentage_score = Column(Float, nullable=True)
    recent_education = Column(String(200), nullable=True)
    attendance = Column(Float, nullable=True)  # DEPRECATED: kept for backward compat (used by performance_model.py)
    performance_label = Column(String(20), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Academic mapping FKs
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True, index=True)  # = program_id

    @property
    def program_id(self):
        """Alias for course_id — courses table represents programs."""
        return self.course_id

    @program_id.setter
    def program_id(self, value):
        self.course_id = value

    board_rel = relationship("Board", back_populates="scores")
    year_bucket_rel = relationship("YearBucket", back_populates="scores")
    organization_rel = relationship("Organization", back_populates="scores")
    course_rel = relationship("Course", back_populates="scores", foreign_keys=[course_id])
    stream_rel = relationship("Stream", back_populates="scores")
    subject_entries = relationship("StudentSubjectMapping", back_populates="student_score")


class StudentSubjectMapping(Base):
    __tablename__ = "student_subject_mapping"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("student_scores.student_id"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects_catalog.id"), nullable=False)
    marks = Column(Float, nullable=True)
    max_marks = Column(Float, nullable=True)
    percentage = Column(Float, nullable=True)

    student_score = relationship("StudentScore", back_populates="subject_entries")
    subject = relationship("SubjectCatalog")


class BoardStatistic(Base):
    __tablename__ = "board_statistics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey("boards.board_id"), nullable=False)
    subject = Column(String(100), nullable=False)
    year_bucket_id = Column(Integer, ForeignKey("year_buckets.bucket_id"), nullable=False)
    mean_score = Column(Float, nullable=False, default=0.0)
    std_dev = Column(Float, nullable=False, default=0.0)
    sample_size = Column(Integer, nullable=False, default=0)
    m2 = Column(Float, nullable=False, default=0.0)
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    board_rel = relationship("Board", back_populates="statistics")
    year_bucket_rel = relationship("YearBucket")

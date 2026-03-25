from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


# ── Request Schemas ──────────────────────────────────────────────

class NormalizeScoreRequest(BaseModel):
    board: str = Field(..., description="Board name, e.g. CBSE")
    subject: str = Field(..., description="Subject name, e.g. Mathematics")
    year: int = Field(..., ge=1990, le=2030, description="Exam year")
    marks: float = Field(..., ge=0, description="Marks obtained")
    max_marks: float = Field(..., gt=0, description="Maximum marks")
    class_level: Optional[str] = Field(None, description="Class 10 or Class 12")
    stream: Optional[str] = Field(None, description="Stream name")

    @field_validator("marks")
    @classmethod
    def marks_must_be_valid(cls, v, info):
        return v


class IngestScoreRequest(BaseModel):
    student_name: Optional[str] = Field(None, description="Student full name")
    board: str
    class_level: str = Field("Class 12", description="Class 10 or Class 12")
    stream: Optional[str] = Field(None, description="Stream for Class 12")
    stream_id: Optional[int] = Field(None, description="Stream ID")
    subject: str
    year: int = Field(..., ge=1990, le=2030)
    marks: float = Field(..., ge=0)
    max_marks: float = Field(..., gt=0)
    recent_education: Optional[str] = None
    organization_id: Optional[int] = Field(None, description="Organization ID")
    course_id: Optional[int] = Field(None, description="Course/Program ID")
    program_id: Optional[int] = Field(None, description="Program ID (alias for course_id)")


class AcademicRecordCreate(BaseModel):
    """Full academic record with multi-subject support."""
    student_name: str = Field(..., min_length=1)
    board_id: int
    class_level: str = Field(..., description="Class 10 or Class 12")
    stream_id: Optional[int] = Field(None, description="Stream ID (required for Class 12)")
    organization_id: int
    course_type_id: int
    program_id: int  # maps to courses.id
    exam_year: int = Field(..., ge=1990, le=2030)
    subjects: list["SubjectEntry"] = Field(..., min_length=1)


class SubjectEntry(BaseModel):
    subject_id: int
    marks: float = Field(..., ge=0)
    max_marks: float = Field(..., gt=0)


class ValidateSubjectCombinationRequest(BaseModel):
    board_id: int
    class_level: str
    stream_id: Optional[int] = None
    subject_ids: list[int]
    program_id: Optional[int] = None


# ── Admin CRUD Schemas ───────────────────────────────────────────

class BoardCreate(BaseModel):
    board_name: str = Field(..., min_length=1)
    board_category: Optional[str] = None
    country: str = "India"

class BoardUpdate(BaseModel):
    board_name: Optional[str] = None
    board_category: Optional[str] = None
    country: Optional[str] = None
    active: Optional[bool] = None

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1)
    location: Optional[str] = None

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    active: Optional[bool] = None

class StreamCreate(BaseModel):
    name: str = Field(..., min_length=1)
    class_level: str = Field(..., description="Class 10, Class 12, or Both")
    description: Optional[str] = None

class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1)
    course_id: Optional[int] = None

class MappingCreate(BaseModel):
    """Generic mapping creation."""
    source_id: int
    target_id: int
    class_level: Optional[str] = None  # For board-subject mapping


# ── Response Schemas ─────────────────────────────────────────────

class NormalizeScoreResponse(BaseModel):
    board: str
    subject: str
    year: int
    marks: float
    max_marks: float
    percentage_score: float
    z_score: float
    normalized_score: float
    percentile: float
    year_bucket: str
    mean_used: float
    std_dev_used: float
    sample_size: int


class BoardOut(BaseModel):
    board_id: int
    board_name: str
    board_category: Optional[str] = None
    country: str
    active: bool

    class Config:
        from_attributes = True


class YearBucketOut(BaseModel):
    bucket_id: int
    start_year: int
    end_year: int
    bucket_label: str

    class Config:
        from_attributes = True


class BoardStatisticOut(BaseModel):
    board_id: int
    board_name: str
    subject: str
    year_bucket: str
    mean_score: float
    std_dev: float
    sample_size: int
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True


class IngestScoreResponse(BaseModel):
    student_id: int
    student_name: Optional[str] = None
    board: str
    class_level: str
    stream: Optional[str] = None
    subject: str
    exam_year: int
    marks: float
    max_marks: float
    percentage_score: float
    year_bucket: str
    message: str
    organization_id: Optional[int] = None
    course_id: Optional[int] = None
    program_id: Optional[int] = None


class StatsOverview(BaseModel):
    total_boards: int
    total_scores: int
    total_subjects: int
    total_statistics: int


# ── Academic Entity Schemas ──────────────────────────────────────

class OrganizationOut(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    active: bool

    class Config:
        from_attributes = True


class CourseTypeOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class CourseOut(BaseModel):
    id: int
    name: str
    course_type_id: int
    course_type_name: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class StreamOut(BaseModel):
    id: int
    name: str
    class_level: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class SubjectCatalogOut(BaseModel):
    id: int
    name: str
    course_id: Optional[int] = None

    class Config:
        from_attributes = True


class AcademicMetaResponse(BaseModel):
    organizations: list[OrganizationOut]
    course_types: list[CourseTypeOut]
    courses: list[CourseOut]
    subjects: list[SubjectCatalogOut]


class ValidationResult(BaseModel):
    is_valid: bool
    errors: list[str] = []
    warnings: list[str] = []


class AcademicRecordResponse(BaseModel):
    student_id: int
    student_name: str
    board_name: str
    class_level: str
    stream_name: Optional[str] = None
    organization_name: str
    course_type_name: str
    program_name: str
    exam_year: int
    subjects: list[dict]
    message: str

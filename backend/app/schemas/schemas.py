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
    stream: Optional[str] = Field(None, description="Stream: Science (PCM), Science (PCB), Commerce, Arts, General")

    @field_validator("marks")
    @classmethod
    def marks_must_be_valid(cls, v, info):
        return v  # cross-field validation done at service layer


class IngestScoreRequest(BaseModel):
    student_name: Optional[str] = Field(None, description="Student full name")
    board: str
    class_level: str = Field("Class 12", description="Class 10 or Class 12")
    stream: Optional[str] = Field(None, description="Stream for Class 12")
    subject: str
    year: int = Field(..., ge=1990, le=2030)
    marks: float = Field(..., ge=0)
    max_marks: float = Field(..., gt=0)
    recent_education: Optional[str] = None


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


class StatsOverview(BaseModel):
    total_boards: int
    total_scores: int
    total_subjects: int
    total_statistics: int

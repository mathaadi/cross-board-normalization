from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database import Base


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
    class_level = Column(String(20), nullable=True, default="Class 12")  # "Class 10" or "Class 12"
    stream = Column(String(50), nullable=True)  # "Science (PCM)", "Science (PCB)", "Commerce", "Arts", "General"
    subject = Column(String(100), nullable=False)
    marks = Column(Float, nullable=False)
    max_marks = Column(Float, nullable=False)
    exam_year = Column(Integer, nullable=False)
    year_bucket_id = Column(Integer, ForeignKey("year_buckets.bucket_id"), nullable=True)
    percentage_score = Column(Float, nullable=True)
    recent_education = Column(String(200), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    board_rel = relationship("Board", back_populates="scores")
    year_bucket_rel = relationship("YearBucket", back_populates="scores")


class BoardStatistic(Base):
    __tablename__ = "board_statistics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey("boards.board_id"), nullable=False)
    subject = Column(String(100), nullable=False)
    year_bucket_id = Column(Integer, ForeignKey("year_buckets.bucket_id"), nullable=False)
    mean_score = Column(Float, nullable=False, default=0.0)
    std_dev = Column(Float, nullable=False, default=0.0)
    sample_size = Column(Integer, nullable=False, default=0)
    # Welford's algorithm running state
    m2 = Column(Float, nullable=False, default=0.0)
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    board_rel = relationship("Board", back_populates="statistics")
    year_bucket_rel = relationship("YearBucket")

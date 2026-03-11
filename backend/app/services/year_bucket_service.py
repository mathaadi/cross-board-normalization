from sqlalchemy.orm import Session

from app.models.models import YearBucket


def assign_year_bucket(db: Session, exam_year: int) -> YearBucket | None:
    """Find the year bucket that contains the given exam year."""
    bucket = (
        db.query(YearBucket)
        .filter(YearBucket.start_year <= exam_year, YearBucket.end_year >= exam_year)
        .first()
    )
    return bucket

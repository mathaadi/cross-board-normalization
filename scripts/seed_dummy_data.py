"""Seed script — populates the database with realistic dummy scores
for all 10 boards, 8 subjects, across all year buckets.

Run:  python scripts/seed_dummy_data.py
"""

import sys, os, random, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import SessionLocal, engine, Base
from app.models.models import Board, YearBucket, StudentScore, BoardStatistic
from app.services.feature_engineering import compute_percentage
from app.services.statistics_engine import recompute_all_statistics
from datetime import datetime, timezone

# ── Board-specific difficulty profiles ───────────────────────────
# Each board has a (mean, std_dev) that represents the typical
# percentage score distribution for that board.
BOARD_PROFILES = {
    "CBSE":              (68, 14),
    "ICSE":              (72, 12),
    "Maharashtra Board": (62, 16),
    "Karnataka Board":   (60, 15),
    "Tamil Nadu Board":  (65, 13),
    "UP Board":          (55, 18),
    "West Bengal Board": (63, 14),
    "Kerala Board":      (70, 11),
    "AP Board":          (61, 15),
    "Rajasthan Board":   (57, 17),
}

# Subject-level offsets from board mean
SUBJECT_OFFSETS = {
    "Mathematics":       -3,
    "Physics":           -2,
    "Chemistry":         -1,
    "Biology":            2,
    "English":            4,
    "Computer Science":   1,
    "Economics":          0,
    "History":            3,
}

SUBJECTS = list(SUBJECT_OFFSETS.keys())

# Max marks varies by board/subject
MAX_MARKS_OPTIONS = [100, 80, 70, 150]


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def generate_scores(db):
    boards = {b.board_name: b for b in db.query(Board).all()}
    buckets = db.query(YearBucket).order_by(YearBucket.start_year).all()

    if not boards or not buckets:
        print("ERROR: No boards or year buckets found. Run the backend first to seed them.")
        return 0

    count = 0
    random.seed(42)  # Reproducible

    for board_name, (board_mean, board_std) in BOARD_PROFILES.items():
        board = boards.get(board_name)
        if not board:
            print(f"  SKIP: Board '{board_name}' not found in DB")
            continue

        for subject in SUBJECTS:
            subj_offset = SUBJECT_OFFSETS[subject]
            effective_mean = board_mean + subj_offset
            effective_std = board_std

            for bucket in buckets:
                # Number of students per group: 15–40
                n_students = random.randint(15, 40)
                max_marks = random.choice(MAX_MARKS_OPTIONS)

                for _ in range(n_students):
                    # Sample a year within the bucket
                    year = random.randint(bucket.start_year, bucket.end_year)

                    # Generate realistic percentage, then convert to marks
                    pct = random.gauss(effective_mean, effective_std)
                    pct = clamp(pct, 5, 99)
                    marks = round(pct / 100 * max_marks, 1)
                    marks = clamp(marks, 0, max_marks)
                    actual_pct = compute_percentage(marks, max_marks)

                    record = StudentScore(
                        board_id=board.board_id,
                        subject=subject,
                        marks=marks,
                        max_marks=max_marks,
                        exam_year=year,
                        year_bucket_id=bucket.bucket_id,
                        percentage_score=actual_pct,
                        timestamp=datetime.now(timezone.utc),
                    )
                    db.add(record)
                    count += 1

        print(f"  ✓ {board_name}: generated scores for {len(SUBJECTS)} subjects × {len(buckets)} buckets")

    db.commit()
    return count


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if data already exists
        existing = db.query(StudentScore).count()
        if existing > 50:
            print(f"Database already has {existing} scores. Clearing old data first...")
            db.query(BoardStatistic).delete()
            db.query(StudentScore).delete()
            db.commit()
            print("  Cleared.")

        print("\n📊 Generating dummy scores...")
        total = generate_scores(db)
        print(f"\n✅ Generated {total} total score records.")

        print("\n📈 Recomputing board statistics...")
        stat_count = recompute_all_statistics(db)
        print(f"✅ Computed {stat_count} statistic group(s).\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()

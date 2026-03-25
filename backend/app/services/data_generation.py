"""Synthetic Data Generator — Creates ~1000 realistic named student records.

Each student gets multiple StudentScore rows (one per subject).
Data is realistic: Gaussian mark distributions, weighted board/class splits,
unique names, and attendance values.

Run: called automatically via main._seed() on first startup.
"""

import random
import math
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import (
    Board, YearBucket, StudentScore, Organization, Course, CourseType, Stream,
    organization_courses,
)
from app.services.feature_engineering import compute_percentage
from app.services.performance_model import classify_student


# ── Indian name pools ───────────────────────────────────────────

FIRST_NAMES_M = [
    "Aarav", "Vivaan", "Aditya", "Sai", "Arjun", "Reyansh", "Ayaan",
    "Krishna", "Ishaan", "Kabir", "Rudra", "Vihaan", "Dhruv", "Arnav",
    "Shaurya", "Lakshya", "Yash", "Rohan", "Karan", "Harsh", "Ankit",
    "Om", "Devansh", "Kunal", "Pranav", "Manish", "Ravi", "Mohit",
    "Aman", "Nikhil", "Abhinav", "Siddharth", "Tanmay", "Varun",
    "Rajat", "Gaurav", "Sahil", "Akash", "Jay", "Dev", "Neil",
    "Parth", "Samarth", "Aryan", "Atharv", "Advait", "Ritik",
    "Mayank", "Himanshu", "Piyush", "Tushar", "Chirag", "Neeraj",
    "Anand", "Vishal", "Rahul", "Amit", "Suraj", "Vikram", "Tarun",
]

FIRST_NAMES_F = [
    "Aanya", "Diya", "Saanvi", "Ananya", "Pari", "Aadhya", "Myra",
    "Kavya", "Isha", "Anika", "Riya", "Sara", "Tanya", "Priya",
    "Neha", "Shruti", "Pooja", "Divya", "Meera", "Sneha", "Nandini",
    "Trisha", "Kritika", "Bhavya", "Jhanvi", "Simran", "Nikita",
    "Aditi", "Kiara", "Zara", "Mahi", "Avni", "Ishita", "Swara",
    "Ridhi", "Lavanya", "Ankita", "Palak", "Mansi", "Tanvi",
    "Srishti", "Aishwarya", "Khushi", "Radhika", "Vaishnavi",
    "Harini", "Deepika", "Sakshi", "Madhavi", "Sonali",
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Gupta", "Singh", "Kumar", "Reddy",
    "Nair", "Joshi", "Mehta", "Agarwal", "Rao", "Iyer", "Menon",
    "Pillai", "Das", "Chatterjee", "Banerjee", "Mukherjee", "Bose",
    "Chauhan", "Rajput", "Yadav", "Tiwari", "Pandey", "Mishra",
    "Dubey", "Srivastava", "Kapoor", "Malhotra", "Chopra", "Bhatia",
    "Sethi", "Khanna", "Saxena", "Kulkarni", "Patil", "Deshpande",
    "Naik", "Hegde", "Kamath", "Shetty", "Bhatt", "Shah", "Gandhi",
    "Thakur", "Chandra", "Venkatesh", "Krishnan", "Subramaniam",
    "Rajan", "Choudhury", "Goswami", "Biswas", "Ghosh", "Roy",
    "Prasad", "Mahajan", "Dhawan", "Khurana",
]

# ── Board weights (weighted distribution) ───────────────────────

BOARD_WEIGHTS = {
    "CBSE": 0.30,
    "ICSE": 0.20,
    "Maharashtra Board": 0.15,
    "Karnataka Board": 0.15,
    "Tamil Nadu Board": 0.10,
    "UP Board": 0.03,
    "Kerala Board": 0.04,
    "AP Board": 0.03,
}

# ── Board-specific mark profiles ────────────────────────────────

BOARD_PROFILES = {
    "CBSE":              (68, 14),
    "ICSE":              (72, 12),
    "Maharashtra Board": (62, 16),
    "Karnataka Board":   (60, 15),
    "Tamil Nadu Board":  (65, 13),
    "UP Board":          (55, 18),
    "Kerala Board":      (70, 11),
    "AP Board":          (61, 15),
}

# ── Subjects by class & stream ──────────────────────────────────

CLASS_10_SUBJECTS = [
    "Mathematics", "Science", "Social Studies", "English", "Hindi",
    "Computer Applications",
]

CLASS_12_STREAMS = {
    "Science (PCM)": ["Mathematics", "Physics", "Chemistry", "English",
                       "Computer Science", "Physical Education"],
    "Science (PCB)": ["Physics", "Chemistry", "Biology", "English",
                       "Physical Education"],
    "Commerce":      ["Accountancy", "Business Studies", "Economics",
                       "English", "Mathematics"],
    "Arts":          ["History", "Political Science", "Geography",
                       "English", "Economics"],
}


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def _generate_unique_names(count: int) -> list[str]:
    """Generate `count` unique full names from the name pools."""
    all_first = FIRST_NAMES_M + FIRST_NAMES_F
    names = set()
    attempts = 0
    while len(names) < count and attempts < count * 5:
        first = random.choice(all_first)
        last = random.choice(LAST_NAMES)
        names.add(f"{first} {last}")
        attempts += 1
    return list(names)[:count]


def generate_synthetic_students(db: Session, target_students: int = 1000) -> int:
    """Generate ~target_students unique named student records.

    Creates multiple StudentScore rows per student (one per subject).
    Returns total number of StudentScore rows created.
    """
    random.seed(2024)  # Reproducible

    # ── Load reference data from DB ──────────────────────────────
    boards = {b.board_name: b for b in db.query(Board).all()}
    buckets = db.query(YearBucket).order_by(YearBucket.start_year).all()
    orgs = db.query(Organization).all()
    courses = db.query(Course).all()
    streams = {s.name: s for s in db.query(Stream).all()}

    if not boards or not buckets:
        return 0

    # Build board list with weights
    available_boards = [(name, w) for name, w in BOARD_WEIGHTS.items() if name in boards]
    if not available_boards:
        available_boards = [(name, 1.0) for name in boards.keys()]
    board_names, board_ws = zip(*available_boards)
    total_w = sum(board_ws)
    board_ws = [w / total_w for w in board_ws]

    # Build org → course mapping
    org_courses = {}
    for org in orgs:
        oc = (
            db.execute(
                organization_courses.select()
                .where(organization_courses.c.organization_id == org.id)
            ).fetchall()
        )
        course_ids = [r.course_id for r in oc]
        org_courses[org.id] = course_ids

    # ── Generate names ───────────────────────────────────────────
    names = _generate_unique_names(target_students)
    exam_years = [2022, 2023, 2024, 2025]
    year_weights = [0.15, 0.25, 0.35, 0.25]

    total_rows = 0

    for student_name in names:
        # Pick class level
        class_level = random.choice(["Class 10", "Class 12"])

        # Pick board
        board_name = random.choices(board_names, weights=board_ws, k=1)[0]
        board = boards[board_name]
        board_mean, board_std = BOARD_PROFILES.get(board_name, (65, 14))

        # Pick exam year
        exam_year = random.choices(exam_years, weights=year_weights, k=1)[0]

        # Find year bucket
        bucket = None
        for b in buckets:
            if b.start_year <= exam_year <= b.end_year:
                bucket = b
                break

        # Pick subjects based on class & stream
        if class_level == "Class 10":
            subjects = CLASS_10_SUBJECTS[:]
            # Randomly drop 0-1 optional subjects
            if random.random() < 0.3 and len(subjects) > 5:
                subjects = random.sample(subjects, 5)
            stream_name = "General"
        else:
            stream_name = random.choice(list(CLASS_12_STREAMS.keys()))
            subjects = CLASS_12_STREAMS[stream_name][:]

        stream_obj = streams.get(stream_name)

        # Pick organization + course
        org = random.choice(orgs) if orgs else None
        course = None
        if org and org.id in org_courses and org_courses[org.id]:
            cid = random.choice(org_courses[org.id])
            course = db.query(Course).filter(Course.id == cid).first()

        # Generate attendance for this student (shared across subjects)
        attendance = _clamp(round(random.gauss(82, 12), 1), 40, 100)

        # Generate marks for each subject
        max_marks = random.choice([100, 100, 100, 80])  # mostly 100

        subject_pcts = []  # track percentages for performance label

        for subject in subjects:
            pct = random.gauss(board_mean, board_std)
            pct = _clamp(pct, 8, 99)
            marks = round(pct / 100 * max_marks, 1)
            marks = _clamp(marks, 0, max_marks)
            actual_pct = compute_percentage(marks, max_marks)

            record = StudentScore(
                student_name=student_name,
                board_id=board.board_id,
                class_level=class_level,
                stream=stream_name,
                stream_id=stream_obj.id if stream_obj else None,
                subject=subject,
                marks=marks,
                max_marks=max_marks,
                exam_year=exam_year,
                year_bucket_id=bucket.bucket_id if bucket else None,
                percentage_score=actual_pct,
                attendance=attendance,
                recent_education=f"{class_level} — {board_name}",
                organization_id=org.id if org else None,
                course_id=course.id if course else None,
                timestamp=datetime.now(timezone.utc),
            )
            db.add(record)
            subject_pcts.append(actual_pct)
            total_rows += 1

        # ── Compute performance label for this student ───────────
        if subject_pcts:
            avg_pct = sum(subject_pcts) / len(subject_pcts)
            if len(subject_pcts) > 1:
                mean_p = avg_pct
                std_dev = (sum((p - mean_p) ** 2 for p in subject_pcts) / len(subject_pcts)) ** 0.5
            else:
                std_dev = 0.0
            result = classify_student(avg_pct, attendance, std_dev)
            perf_label = result["label"]
        else:
            perf_label = None

        # Set performance_label on all rows for this student (in the current flush batch)
        # We query the recently added (unflushed) objects in session
        for obj in db.new:
            if isinstance(obj, StudentScore) and obj.student_name == student_name and obj.performance_label is None:
                obj.performance_label = perf_label

        # Batch commit every 100 students
        if total_rows % 500 == 0:
            db.commit()

    db.commit()
    return total_rows

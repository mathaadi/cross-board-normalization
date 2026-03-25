"""Simple Normalization Module — Min-Max Percentage Scaling.

Formula:
    normalized_score = (marks / max_marks) × 100

Properties:
    • Output range: 0–100
    • Deterministic: same inputs always produce same output
    • Board-agnostic: same logic for all students regardless of board
    • Explainable: simple percentage conversion

This is SEPARATE from the Z-score normalization in normalization_engine.py,
which remains untouched.
"""


def simple_normalize(marks: float, max_marks: float) -> float:
    """Normalize a raw score to a 0–100 scale using min-max percentage scaling.

    Args:
        marks:     Raw marks obtained by the student (>= 0).
        max_marks: Maximum marks possible for the subject (> 0).

    Returns:
        Normalized score in the range [0, 100].

    Raises:
        ValueError: If max_marks <= 0 or marks < 0.
    """
    if max_marks <= 0:
        raise ValueError(f"max_marks must be > 0, got {max_marks}")
    if marks < 0:
        raise ValueError(f"marks must be >= 0, got {marks}")

    normalized = (marks / max_marks) * 100.0
    # Clamp to [0, 100] in case marks > max_marks (data errors)
    return round(max(0.0, min(100.0, normalized)), 2)


def simple_normalize_subjects(subjects: list[dict]) -> list[dict]:
    """Normalize a list of subject score dicts, adding 'normalized_score' key.

    Each dict should have 'marks' and 'max_marks' keys.
    Returns a new list with 'normalized_score' added to each subject.
    """
    result = []
    for subj in subjects:
        entry = dict(subj)
        try:
            entry["normalized_score"] = simple_normalize(
                subj.get("marks", 0),
                subj.get("max_marks", 100),
            )
        except (ValueError, TypeError):
            entry["normalized_score"] = None
        result.append(entry)
    return result

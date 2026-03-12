def compute_percentage(marks: float, max_marks: float) -> float:
    """Compute percentage score from raw marks."""
    if max_marks <= 0:
        raise ValueError("max_marks must be positive")
    return round((marks / max_marks) * 100, 4)

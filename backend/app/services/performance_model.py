"""Performance Model — Rule-based student performance classifier.

Uses a weighted composite score (avg_pct, attendance, consistency)
to classify students into performance tiers.

Why not ML?
    With synthetically generated data, a trained model would just
    re-learn the generation rules — adding no predictive value.
    A transparent rule-based system is equally effective here.
"""


# ── Performance label thresholds ────────────────────────────────

LABELS = {
    "Excellent": {"min": 85, "color": "#10b981"},
    "Good":      {"min": 70, "color": "#06b6d4"},
    "Average":   {"min": 50, "color": "#f59e0b"},
    "Poor":      {"min": 0,  "color": "#f43f5e"},
}

# Weights for composite score
W_PCT  = 0.60   # average percentage
W_ATT  = 0.25   # attendance
W_CON  = 0.15   # consistency (inverse of std dev, scaled)


def classify_student(
    avg_pct: float,
    attendance: float,
    score_std_dev: float,
) -> dict:
    """Classify a student into a performance tier.

    Args:
        avg_pct:      Average percentage across all subjects (0–100).
        attendance:   Attendance percentage (0–100).
        score_std_dev: Std deviation of subject percentages (lower = more consistent).

    Returns:
        dict with keys: label, composite_score, color
    """
    # Normalize consistency: low std dev → high score (0–100 scale)
    # A std dev of 0 = perfect consistency (100), std dev of 30+ = poor (0)
    consistency = max(0.0, min(100.0, 100 - (score_std_dev * 3.33)))

    composite = (
        W_PCT * avg_pct
        + W_ATT * attendance
        + W_CON * consistency
    )
    composite = round(max(0.0, min(100.0, composite)), 1)

    label = "Poor"
    color = LABELS["Poor"]["color"]
    for name, info in LABELS.items():
        if composite >= info["min"]:
            label = name
            color = info["color"]
            break

    return {
        "label": label,
        "composite_score": composite,
        "color": color,
    }

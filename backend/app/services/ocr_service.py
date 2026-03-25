"""OCR Service — Extract academic data from marksheet images.

Uses Tesseract OCR (via pytesseract) to extract text from uploaded
marksheet images (JPG/PNG), then applies regex-based parsing to
extract structured academic data.

Output format:
    {
        "name": "Student Name",
        "class": "10" | "12" | "unknown",
        "confidence": 0.0–1.0,
        "subjects": [
            {"name": "Mathematics", "marks": 95},
            ...
        ],
        "total": <float or None>,
        "percentage": <float or None>,
        "raw_text": "...",  # for debugging
        "errors": []
    }
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Try to import Tesseract ─────────────────────────────────────
try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract or Pillow not installed. OCR features will be unavailable.")


# ── Class-level detection patterns ──────────────────────────────

# Keywords strongly suggesting Class 10
CLASS_10_KEYWORDS = [
    r"\bsecondary\b(?!\s*senior)",
    r"\bclass[\s\-]*(?:10|x|ten)\b",
    r"\bmatriculation\b",
    r"\bssc\b",
    r"\b10th\b",
    r"\bhigh\s*school\s*certificate\b",
]

# Keywords strongly suggesting Class 12
CLASS_12_KEYWORDS = [
    r"\bsenior\s*secondary\b",
    r"\bclass[\s\-]*(?:12|xii|twelve)\b",
    r"\bhigher\s*secondary\b",
    r"\bhsc\b",
    r"\b12th\b",
    r"\binter(?:mediate)?\b",
    r"\bpre[\s\-]*university\b",
    r"\bpuc\b",
]

# Subjects typically only in Class 12
CLASS_12_SUBJECTS = {
    "physics", "chemistry", "biology", "accountancy",
    "business studies", "political science", "computer science",
    "informatics practices", "sociology", "psychology",
    "physical education",
}

# Common subject name patterns for extraction
KNOWN_SUBJECTS = [
    "mathematics", "math", "maths",
    "science", "social studies", "social science",
    "english", "hindi", "sanskrit",
    "computer applications", "computer science",
    "physics", "chemistry", "biology",
    "accountancy", "business studies", "economics",
    "history", "political science", "geography",
    "sociology", "psychology", "physical education",
    "informatics practices",
]

# Normalized subject names
SUBJECT_NORMALIZE = {
    "math": "Mathematics",
    "maths": "Mathematics",
    "mathematics": "Mathematics",
    "science": "Science",
    "social studies": "Social Studies",
    "social science": "Social Studies",
    "english": "English",
    "hindi": "Hindi",
    "sanskrit": "Sanskrit",
    "computer applications": "Computer Applications",
    "computer science": "Computer Science",
    "physics": "Physics",
    "chemistry": "Chemistry",
    "biology": "Biology",
    "accountancy": "Accountancy",
    "business studies": "Business Studies",
    "economics": "Economics",
    "history": "History",
    "political science": "Political Science",
    "geography": "Geography",
    "sociology": "Sociology",
    "psychology": "Psychology",
    "physical education": "Physical Education",
    "informatics practices": "Informatics Practices",
}


def extract_text_from_image(image_bytes: bytes) -> str:
    """Extract text from image bytes using Tesseract OCR.

    Args:
        image_bytes: Raw bytes of the image (JPG/PNG).

    Returns:
        Extracted text string.

    Raises:
        RuntimeError: If Tesseract is not available.
    """
    if not TESSERACT_AVAILABLE:
        raise RuntimeError(
            "Tesseract OCR is not available. "
            "Install pytesseract and Pillow: pip install pytesseract Pillow. "
            "Also install tesseract-ocr system package."
        )

    import io
    img = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if necessary (handles RGBA, grayscale etc.)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    text = pytesseract.image_to_string(img, lang="eng")
    return text


def _detect_class(text: str, subjects: list[dict]) -> tuple[str, float]:
    """Detect whether the marksheet is Class 10 or Class 12.

    Uses: keyword matching, subject pattern analysis, board-specific clues.

    Returns:
        (class_label, confidence) where class_label is "10", "12", or "unknown"
        and confidence is 0.0–1.0.
    """
    text_lower = text.lower()
    score_10 = 0.0
    score_12 = 0.0

    # Keyword matching
    for pattern in CLASS_10_KEYWORDS:
        if re.search(pattern, text_lower):
            score_10 += 2.0

    for pattern in CLASS_12_KEYWORDS:
        if re.search(pattern, text_lower):
            score_12 += 2.0

    # Subject-based detection
    subject_names = {s["name"].lower() for s in subjects}
    class_12_matches = subject_names & CLASS_12_SUBJECTS
    if len(class_12_matches) >= 2:
        score_12 += 3.0
    elif len(class_12_matches) == 1:
        score_12 += 1.5

    # Class 10 indicator: typical Class 10 subjects without Class 12 subjects
    class_10_only = {"social studies", "social science", "computer applications"}
    if subject_names & class_10_only and not class_12_matches:
        score_10 += 2.0

    # Determine result
    total = score_10 + score_12
    if total == 0:
        return "unknown", 0.0

    if score_12 > score_10:
        confidence = min(1.0, score_12 / max(total, 1))
        return "12", round(confidence, 2)
    elif score_10 > score_12:
        confidence = min(1.0, score_10 / max(total, 1))
        return "10", round(confidence, 2)
    else:
        return "unknown", 0.3


def _extract_name(text: str) -> Optional[str]:
    """Try to extract student name from OCR text."""
    patterns = [
        r"(?:name\s*(?:of\s*(?:the\s*)?)?(?:student|candidate)\s*[:;]\s*)([A-Za-z\s\.]+)",
        r"(?:student\s*name\s*[:;]\s*)([A-Za-z\s\.]+)",
        r"(?:candidate\s*name\s*[:;]\s*)([A-Za-z\s\.]+)",
        r"(?:name\s*[:;]\s*)([A-Za-z\s\.]{3,40})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            # Filter out common false positives
            if len(name) >= 3 and not any(kw in name.lower() for kw in ["board", "certificate", "class", "exam"]):
                return name
    return None


def _extract_subjects(text: str) -> list[dict]:
    """Extract subject names and marks from OCR text."""
    subjects = []
    seen_subjects = set()

    # Build regex pattern for known subjects
    for subj_name in KNOWN_SUBJECTS:
        # Match subject name followed by marks (number)
        # Pattern: "Subject Name ... 85" or "Subject Name: 85" or "Subject Name   85/100"
        escaped = re.escape(subj_name)
        patterns = [
            rf"({escaped})\s*[:\-]?\s*(\d{{1,3}})(?:\s*/\s*\d{{1,3}})?",
            rf"({escaped})\s+(\d{{1,3}})\b",
        ]
        for pat in patterns:
            for match in re.finditer(pat, text, re.IGNORECASE):
                raw_name = match.group(1).strip().lower()
                marks = int(match.group(2))

                # Validate marks (reasonable range)
                if marks > 200:
                    continue

                normalized_name = SUBJECT_NORMALIZE.get(raw_name, raw_name.title())
                if normalized_name.lower() not in seen_subjects:
                    seen_subjects.add(normalized_name.lower())
                    subjects.append({
                        "name": normalized_name,
                        "marks": marks,
                    })
                break  # Use first match for each subject

    return subjects


def _extract_total_percentage(text: str) -> tuple[Optional[float], Optional[float]]:
    """Try to extract total marks and percentage from OCR text."""
    total = None
    percentage = None

    # Total pattern
    total_match = re.search(
        r"(?:total|grand\s*total|aggregate)\s*[:\-]?\s*(\d{2,4})",
        text, re.IGNORECASE
    )
    if total_match:
        total = float(total_match.group(1))

    # Percentage pattern
    pct_match = re.search(
        r"(?:percentage|percent|%)\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?)",
        text, re.IGNORECASE
    )
    if not pct_match:
        pct_match = re.search(
            r"(\d{1,3}(?:\.\d{1,2})?)\s*%",
            text, re.IGNORECASE
        )
    if pct_match:
        percentage = float(pct_match.group(1))

    return total, percentage


def process_marksheet(image_bytes: bytes) -> dict:
    """Full OCR pipeline: extract text → parse → return structured data.

    Args:
        image_bytes: Raw bytes of the marksheet image.

    Returns:
        Structured dict with name, class, confidence, subjects, etc.
    """
    errors = []

    # Step 1: OCR
    try:
        raw_text = extract_text_from_image(image_bytes)
    except RuntimeError as e:
        return {
            "name": None,
            "class": "unknown",
            "confidence": 0.0,
            "subjects": [],
            "total": None,
            "percentage": None,
            "raw_text": "",
            "errors": [str(e)],
        }
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return {
            "name": None,
            "class": "unknown",
            "confidence": 0.0,
            "subjects": [],
            "total": None,
            "percentage": None,
            "raw_text": "",
            "errors": [f"OCR extraction failed: {str(e)}"],
        }

    if not raw_text or len(raw_text.strip()) < 10:
        errors.append("OCR returned very little text. Image may be unclear or not a marksheet.")

    # Step 2: Extract name
    name = _extract_name(raw_text)
    if not name:
        errors.append("Could not extract student name from the marksheet.")

    # Step 3: Extract subjects
    subjects = _extract_subjects(raw_text)
    if not subjects:
        errors.append("Could not extract any subject marks. Text may be unclear.")

    # Step 4: Detect class
    class_level, confidence = _detect_class(raw_text, subjects)

    # Step 5: Extract total/percentage
    total, percentage = _extract_total_percentage(raw_text)

    return {
        "name": name,
        "class": class_level,
        "confidence": confidence,
        "subjects": subjects,
        "total": total,
        "percentage": percentage,
        "raw_text": raw_text,
        "errors": errors,
    }

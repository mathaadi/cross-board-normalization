"""CSV Export Utility — generates CSV from student query results.

Produces a streaming CSV response for download with the columns:
    student_id, name, class, board, stream, program, organisation,
    avg_percentage, normalized_score, performance_label, exam_year
"""

import csv
import io
from fastapi.responses import StreamingResponse


def generate_students_csv(rows: list[dict], filename: str = "students_export.csv") -> StreamingResponse:
    """Convert a list of student dicts into a downloadable CSV StreamingResponse.

    Args:
        rows:     List of student dicts (each dict = one student row).
        filename: Name for the Content-Disposition header.

    Returns:
        FastAPI StreamingResponse with text/csv content type.
    """
    columns = [
        "student_id",
        "name",
        "class",
        "board",
        "stream",
        "program",
        "organisation",
        "avg_percentage",
        "normalized_score",
        "performance_label",
        "exam_year",
    ]

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()

    for row in rows:
        # Map internal keys to CSV column names
        writer.writerow({
            "student_id": row.get("student_id", ""),
            "name": row.get("student_name", ""),
            "class": row.get("class_level", ""),
            "board": row.get("board_name", ""),
            "stream": row.get("stream", ""),
            "program": row.get("program_name", ""),
            "organisation": row.get("organization_name", ""),
            "avg_percentage": row.get("avg_percentage", ""),
            "normalized_score": row.get("normalized_score", ""),
            "performance_label": row.get("performance_label", ""),
            "exam_year": row.get("exam_year", ""),
        })

    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

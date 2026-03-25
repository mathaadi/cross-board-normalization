"""Advanced Normalization API Router (V2).

This router exposes the endpoints for the new strictly additive incremental
normalization pipeline.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.advanced_normalization_service import compute_advanced_normalization

router = APIRouter(prefix="/api/normalization/v2", tags=["normalization v2"])

@router.get("/")
def get_advanced_normalization(
    board: str = Query(..., description="Filter by board name"),
    subject: str = Query(..., description="Filter by subject"),
    year: int = Query(..., description="Filter by exam year"),
    marks: Optional[float] = Query(None, description="Optional: specific marks to normalize"),
    max_marks: Optional[float] = Query(None, description="Optional: max marks parameter"),
    db: Session = Depends(get_db),
):
    """
    Computes and returns the new normalization pipeline using incremental
    mean & variance algorithms over the specified cohort (Board, Subject, Year).
    """
    try:
        results = compute_advanced_normalization(
            db, board_name=board, subject=subject, exam_year=year,
            target_marks=marks, target_max_marks=max_marks
        )
        if not results:
            return {"data": [], "message": "No data found for the selected cohort."}
        if isinstance(results, dict):
            return {"data": results} # Singular mode
        return {"data": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Advanced Normalization computation failed: {str(e)}")

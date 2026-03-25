"""Analytics API Router — NEW endpoints for board stats, distribution, and normalization metrics.

This router is ADDITIVE — it does not modify any existing API routes.
All endpoints are prefixed with /api/analytics.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.board_stats_service import get_board_level_stats
from app.services.normalization_v2 import compute_normalization_metrics
from app.services.dashboard_analytics import get_dashboard_distribution
from app.services.statistics_graph_service import get_dynamic_board_stats

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/board-stats")
def analytics_board_stats(db: Session = Depends(get_db)):
    """Board-level insights: student count, subject count, avg percentage per board."""
    return get_board_level_stats(db)


@router.get("/dashboard-distribution")
def analytics_dashboard_distribution(db: Session = Depends(get_db)):
    """Board + stream distribution data for dashboard charts."""
    return get_dashboard_distribution(db)


@router.get("/normalization-metrics")
def analytics_normalization_metrics(
    board: Optional[str] = Query(None, description="Filter by board name"),
    subject: Optional[str] = Query(None, description="Filter by subject"),
    db: Session = Depends(get_db),
):
    """Batch Z-score + percentile normalization metrics grouped by (board, subject)."""
    return compute_normalization_metrics(db, board_name=board, subject=subject)

@router.get("/dynamic-stats")
def analytics_dynamic_stats(
    board: str = Query(..., description="Board name for dynamic stats"),
    subject: str = Query(..., description="Subject name for dynamic stats"),
    db: Session = Depends(get_db),
):
    """Dynamic graphs data (distribution and trends) for a specific board and subject."""
    return get_dynamic_board_stats(db, board_name=board, subject=subject)

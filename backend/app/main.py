"""Cross-Board Normalization System — FastAPI Entry Point."""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import engine, SessionLocal, Base
from app.models.models import Board, YearBucket
from app.api import normalization, boards, students


# ── Seed data ────────────────────────────────────────────────────

SEED_BOARDS = [
    {"board_name": "CBSE", "board_category": "National", "country": "India"},
    {"board_name": "ICSE", "board_category": "National", "country": "India"},
    {"board_name": "Maharashtra Board", "board_category": "State", "country": "India"},
    {"board_name": "Karnataka Board", "board_category": "State", "country": "India"},
    {"board_name": "Tamil Nadu Board", "board_category": "State", "country": "India"},
    {"board_name": "UP Board", "board_category": "State", "country": "India"},
    {"board_name": "West Bengal Board", "board_category": "State", "country": "India"},
    {"board_name": "Kerala Board", "board_category": "State", "country": "India"},
    {"board_name": "AP Board", "board_category": "State", "country": "India"},
    {"board_name": "Rajasthan Board", "board_category": "State", "country": "India"},
]

SEED_BUCKETS = [
    {"start_year": 2000, "end_year": 2003, "bucket_label": "2000–2003"},
    {"start_year": 2004, "end_year": 2007, "bucket_label": "2004–2007"},
    {"start_year": 2008, "end_year": 2011, "bucket_label": "2008–2011"},
    {"start_year": 2012, "end_year": 2015, "bucket_label": "2012–2015"},
    {"start_year": 2016, "end_year": 2019, "bucket_label": "2016–2019"},
    {"start_year": 2020, "end_year": 2023, "bucket_label": "2020–2023"},
    {"start_year": 2024, "end_year": 2027, "bucket_label": "2024–2027"},
]


def _seed(db):
    """Populate boards and year buckets if empty."""
    if db.query(Board).count() == 0:
        for b in SEED_BOARDS:
            db.add(Board(**b))
        db.commit()

    if db.query(YearBucket).count() == 0:
        for yb in SEED_BUCKETS:
            db.add(YearBucket(**yb))
        db.commit()


# ── Lifespan ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables & seed
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed(db)
    finally:
        db.close()
    yield
    # Shutdown (nothing to clean up for SQLite)


# ── App ──────────────────────────────────────────────────────────

app = FastAPI(
    title="Cross-Board Normalization System",
    description="Normalize student exam scores across different education boards using Z-score standardization.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(normalization.router)
app.include_router(boards.router)
app.include_router(students.router)

# ── Serve Frontend Static Build ──────────────────────────────────
# In production, the React build is served from ../frontend/dist
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA — all non-API routes get index.html."""
        # Try to serve the file directly first
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html for SPA routing
        return FileResponse(str(FRONTEND_DIR / "index.html"))
else:
    @app.get("/")
    def root():
        return {"message": "Cross-Board Normalization API", "docs": "/docs"}

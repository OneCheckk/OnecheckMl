import os
import re
import uuid
from contextlib import contextmanager
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body

from engines.faculty_matcher import FacultyMatcher
from engines.validity_engine import ValidityEngine
from engines.blueprint_engine import BlueprintEngine

app = FastAPI(
    title="OneCheck — AICTE Scrutiny Microservice (Engines 6, 7 & 8)",
    description=(
        "Core Intelligence Forensics Suite for AICTE Extension of Approval (EoA) Scrutiny.\n\n"
        "Active Engines:\n"
        "- **Engine 6**: Ghost Faculty Radar (Keyed HMAC-SHA256 & Initial-Aware RapidFuzz/Difflib)\n"
        "- **Engine 7**: Scrutiny Calendar (Dynamic Validity-at-Decision-Date Engine)\n"
        "- **Engine 8**: The Blueprint Architect (Multimodal CAD/Floor-Plan Area Reconciliation)"
    ),
    version="3.0.0",
)

faculty_matcher = FacultyMatcher()
validity_engine = ValidityEngine()
blueprint_engine = BlueprintEngine()

TEMP_DIR = "./temp_uploads"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".pdf", ".bmp", ".tif", ".tiff", ".webp"}
MOCK_MODE = os.getenv("ONECHECK_MOCK") == "1"

os.makedirs(TEMP_DIR, exist_ok=True)

POSSIBLE_UPLOAD_DIRS = [
    "./private_uploads", "../OneCheckBackend/private_uploads",
    "../OneCheckBackend-main/private_uploads", "./demo_assets", TEMP_DIR,
]


# ───────────────────────── helpers ─────────────────────────
@contextmanager
def saved_upload(file: UploadFile):
    """Save an upload under a random server-side name (no path traversal), then delete it."""
    ext = os.path.splitext(os.path.basename(file.filename or ""))[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXT)}")
    path = os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}{ext}")
    try:
        size = 0
        with open(path, "wb") as buf:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "File too large (max 20 MB).")
                buf.write(chunk)
        yield path
    finally:
        if os.path.exists(path):
            os.remove(path)


def resolve_storage_file(storage_key: str) -> Optional[str]:
    if not storage_key:
        return None
    if os.path.exists(storage_key):
        return storage_key
    clean = os.path.basename(storage_key)
    for d in POSSIBLE_UPLOAD_DIRS:
        cand = os.path.join(d, clean)
        if os.path.exists(cand):
            return cand
    return None


def require_file(payload: Dict[str, Any]) -> Optional[str]:
    """Returns a real path, or None in explicit mock mode. Otherwise a proper 404."""
    key = payload.get("storageKey")
    if not key:
        raise HTTPException(422, "storageKey is required.")
    path = resolve_storage_file(key)
    if path is None and not MOCK_MODE:
        raise HTTPException(404, f"File for storageKey '{key}' not found.")
    return path


def run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Could not process input: {type(e).__name__}: {e}")


# ───────────────────────── health ─────────────────────────
@app.get("/health")
def health_check():
    import shutil as sh
    return {
        "status": "ONLINE",
        "service": "OneCheck AICTE Scrutiny Microservice (Engines 6, 7 & 8)",
        "mock_mode": MOCK_MODE,
        "dependencies": {
            "tesseract": (
                bool(sh.which("tesseract"))
                or os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
                or os.path.exists(os.getenv("TESSERACT_PATH", ""))
            ),
            "gemini_vision_enabled": blueprint_engine.client is not None,
        },
        "engines": {
            "Engine 6": "Ghost Faculty (HMAC + Initial-aware Fuzzy) -> POST /api/ml/fuzzy-match-faculty",
            "Engine 7": "Validity at Decision Date -> POST /api/ml/validity-check",
            "Engine 8": "Blueprint Area Check -> POST /api/ml/blueprint-extract",
        },
    }


# ───────────────── Engine 6: Ghost Faculty Matcher ─────────────────
@app.post("/api/ml/fuzzy-match-faculty", tags=["Engine 6: Ghost Faculty"])
async def match_faculty_direct(payload: Dict[str, Any] = Body(...)):
    """
    Scans a candidate faculty member against active faculty rosters of other institutions.
    Uses Keyed HMAC-SHA256 for DPDP Act privacy compliance and initial-aware name matching.
    """
    candidate = payload.get("candidate", {})
    roster = payload.get("stored_roster", [])
    return faculty_matcher.scan_cross_institution_duplicates(candidate, roster)


@app.post("/api/faculty-match", tags=["Engine 6: Ghost Faculty (Backend Compatibility)"])
async def backend_faculty_match_endpoint(payload: Dict[str, Any] = Body(...)):
    """Contract: { normalizedNames: [...] }"""
    names = payload.get("normalizedNames", [])
    matches = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            sim = faculty_matcher.compare_names(names[i], names[j])
            if sim >= faculty_matcher.fuzzy_threshold:
                matches.append({"source": names[i], "target": names[j], "similarity": round(sim / 100.0, 2)})
    return {"matches": matches}


# ───────────────── Engine 7: Scrutiny Calendar & Validity ─────────────────
@app.post("/api/ml/validity-check", tags=["Engine 7: Scrutiny Calendar"])
async def evaluate_validity_direct(
    expiry_date: str = Body(..., embed=True),
    scrutiny_anchor_date: Optional[str] = Body(None, embed=True),
    session_start_date: Optional[str] = Body(None, embed=True),
):
    """
    Evaluates whether a certificate remains valid on Scrutiny Day and Academic Session Start Day.
    Decouples submission date from decision date.
    """
    return validity_engine.evaluate_validity(expiry_date, scrutiny_anchor_date, session_start_date)


# ───────────────── Engine 8: The Blueprint Architect ─────────────────
@app.post("/api/ml/blueprint-extract", tags=["Engine 8: Blueprint Architect"])
async def extract_blueprint_direct(
    file: UploadFile = File(...),
    claimed_lab_sqm: float = Form(640.0)
):
    """
    Upload a floor-plan blueprint (PNG/JPG/PDF).
    Extracts instructional rooms and reconciles carpet area against claimed lab area.
    """
    with saved_upload(file) as p:
        return run(blueprint_engine.analyze_blueprint, p, claimed_lab_sqm)


@app.post("/api/blueprint", tags=["Engine 8: Blueprint Architect (Backend Compatibility)"])
async def backend_blueprint_endpoint(payload: Dict[str, Any] = Body(...)):
    """Contract: { storageKey, claimedArea }"""
    path = require_file(payload)
    claimed_area = float(payload.get("claimedArea", 640.0))
    if path is None:
        return {"status": "MOCK", "extractedArea": claimed_area, "verdict": "VERIFIED"}
    return run(blueprint_engine.analyze_blueprint, path, claimed_area)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

"""
OneCheck ML Service — FastAPI Application Entry Point
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Runtime:    Python 3.10+  |  FastAPI  |  Uvicorn
Port:       8000
RAM budget: < 350 MB (CPU-only, no GPU)

To start the service:
    cd ml-service
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Swagger UI available at:
    http://localhost:8000/docs
"""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from models.schemas import HealthResponse

# Prevent pytesseract from eagerly loading heavy pandas library into memory (<350MB budget)
sys.modules.setdefault("pandas", None)

from routers.forensics_router import router as forensics_router
from routers.imagehash_router import router as imagehash_router
from routers.geofence_router import router as geofence_router
from routers.ocr_router import router as ocr_router
from routers.faculty_router import router as faculty_router
from routers.validity_router import router as validity_router
from routers.blueprint_router import router as blueprint_router
from routers.v1_bridge_router import router as v1_bridge_router

# ── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("onecheck.ml")


# ── Lifespan (startup / shutdown events) ─────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("OneCheck ML Service starting up...")
    logger.info(
        "Active engines: Engine 1 (PDF Forensics), Engine 2 (ELA Heatmap), "
        "Engine 3 (Perceptual Hash), Engine 4 (500m Geo-Fence EXIF), "
        "Engine 5 (Tesseract OCR & Regex), Engine 6 (Ghost Faculty Radar), "
        "Engine 7 (Scrutiny Calendar), Engine 8 (Blueprint Vision Architect)"
    )
    yield
    logger.info("OneCheck ML Service shutting down.")


# ── Application factory ───────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "High-throughput, CPU-optimized document forensics pipeline "
        "for AICTE Extension of Approval (EoA) scrutiny. "
        "Serves as the Python ML microservice consumed by the Node.js backend."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS Middleware ───────────────────────────────────────────────────────

origins = (
    [o.strip() for o in settings.CORS_ORIGINS.split(",")]
    if settings.CORS_ORIGINS != "*"
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ─────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Service"],
    summary="Health check — returns service status",
)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="UP",
        service="OneCheck-ML-Engine",
        runtime="Python 3.10+ CPU",
        active_engines=8,  # PDF + ELA + pHash + Geo-Fence + OCR + Faculty + Validity + Blueprint
        version="1.0.0",
        tesseract=["eng", "hin"],
        classifier="keywords",
    )


@app.get("/", include_in_schema=False)
def root_redirect():
    return JSONResponse(
        {"message": "OneCheck ML Service is running. Visit /docs for Swagger UI."}
    )


# ── Router Registration ───────────────────────────────────────────────────
#
#  Dual-prefix strategy:
#    /forensics/...       → clean internal & Swagger paths
#    /api/...             → Node.js backend contract paths
#
#  The same router is mounted under both prefixes so that
#  verificationClient.service.js (which calls /api/pdf-forensics)
#  and the Swagger UI (which shows /forensics/pdf) both work.

app.include_router(
    forensics_router,
    prefix="/forensics",
    tags=["PDF & ELA Forensics"],
)

# Backend-contract alias — the /pdf-forensics and /ela routes inside the router
# will be accessible at /api/pdf-forensics and /api/ela
app.include_router(
    forensics_router,
    prefix="/api",
    tags=["Backend Contract (Node.js compat.)"],
    include_in_schema=True,
)

# ── Engine 3: Perceptual Image Hashing ───────────────────────────────────
app.include_router(
    imagehash_router,
    prefix="/imagehash",
    tags=["Perceptual Image Hashing"],
)

# Backend-contract alias — /api/phash maps to imagehash_router's /phash route
app.include_router(
    imagehash_router,
    prefix="/api",
    tags=["Backend Contract (Node.js compat.)"],
    include_in_schema=False,  # Avoid Swagger duplication
)

# ── Engine 4: 500m Geo-Fence & EXIF Spatial Engine ───────────────────────
app.include_router(
    geofence_router,
    prefix="/geofence",
    tags=["500m Geo-Fence EXIF Spatial Engine"],
)

# Backend-contract alias — /api/exif and /api/geofence map to geofence_router
app.include_router(
    geofence_router,
    prefix="/api",
    tags=["Backend Contract (Node.js compat.)"],
    include_in_schema=False,
)

# ── Engine 5: Tesseract OCR & Regulatory Regex Parser ────────────────────
app.include_router(
    ocr_router,
    prefix="/ocr",
    tags=["Tesseract OCR & Regulatory Regex Parser"],
)

# Backend-contract alias — /api/ocr maps to ocr_router's /ocr route
app.include_router(
    ocr_router,
    prefix="/api",
    tags=["Backend Contract (Node.js compat.)"],
    include_in_schema=False,
)

# ── Engine 6: Ghost Faculty Radar & Identity Matcher ─────────────────────
app.include_router(
    faculty_router,
    prefix="/faculty",
    tags=["Engine 6: Ghost Faculty Radar"],
)

# Backend-contract alias — /api/faculty-match and /api/fuzzy-match-faculty
app.include_router(
    faculty_router,
    prefix="/api",
    tags=["Backend Contract (Node.js compat.)"],
    include_in_schema=False,
)

# ── Engine 7: Scrutiny Calendar & Dynamic Validity ───────────────────────
app.include_router(
    validity_router,
    prefix="/validity",
    tags=["Engine 7: Scrutiny Calendar"],
)

# Backend-contract alias — /api/validity-check
app.include_router(
    validity_router,
    prefix="/api",
    tags=["Backend Contract (Node.js compat.)"],
    include_in_schema=False,
)

# ── Engine 8: Blueprint Vision Architect ─────────────────────────────────
app.include_router(
    blueprint_router,
    prefix="/blueprint",
    tags=["Engine 8: Blueprint Vision Architect"],
)

# Backend-contract alias — /api/blueprint and /api/blueprint-extract
app.include_router(
    blueprint_router,
    prefix="/api",
    tags=["Backend Contract (Node.js compat.)"],
    include_in_schema=False,
)

# ── v1 Frozen Contract Bridge for Node.js Backend ────────────────────────
app.include_router(
    v1_bridge_router,
    prefix="/v1",
    tags=["v1 Backend Frozen Contract Bridge"],
)

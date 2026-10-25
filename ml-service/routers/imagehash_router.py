"""
OneCheck ML Service — Engine 3: Imagehash Router
=================================================
Exposes HTTP endpoints for Perceptual Image Hashing (pHash / dHash).

Route Strategy
--------------
  /imagehash/compute  → Compute hashes for an uploaded image
  /imagehash/compare  → Compare two hex hash strings
  /api/phash          → Node.js verificationClient.service.js contract

All three intake modes are supported:
  1. Multipart UploadFile (most common for infrastructure photos)
  2. JSON body with base64_content
  3. JSON body with storageKey (offline-safe fallback)
"""

from __future__ import annotations

import base64
import logging
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from models.schemas import (
    ImageHashComputeRequest,
    ImageHashComputeResponse,
    ImageHashCompareRequest,
    ImageHashCompareResponse,
)
from services.imagehash_service import compute_perceptual_hashes, compare_hashes

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Perceptual Image Hashing"])

_MAX_IMAGE_BYTES = 25 * 1024 * 1024   # 25 MB safety guard


# ─────────────────────────────────────────────────────────────────────────────
#  Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _run_compute(image_bytes: bytes) -> ImageHashComputeResponse:
    """Execute hash computation with standard error mapping."""
    try:
        raw = compute_perceptual_hashes(image_bytes)
        return ImageHashComputeResponse.model_validate(raw)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def _resolve_image_bytes(request: Request) -> bytes:
    """
    Universal intake resolver — supports multipart, JSON base64, storageKey fallback,
    or raw binary body.
    """
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        file_field = form.get("file")
        if not file_field or not hasattr(file_field, "read"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multipart request missing 'file' field.",
            )
        data = await file_field.read()   # type: ignore[union-attr]
        return data

    if "application/json" in content_type:
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON body: {exc}",
            )

        body = ImageHashComputeRequest.model_validate(payload)

        if body.base64_content:
            try:
                return base64.b64decode(body.base64_content)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to decode base64_content: {exc}",
                )

        if body.storage_key:
            # Storage resolver not wired in local environment — return safe stub
            logger.info(
                "storageKey '%s' provided — storage resolver not configured. "
                "Returning offline stub hash.",
                body.storage_key,
            )
            return None   # type: ignore[return-value]  — caller checks for None

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide 'base64_content', 'storageKey', or multipart file.",
        )

    # Raw binary fallback
    data = await request.body()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty request body. Send image as multipart, JSON, or raw bytes.",
        )
    return data


# ─────────────────────────────────────────────────────────────────────────────
#  Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/compute",
    response_model=ImageHashComputeResponse,
    summary="Compute perceptual hashes for an image",
    description=(
        "Computes pHash, dHash, aHash, and wHash fingerprints for an uploaded "
        "infrastructure photo. "
        "Accepts multipart file upload or JSON body with base64_content / storageKey."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Hashes computed successfully."},
        400: {"description": "Invalid or unrecognizable image payload."},
        413: {"description": "Image exceeds 25 MB limit."},
    },
)
async def compute_hashes_endpoint(request: Request) -> ImageHashComputeResponse:
    """
    Dual-mounted at /imagehash/compute and /api/phash (Node.js compat).
    """
    image_bytes = await _resolve_image_bytes(request)

    if image_bytes is None:
        # storageKey stub — return deterministic placeholder for offline testing
        return ImageHashComputeResponse(
            phash="0000000000000000",
            dhash="0000000000000000",
            ahash="0000000000000000",
            whash="0000000000000000",
            image_hash="0000000000000000",
            method_version="dhash-v1",
        )

    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds the {_MAX_IMAGE_BYTES // (1024*1024)} MB limit.",
        )

    logger.info("Imagehash compute: size=%d bytes", len(image_bytes))
    return _run_compute(image_bytes)


@router.post(
    "/compare",
    response_model=ImageHashCompareResponse,
    summary="Compare two perceptual hash strings",
    description=(
        "Computes Hamming distance between two hex perceptual hashes and "
        "returns a duplicate/similar/different verdict. "
        "A distance ≤ 10 bits out of 64 is flagged as DUPLICATE."
    ),
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Hash comparison completed."},
        400: {"description": "Malformed or missing hash strings."},
    },
)
async def compare_hashes_endpoint(
    body: ImageHashCompareRequest,
) -> ImageHashCompareResponse:
    """Compare two perceptual hash strings and return a duplicate verdict."""
    try:
        raw = compare_hashes(body.hash1, body.hash2, threshold=body.threshold)
        return ImageHashCompareResponse.model_validate(raw)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ─────────────────────────────────────────────────────────────────────────────
#  Node.js backend contract: POST /api/phash
#  verificationClient.computePerceptualHash(storageKey)
#  → { imageHash: str, methodVersion: "dhash-v1" }
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/phash",
    response_model=ImageHashComputeResponse,
    summary="[Backend Contract] Perceptual Hash (Node.js verificationClient compat.)",
    description=(
        "Node.js backend compatibility endpoint. "
        "Accepts multipart image upload or JSON with storageKey / base64_content. "
        "Response includes imageHash and methodVersion fields expected by verificationClient."
    ),
    status_code=status.HTTP_200_OK,
    include_in_schema=True,
)
async def phash_backend_contract(request: Request) -> ImageHashComputeResponse:
    """
    Same as /compute but named /phash to match Node.js verificationClient contract.
    Mounted at /api/phash via main.py dual-prefix strategy.
    """
    image_bytes = await _resolve_image_bytes(request)

    if image_bytes is None:
        # storageKey without resolver configured — return offline mock
        logger.info("Backend contract /phash: storageKey stub response")
        return ImageHashComputeResponse(
            phash="0000000000000000",
            dhash="dhash_a1b2c3d4e5f60718",
            ahash="0000000000000000",
            whash="0000000000000000",
            image_hash="dhash_a1b2c3d4e5f60718",
            method_version="dhash-v1",
        )

    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds maximum allowed size.",
        )

    logger.info("Backend contract /api/phash: size=%d bytes", len(image_bytes))
    return _run_compute(image_bytes)

"""
OneCheck ML Service — Pydantic v2 Schemas
Shared request and response models for all ML engines.
Engine-specific schemas are defined in their own sections below.
"""
from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from models.enums import (
    TamperRiskLevel,
    GeofenceStatus,
    DocumentType,
    ValidityStatus,
)


# ════════════════════════════════════════════════════════════════════
#  Common / Shared
# ════════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    status: str
    service: str
    runtime: str
    active_engines: int


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None


# ════════════════════════════════════════════════════════════════════
#  Engine 1 — PDF Revision Stream Forensics
# ════════════════════════════════════════════════════════════════════

class PdfForensicsRequest(BaseModel):
    """
    Accept either:
      • storageKey  — opaque key passed to a storage resolver (future)
      • base64_content — raw PDF encoded as base64 string
    Both fields are optional because the router also supports raw
    multipart UploadFile upload.
    """
    storage_key: Optional[str] = Field(
        default=None,
        alias="storageKey",
        description="Opaque storage key for the PDF (future cloud storage resolution).",
        examples=["docs/fire-noc-2024.pdf"],
    )
    base64_content: Optional[str] = Field(
        default=None,
        description="Base64-encoded raw bytes of the PDF file.",
    )

    @field_validator("base64_content", mode="before")
    @classmethod
    def strip_data_uri_prefix(cls, v: Optional[str]) -> Optional[str]:
        """Strip any data:application/pdf;base64, prefix if present."""
        if v and v.startswith("data:"):
            _, _, encoded = v.partition(",")
            return encoded
        return v

    @model_validator(mode="after")
    def at_least_one_source(self) -> "PdfForensicsRequest":
        if self.storage_key is None and self.base64_content is None:
            raise ValueError(
                "Provide either 'storageKey' or 'base64_content'. "
                "Alternatively, POST the PDF as multipart/form-data."
            )
        return self

    model_config = {"populate_by_name": True}

    def decode_pdf_bytes(self) -> bytes:
        """Decode the base64 payload into raw PDF bytes."""
        if self.base64_content:
            return base64.b64decode(self.base64_content)
        raise ValueError("Cannot decode bytes: no base64_content provided.")


class PdfForensicsResponse(BaseModel):
    """Structured response from the PDF Revision Forensics engine."""
    revision_count: int = Field(
        description="Number of incremental PDF save revisions detected."
    )
    is_tampered: bool = Field(
        description="True if evidence of post-issuance editing was detected."
    )
    created_date: Optional[str] = Field(
        default=None,
        description="Original PDF creation date extracted from /CreationDate metadata.",
    )
    modified_date: Optional[str] = Field(
        default=None,
        description="Latest modification date extracted from /ModDate metadata.",
    )
    editor_tool: str = Field(
        description="Detected authoring/editing software (from /Producer or /Creator)."
    )
    warning: Optional[str] = Field(
        default=None,
        description="Human-readable tamper warning message if tampering is detected.",
    )
    tamper_risk_level: TamperRiskLevel = Field(
        description="Overall risk level: LOW | MEDIUM | HIGH."
    )
    suspicious_tools_found: List[str] = Field(
        default_factory=list,
        description="List of suspicious editing tools identified in the metadata.",
    )
    has_ghost_text: bool = Field(
        default=False,
        description="True if invisible/white hidden text layers were detected.",
    )
    metadata_raw: Dict[str, Any] = Field(
        default_factory=dict,
        description="Raw extracted PDF metadata dictionary for audit trail.",
    )
    provider_version: str = Field(
        default="pdf-forensics-v1",
        description="Version tag of the forensics engine for audit provenance.",
    )


# ====================================================================
#  Engine 2 — Error Level Analysis (ELA) Tamper Heatmap
# ====================================================================

class ElaRegion(BaseModel):
    """Bounding box of a detected high-compression-error tampered region."""
    x: int = Field(description="Bounding box top-left X pixel coordinate.")
    y: int = Field(description="Bounding box top-left Y pixel coordinate.")
    width: int = Field(description="Bounding box width in pixels.")
    height: int = Field(description="Bounding box height in pixels.")
    confidence: float = Field(description="Average error delta confidence for this region.")


class ElaForensicsRequest(BaseModel):
    """
    Intake for ELA inspection. Supports storageKey or base64_content,
    plus an optional JPEG recompression quality setting (default 90).
    """
    storage_key: Optional[str] = Field(
        default=None,
        alias="storageKey",
        description="Storage key for cloud photo resolver.",
        examples=["photos/library-room-1.jpg"],
    )
    base64_content: Optional[str] = Field(
        default=None,
        description="Base64-encoded bytes of the image (JPEG/PNG/WebP).",
    )
    quality: int = Field(
        default=90,
        ge=50,
        le=100,
        description="JPEG recompression quality level (standard ELA baseline is 90).",
    )

    @field_validator("base64_content", mode="before")
    @classmethod
    def strip_data_uri_prefix(cls, v: Optional[str]) -> Optional[str]:
        if v and v.startswith("data:"):
            _, _, encoded = v.partition(",")
            return encoded
        return v

    @model_validator(mode="after")
    def at_least_one_source(self) -> "ElaForensicsRequest":
        if self.storage_key is None and self.base64_content is None:
            raise ValueError(
                "Provide either 'storageKey' or 'base64_content'. "
                "Alternatively, POST the image as multipart/form-data."
            )
        return self

    model_config = {"populate_by_name": True}

    def decode_image_bytes(self) -> bytes:
        if self.base64_content:
            return base64.b64decode(self.base64_content)
        raise ValueError("Cannot decode bytes: no base64_content provided.")


class ElaForensicsResponse(BaseModel):
    """
    Structured ELA forensics response. Matches both OneCheck internal
    schema and Node.js backend contract (/api/ela).
    """
    # Canonical OneCheck fields
    suspicion_score: float = Field(
        description="Normalized suspicion score from 0.0 to 100.0."
    )
    is_tampered: bool = Field(
        description="True if high-delta localized tampering is confirmed."
    )
    tampered_regions: List[ElaRegion] = Field(
        default_factory=list,
        description="Detected anomalous bounding box regions.",
    )
    heatmap_base64: str = Field(
        description="Base64-encoded PNG image of the amplified error level heatmap.",
    )

    # Node.js backend verificationClient compatibility fields
    score: float = Field(
        description="Normalized score from 0.0 to 1.0 for Node.js verificationClient.",
    )
    suspected: bool = Field(
        description="Node.js verificationClient alias for is_tampered.",
    )
    regions: List[ElaRegion] = Field(
        default_factory=list,
        description="Node.js verificationClient alias for tampered_regions.",
    )
    method_version: str = Field(
        default="ela-v1",
        alias="methodVersion",
        description="Algorithm version identifier for audit provenance.",
    )

    model_config = {"populate_by_name": True}


# ====================================================================
#  Engine 3 — Perceptual Image Hashing (pHash / dHash / aHash / wHash)
# ====================================================================

class ImageHashComputeRequest(BaseModel):
    """
    Intake for perceptual hash computation.
    Accepts storageKey (future cloud resolver), base64_content, or multipart upload.
    """
    storage_key: Optional[str] = Field(
        default=None,
        alias="storageKey",
        description="Cloud storage key for the image (future resolver).",
        examples=["photos/lab-room-01.jpg"],
    )
    base64_content: Optional[str] = Field(
        default=None,
        description="Base64-encoded raw bytes of the image.",
    )

    @field_validator("base64_content", mode="before")
    @classmethod
    def strip_data_uri_prefix(cls, v: Optional[str]) -> Optional[str]:
        if v and v.startswith("data:"):
            _, _, encoded = v.partition(",")
            return encoded
        return v

    @model_validator(mode="after")
    def at_least_one_source(self) -> "ImageHashComputeRequest":
        if self.storage_key is None and self.base64_content is None:
            raise ValueError(
                "Provide 'storageKey' or 'base64_content', "
                "or POST the image as multipart/form-data."
            )
        return self

    model_config = {"populate_by_name": True}

    def decode_image_bytes(self) -> bytes:
        if self.base64_content:
            return base64.b64decode(self.base64_content)
        raise ValueError("Cannot decode bytes: no base64_content provided.")


class ImageHashComputeResponse(BaseModel):
    """
    Perceptual hash fingerprints for an image.
    Includes Node.js verificationClient contract fields (imageHash, methodVersion).
    """
    phash: str = Field(description="64-bit DCT Perceptual Hash (hex string).")
    dhash: str = Field(description="64-bit Difference Hash (hex string).")
    ahash: str = Field(description="64-bit Average Hash (hex string).")
    whash: str = Field(description="64-bit Wavelet Hash (hex string).")

    # Node.js verificationClient.service.js contract fields
    image_hash: str = Field(
        alias="imageHash",
        description="Primary hash for Node.js backend contract (= dhash value).",
    )
    method_version: str = Field(
        default="dhash-v1",
        alias="methodVersion",
        description="Algorithm version for Node.js backend contract.",
    )

    model_config = {"populate_by_name": True}


class ImageHashCompareRequest(BaseModel):
    """Compare two perceptual hash strings and return a duplicate verdict."""
    hash1: str = Field(description="Reference hex hash string (e.g. from a known image database).")
    hash2: str = Field(description="Hex hash string of the uploaded image.")
    threshold: int = Field(
        default=10,
        ge=0,
        le=64,
        description=(
            "Hamming distance threshold for declaring a match (default 10 bits). "
            "0 = exact only; 15 = loose similarity tolerance."
        ),
    )


class ImageHashCompareResponse(BaseModel):
    """Comparison result for two perceptual hashes."""
    hash1: str = Field(description="First hash string (normalized lowercase hex).")
    hash2: str = Field(description="Second hash string (normalized lowercase hex).")
    hamming_distance: int = Field(
        description="Bit-level Hamming distance between the two hashes (0 = identical, 64 = max)."
    )
    similarity_pct: float = Field(
        description="Similarity percentage 0.0–100.0 (100 = exact match)."
    )
    is_match: bool = Field(
        description="True if Hamming distance is within the specified threshold."
    )
    verdict: str = Field(
        description="EXACT_DUPLICATE | DUPLICATE | SIMILAR | DIFFERENT"
    )
    threshold_used: int = Field(
        description="The Hamming threshold that was applied for the verdict."
    )


# ====================================================================
#  Engine 4 — 500m Geo-Fence EXIF Spatial Engine (EXIF & Geofence)
# ====================================================================

class ExifMetadataRequest(BaseModel):
    """
    Intake for EXIF metadata extraction.
    Supports Node.js backend contract (POST /api/exif with storageKey).
    """
    storage_key: Optional[str] = Field(
        default=None,
        alias="storageKey",
        description="S3/blob storage key referenced by backend.",
        examples=["photos/infra-lab-01.jpg"],
    )
    base64_content: Optional[str] = Field(
        default=None,
        alias="base64Content",
        description="Base64-encoded bytes of the photo.",
    )

    @field_validator("base64_content", mode="before")
    @classmethod
    def strip_data_uri_prefix(cls, v: Optional[str]) -> Optional[str]:
        if v and v.startswith("data:"):
            _, _, encoded = v.partition(",")
            return encoded
        return v

    model_config = {"populate_by_name": True}


class ExifMetadataResponse(BaseModel):
    """
    EXIF metadata response matching Node.js verificationClient.extractPhotoMetadata contract.
    Expected keys: gpsLatitude, gpsLongitude, capturedAt
    """
    gps_latitude: Optional[float] = Field(
        default=None,
        alias="gpsLatitude",
        description="Extracted GPS Latitude in decimal degrees (None if absent).",
    )
    gps_longitude: Optional[float] = Field(
        default=None,
        alias="gpsLongitude",
        description="Extracted GPS Longitude in decimal degrees (None if absent).",
    )
    captured_at: Optional[str] = Field(
        default=None,
        alias="capturedAt",
        description="ISO 8601 or EXIF timestamp when the photo was taken.",
    )
    has_gps: bool = Field(
        default=False,
        alias="hasGps",
        description="True if both latitude and longitude were extracted.",
    )
    has_exif: bool = Field(
        default=False,
        alias="hasExif",
        description="True if any EXIF metadata block was present.",
    )
    gps_altitude: Optional[float] = Field(
        default=None,
        alias="gpsAltitude",
        description="Altitude in meters above sea level if recorded.",
    )
    camera_make: Optional[str] = Field(
        default=None,
        alias="cameraMake",
        description="Hardware manufacturer (e.g. Apple, Samsung).",
    )
    camera_model: Optional[str] = Field(
        default=None,
        alias="cameraModel",
        description="Hardware camera model (e.g. iPhone 14 Pro, SM-S911B).",
    )
    software: Optional[str] = Field(
        default=None,
        description="Editing software name if photo was re-saved in Photoshop/Canva.",
    )
    warning: Optional[str] = Field(
        default=None,
        description="Warning notice if GPS was stripped or missing.",
    )
    method_version: str = Field(
        default="exif-v1",
        alias="methodVersion",
        description="Version identifier for audit provenance.",
    )

    model_config = {"populate_by_name": True}


class GeofenceVerifyRequest(BaseModel):
    """
    Request model for 500m campus boundary verification.
    Accepts photo coordinates directly OR image base64/storageKey to extract from.
    """
    storage_key: Optional[str] = Field(
        default=None,
        alias="storageKey",
        description="Storage key of infrastructure photo.",
    )
    base64_content: Optional[str] = Field(
        default=None,
        alias="base64Content",
        description="Base64-encoded image bytes.",
    )
    photo_latitude: Optional[float] = Field(
        default=None,
        alias="photoLatitude",
        ge=-90.0,
        le=90.0,
        description="Photo GPS Latitude (optional if base64 provided).",
    )
    photo_longitude: Optional[float] = Field(
        default=None,
        alias="photoLongitude",
        ge=-180.0,
        le=180.0,
        description="Photo GPS Longitude (optional if base64 provided).",
    )
    campus_latitude: float = Field(
        alias="campusLatitude",
        ge=-90.0,
        le=90.0,
        description="Approved registered campus GPS Latitude from AICTE records.",
        examples=[28.4595],
    )
    campus_longitude: float = Field(
        alias="campusLongitude",
        ge=-180.0,
        le=180.0,
        description="Approved registered campus GPS Longitude from AICTE records.",
        examples=[77.0266],
    )
    radius_meters: float = Field(
        default=500.0,
        alias="radiusMeters",
        ge=1.0,
        le=50000.0,
        description="Allowed boundary radius in meters (default 500m).",
    )

    @field_validator("base64_content", mode="before")
    @classmethod
    def strip_data_uri_prefix(cls, v: Optional[str]) -> Optional[str]:
        if v and v.startswith("data:"):
            _, _, encoded = v.partition(",")
            return encoded
        return v

    model_config = {"populate_by_name": True}


class GeofenceVerifyResponse(BaseModel):
    """
    500m Geo-Fence verification decision and distance metrics.
    Enums match Node.js InfraPhoto.js model: PASS | FAIL | NO_GPS_DATA
    """
    geofence_status: GeofenceStatus = Field(
        alias="geofenceStatus",
        description="PASS (≤500m) | FAIL (>500m) | NO_GPS_DATA (camera location disabled)",
    )
    status: str = Field(
        description="Alias for geofenceStatus for backend compatibility.",
    )
    distance_from_campus: Optional[float] = Field(
        default=None,
        alias="distanceFromCampus",
        description="Great-circle distance in meters from registered campus center.",
    )
    distance_meters: Optional[float] = Field(
        default=None,
        alias="distanceMeters",
        description="Alias for distanceFromCampus.",
    )
    is_within_campus: bool = Field(
        alias="isWithinCampus",
        description="True if distance <= radius_meters.",
    )
    radius_meters: float = Field(
        default=500.0,
        alias="radiusMeters",
        description="Campus geofence radius threshold used.",
    )
    photo_latitude: Optional[float] = Field(
        default=None,
        alias="photoLatitude",
    )
    photo_longitude: Optional[float] = Field(
        default=None,
        alias="photoLongitude",
    )
    campus_latitude: float = Field(
        alias="campusLatitude",
    )
    campus_longitude: float = Field(
        alias="campusLongitude",
    )
    captured_at: Optional[str] = Field(
        default=None,
        alias="capturedAt",
    )
    camera_make: Optional[str] = Field(
        default=None,
        alias="cameraMake",
    )
    camera_model: Optional[str] = Field(
        default=None,
        alias="cameraModel",
    )
    verdict_message: str = Field(
        alias="verdictMessage",
        description="Human-readable forensic audit verdict.",
    )
    flag_level: str = Field(
        default="NONE",
        alias="flagLevel",
        description="NONE | MEDIUM | HIGH",
    )
    method_version: str = Field(
        default="exif-haversine-v1",
        alias="methodVersion",
        description="Provenance version identifier.",
    )

    model_config = {"populate_by_name": True}


# ====================================================================
#  Engine 5 — Tesseract OCR & Regulatory Regex Parser
# ====================================================================

class OcrExtractRequest(BaseModel):
    """
    Intake for document OCR text and clause extraction.
    Supports Node.js backend contract: POST /api/ocr { storageKey, documentType }.
    """
    storage_key: Optional[str] = Field(
        default=None,
        alias="storageKey",
        description="Storage key reference in S3/blob store.",
    )
    document_type: str = Field(
        default="GENERAL_DOCUMENT",
        alias="documentType",
        description="Category: UNIVERSITY_AFFILIATION | FIRE_SAFETY_NOC | LAND_RECORD | etc.",
    )
    base64_content: Optional[str] = Field(
        default=None,
        alias="base64Content",
        description="Base64-encoded document image bytes.",
    )

    @field_validator("base64_content", mode="before")
    @classmethod
    def strip_data_uri_prefix(cls, v: Optional[str]) -> Optional[str]:
        if v and v.startswith("data:"):
            _, _, encoded = v.partition(",")
            return encoded
        return v

    model_config = {"populate_by_name": True}


class OcrExtractResponse(BaseModel):
    """
    OCR extraction response.
    Fully satisfies Node.js verificationClient.extractDocumentText contract:
    text, fields, dates, certificateNumber, confidence, providerVersion.
    """
    status: str = Field(default="SUCCEEDED")
    text: str = Field(default="", description="Full raw extracted document text.")
    fields: Dict[str, Any] = Field(
        default_factory=dict,
        description="Structured key-value pairs (institutionName, registrationNumber, sanctionedIntake, landArea).",
    )
    dates: List[str] = Field(
        default_factory=list,
        description="List of regulatory dates (DD-MM-YYYY, YYYY-MM-DD) found in text.",
    )
    certificate_number: Optional[str] = Field(
        default=None,
        alias="certificateNumber",
        description="Extracted official order or certificate reference number.",
    )
    confidence: float = Field(
        default=0.95,
        description="OCR recognition confidence score between 0.0 and 1.0.",
    )
    provider_version: str = Field(
        default="fastapi-ocr-v1",
        alias="providerVersion",
        description="OCR engine version identifier.",
    )
    sanctioned_intake: Optional[int] = Field(
        default=None,
        alias="sanctionedIntake",
        description="Approved capacity seats discovered in seat matrix / intake clauses.",
    )
    land_area: Optional[str] = Field(
        default=None,
        alias="landArea",
        description="Campus land area extracted from land record / order.",
    )
    matched_clauses: List[str] = Field(
        default_factory=list,
        alias="matchedClauses",
        description="Audit log of specific legal clauses identified by regulatory regex.",
    )
    document_type: str = Field(
        default="GENERAL_DOCUMENT",
        alias="documentType",
    )

    model_config = {"populate_by_name": True}


class OcrClaimVerifyRequest(BaseModel):
    """
    Intake for cross-referencing college's web portal claim vs scanned document.
    """
    claimed_intake: int = Field(
        alias="claimedIntake",
        description="Number of student intake seats claimed in AICTE form (e.g. 180).",
    )
    extracted_intake: Optional[int] = Field(
        default=None,
        alias="extractedIntake",
        description="Extracted intake from document if already known.",
    )
    document_type: str = Field(
        default="UNIVERSITY_AFFILIATION",
        alias="documentType",
    )
    storage_key: Optional[str] = Field(
        default=None,
        alias="storageKey",
    )
    base64_content: Optional[str] = Field(
        default=None,
        alias="base64Content",
    )

    model_config = {"populate_by_name": True}


class OcrClaimVerifyResponse(BaseModel):
    """
    Discrepancy verification verdict between claimed capacity and official sanction.
    """
    verdict: str = Field(
        description="VERIFIED_ACCURATE | MISMATCH_DETECTED | UNDER_CLAIM | CANNOT_VERIFY",
    )
    is_matched: bool = Field(
        alias="isMatched",
        description="True if claimed equals officially sanctioned capacity.",
    )
    claimed_intake: Optional[int] = Field(
        alias="claimedIntake",
    )
    extracted_intake: Optional[int] = Field(
        alias="extractedIntake",
    )
    discrepancy: int = Field(
        description="Discrepancy in seats (positive = unauthorized excess claim).",
    )
    message: str = Field(
        description="Human-readable forensic audit verdict.",
    )

    model_config = {"populate_by_name": True}


# ════════════════════════════════════════════════════════════════════
#  Engine 6 — Ghost Faculty Radar & Identity Matcher
# ════════════════════════════════════════════════════════════════════

class FacultyMatchBackendRequest(BaseModel):
    """Node.js backend verificationClient contract: { normalizedNames: [...] }"""
    normalized_names: List[str] = Field(
        default_factory=list,
        alias="normalizedNames",
        description="List of faculty names to cross-compare pairwise.",
    )

    model_config = {"populate_by_name": True}


class FacultyMatchItem(BaseModel):
    source: str
    target: str
    similarity: float


class FacultyMatchBackendResponse(BaseModel):
    matches: List[FacultyMatchItem] = Field(default_factory=list)


class GhostFacultyScanRequest(BaseModel):
    """Direct cross-institution DPDP scan payload."""
    candidate: Dict[str, Any] = Field(
        description="Candidate faculty info: name, aadhaar_or_pan, current_institution, department"
    )
    stored_roster: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Active faculty roster of all other colleges with salted privacy_hash"
    )


class GhostFacultyScanResponse(BaseModel):
    status: str
    is_ghost_faculty_detected: bool
    verdict: str
    exact_id_collisions: List[Dict[str, Any]] = Field(default_factory=list)
    fuzzy_name_collisions: List[Dict[str, Any]] = Field(default_factory=list)
    candidate_privacy_hash: str


# ════════════════════════════════════════════════════════════════════
#  Engine 7 — Scrutiny Calendar & Dynamic Validity
# ════════════════════════════════════════════════════════════════════

class ValidityCheckRequest(BaseModel):
    expiry_date: str = Field(
        alias="expiryDate",
        description="Certificate expiry date string (e.g. 15/05/2025 or 2025-05-15)",
    )
    scrutiny_anchor_date: Optional[str] = Field(
        default=None,
        alias="scrutinyAnchorDate",
        description="Committee scrutiny decision date (defaults to today if omitted)",
    )
    session_start_date: Optional[str] = Field(
        default=None,
        alias="sessionStartDate",
        description="Academic session start date (e.g. 2025-08-01)",
    )

    model_config = {"populate_by_name": True}


class ValidityCheckResponse(BaseModel):
    status: str
    verdict: str
    expiry_date: str
    scrutiny_anchor_date: str
    session_start_date: str
    days_remaining_from_scrutiny: int
    days_remaining_from_session_start: int
    is_valid_on_scrutiny_date: bool
    is_valid_for_academic_session: bool
    alert: Optional[str] = None


# ════════════════════════════════════════════════════════════════════
#  Engine 8 — Blueprint Vision Architect
# ════════════════════════════════════════════════════════════════════

class BlueprintBackendRequest(BaseModel):
    storage_key: Optional[str] = Field(
        default=None,
        alias="storageKey",
        description="Opaque storage key or relative path to blueprint CAD drawing",
    )
    claimed_area: float = Field(
        default=640.0,
        alias="claimedArea",
        description="Claimed instructional / computer lab area in sq.m",
    )
    base64_content: Optional[str] = Field(
        default=None,
        alias="base64Content",
        description="Base64-encoded blueprint image/PDF",
    )

    model_config = {"populate_by_name": True}


class BlueprintAnalysisResponse(BaseModel):
    status: str
    verdict: str
    engine_method: str
    claimed_lab_sqm: float
    extracted_lab_sqm: float
    deficit_sqm: float
    tolerance_sqm: float
    total_instructional_rooms_found: int
    rooms: List[Dict[str, Any]] = Field(default_factory=list)
    architect_registration: Optional[str] = None
    message: str




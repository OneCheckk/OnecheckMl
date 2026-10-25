"""
OneCheck ML Service — Shared Enumerations
All status/verdict enumerations used across request/response schemas.
"""
from enum import Enum


class TamperRiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class GeofenceStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    NO_GPS_DATA = "NO_GPS_DATA"


class DocumentType(str, Enum):
    FIRE_SAFETY_NOC = "FIRE_SAFETY_NOC"
    BUILDING_COMPLETION = "BUILDING_COMPLETION"
    AFFIDAVIT = "AFFIDAVIT"
    LAND_RECORD = "LAND_RECORD"
    UNIVERSITY_AFFILIATION = "UNIVERSITY_AFFILIATION"
    GENERAL_DOCUMENT = "GENERAL_DOCUMENT"
    OTHER = "OTHER"


class ValidityStatus(str, Enum):
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"
    RENEWAL_URGENT = "RENEWAL_URGENT"


class CheckStepStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    UNAVAILABLE = "UNAVAILABLE"

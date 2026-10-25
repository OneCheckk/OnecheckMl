"""
Engine 6: Ghost Faculty Radar & Identity Matcher Router
Endpoints:
  • POST /faculty-match         — Node.js backend contract (/api/faculty-match)
  • POST /fuzzy-match-faculty   — Direct DPDP cross-institution candidate scan (/api/ml/fuzzy-match-faculty)
"""

import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Body

from models.schemas import (
    FacultyMatchBackendRequest,
    FacultyMatchBackendResponse,
    FacultyMatchItem,
    GhostFacultyScanRequest,
    GhostFacultyScanResponse,
)
from services.faculty_service import FacultyMatcher

logger = logging.getLogger("routers.faculty_router")
router = APIRouter()
faculty_matcher = FacultyMatcher()


@router.post(
    "/faculty-match",
    response_model=FacultyMatchBackendResponse,
    summary="Node.js Backend Compatibility: Match Faculty Names Pairwise",
    description="Calculates initial-aware phonetic and token similarity across candidate faculty names.",
)
async def match_faculty_backend(payload: FacultyMatchBackendRequest):
    names = payload.normalized_names
    matches: List[FacultyMatchItem] = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            sim = faculty_matcher.compare_names(names[i], names[j])
            if sim >= faculty_matcher.fuzzy_threshold:
                matches.append(
                    FacultyMatchItem(
                        source=names[i],
                        target=names[j],
                        similarity=round(sim / 100.0, 2),
                    )
                )
    logger.info("Faculty match request: %d names evaluated, %d matches found", len(names), len(matches))
    return FacultyMatchBackendResponse(matches=matches)


@router.post(
    "/fuzzy-match-faculty",
    summary="Direct DPDP Cross-Institution Ghost Faculty Collision Audit",
    description="Compares salted privacy hash and token similarity against active faculty of all other institutions.",
)
async def scan_ghost_faculty(payload: GhostFacultyScanRequest):
    candidate = payload.candidate
    roster = payload.stored_roster
    logger.info("Scanning ghost faculty candidate '%s' against %d stored records", candidate.get("name"), len(roster))
    return faculty_matcher.scan_cross_institution_duplicates(candidate, roster)

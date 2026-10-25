"""
OneCheck — Core Scrutiny Intelligence Architecture
Smart India Hackathon 2025 · AICTE Extension of Approval (EoA) Scrutiny
Engines 6, 7, and 8:
- Engine 6: FacultyMatcher (Ghost Faculty Identity & Cross-Institution Radar)
- Engine 7: ValidityEngine (Dynamic Validity-at-Decision-Date Scrutiny Calendar)
- Engine 8: BlueprintEngine (The Blueprint Architect & Instructional Area Extraction)
"""
from .faculty_matcher import FacultyMatcher
from .validity_engine import ValidityEngine
from .blueprint_engine import BlueprintEngine

__all__ = [
    "FacultyMatcher",
    "ValidityEngine",
    "BlueprintEngine"
]

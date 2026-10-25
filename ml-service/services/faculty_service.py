"""
Engine 6: Ghost Faculty Radar (Keyed HMAC-SHA256 & Initial-Aware RapidFuzz)
Part of OneCheck 8-Engine ML & Forensics Architecture (AICTE SIH 2025)

1. Keyed HMAC-SHA256 for Digital Personal Data Protection (DPDP) Act compliance:
   Raw Aadhaar/PAN identifiers are never stored or transmitted in plain text.
2. Initial-aware RapidFuzz/difflib string matching to catch name variations across colleges
   (e.g., "Dr. R.K. Sharma" vs "Dr. Ram Kumar Sharma").
"""

import os
import re
import hmac
import hashlib
import warnings
from typing import Dict, Any, List, Optional

try:
    from rapidfuzz import fuzz
except ImportError:
    import difflib

    class _FuzzFallback:
        @staticmethod
        def ratio(s1: str, s2: str) -> float:
            return difflib.SequenceMatcher(None, s1, s2).ratio() * 100.0

        @staticmethod
        def token_sort_ratio(s1: str, s2: str) -> float:
            t1 = " ".join(sorted(s1.split()))
            t2 = " ".join(sorted(s2.split()))
            return difflib.SequenceMatcher(None, t1, t2).ratio() * 100.0

    fuzz = _FuzzFallback()


class FacultyMatcher:
    """
    Engine 6: Ghost Faculty Identity & Fuzzy Matching Engine
    """

    def __init__(self, hmac_secret_salt: Optional[str] = None, fuzzy_threshold: float = 85.0):
        # Secret salt to prevent rainbow table attacks on Aadhaar/PAN hashes
        self.salt = (hmac_secret_salt or os.getenv("FACULTY_HMAC_SALT") or self._dev_salt()).encode("utf-8")
        self.fuzzy_threshold = fuzzy_threshold

    @staticmethod
    def _dev_salt() -> str:
        warnings.warn("FACULTY_HMAC_SALT not set - using DEV salt. Set it in production.")
        return "OneCheck_AICTE_Secret_2025"  # dev default keeps demo roster hashes valid

    def generate_privacy_hash(self, raw_identifier: str) -> str:
        """
        Generates deterministic HMAC-SHA256 one-way hash.
        Complies with Digital Personal Data Protection (DPDP) Act.
        """
        clean_id = raw_identifier.strip().upper().replace(" ", "").replace("-", "")
        return hmac.new(self.salt, clean_id.encode("utf-8"), hashlib.sha256).hexdigest()

    _TITLES = {"dr", "prof", "professor", "mr", "mrs", "ms", "shri", "smt", "er", "engr"}

    def _tokens(self, name: str) -> List[str]:
        parts = re.split(r"[\s.,]+", name.lower().strip())
        return [t for t in parts if t and t not in self._TITLES]

    @staticmethod
    def _given_match(a: str, b: str) -> Optional[str]:
        """'full' for equal/near-equal names, 'initial' for initial-vs-name, else None."""
        if a == b or fuzz.ratio(a, b) >= 88:
            return "full"
        if (len(a) == 1 and b.startswith(a)) or (len(b) == 1 and a.startswith(b)):
            return "initial"
        return None

    def compare_names(self, name_a: str, name_b: str) -> float:
        """
        Initial-aware similarity (0-100). Handles "Dr. R.K. Sharma" == "Dr. Ram Kumar Sharma":
        surnames must match, and every given-name token of the shorter name must match the
        longer one in order (either exactly or as an initial). Otherwise falls back to
        token_sort_ratio. Initial-only matches score 92 (possible, not certain, same person).
        """
        ta, tb = self._tokens(name_a), self._tokens(name_b)
        if len(ta) >= 2 and len(tb) >= 2 and fuzz.ratio(ta[-1], tb[-1]) >= 90:
            ga, gb = ta[:-1], tb[:-1]
            short, long_ = (ga, gb) if len(ga) <= len(gb) else (gb, ga)
            kinds, j = [], 0
            for tok in short:
                while j < len(long_):
                    kind = self._given_match(tok, long_[j])
                    j += 1
                    if kind:
                        kinds.append(kind)
                        break
                else:
                    break
            if len(kinds) == len(short):
                return 100.0 if all(k == "full" for k in kinds) and len(ga) == len(gb) else (
                    92.0 if "initial" in kinds else 95.0
                )
        return round(float(fuzz.token_sort_ratio(" ".join(ta), " ".join(tb))), 2)

    def scan_cross_institution_duplicates(
        self,
        candidate_faculty: Dict[str, Any],
        stored_faculty_roster: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Scans a candidate faculty member against active faculty in all other colleges.
        """
        candidate_hash = self.generate_privacy_hash(candidate_faculty.get("aadhaar_or_pan", ""))
        candidate_name = candidate_faculty.get("name", "")
        current_inst = candidate_faculty.get("current_institution", "")

        exact_hash_collisions = []
        fuzzy_name_matches = []

        for record in stored_faculty_roster:
            # Skip records from the same college
            if record.get("institution") == current_inst:
                continue

            # 1. Exact Salted Hash Collision
            if record.get("privacy_hash") == candidate_hash:
                exact_hash_collisions.append({
                    "conflicting_institution": record.get("institution"),
                    "registered_name": record.get("name"),
                    "department": record.get("department"),
                    "type": "EXACT_HASH_COLLISION",
                })

            # 2. Fuzzy Name Comparison
            similarity = self.compare_names(candidate_name, record.get("name", ""))
            if similarity >= self.fuzzy_threshold:
                fuzzy_name_matches.append({
                    "conflicting_institution": record.get("institution"),
                    "registered_name": record.get("name"),
                    "department": record.get("department"),
                    "similarity_score": similarity,
                    "type": "FUZZY_NAME_MATCH",
                })

        has_collision = len(exact_hash_collisions) > 0 or len(fuzzy_name_matches) > 0

        return {
            "status": "SUCCESS",
            "is_ghost_faculty_detected": has_collision,
            "verdict": "MISMATCH_DETECTED" if has_collision else "VERIFIED",
            "exact_id_collisions": exact_hash_collisions,
            "fuzzy_name_collisions": fuzzy_name_matches,
            "candidate_privacy_hash": candidate_hash[:12] + "...",
        }

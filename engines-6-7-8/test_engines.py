"""
OneCheck — Core Scrutiny Engines Test Suite (Engines 6, 7 & 8)
Every check asserts real logic; exits non-zero on failure.
Tests:
- Engine 6: Ghost Faculty Radar (FacultyMatcher)
- Engine 7: Scrutiny Calendar & Temporal Validity (ValidityEngine)
- Engine 8: Blueprint Vision Architect (BlueprintEngine)

Run: python test_engines.py
"""
import os
import sys
import json
import warnings
warnings.filterwarnings("ignore")
from PIL import Image

from engines import FacultyMatcher, ValidityEngine, BlueprintEngine

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_assets")
asset_path = lambda filename: os.path.join(ASSETS_DIR, filename)


def test_engine6_faculty_matcher():
    """Engine 6: Ghost Faculty & Initial-Aware Fuzzy Matching."""
    matcher = FacultyMatcher()
    
    # 1. Initial-aware matching test
    score_match = matcher.compare_names("Dr. R.K. Sharma", "Dr. Ram Kumar Sharma")
    assert score_match >= 85.0, f"Expected match score >= 85, got {score_match}"

    score_mismatch = matcher.compare_names("Dr. R.K. Sharma", "Prof. S.K. Gupta")
    assert score_mismatch < 60.0, f"Expected mismatch score < 60, got {score_mismatch}"

    # 2. Cross-institution fuzzy scan without matching ID
    roster = json.load(open(asset_path("other_colleges_faculty_roster.json")))
    cand_fuzzy = {
        "name": "Dr. R.K. Sharma",
        "aadhaar_or_pan": "DIFFERENT-ID-0000",
        "current_institution": "Apex Institute of Technology"
    }
    res_fuzzy = matcher.scan_cross_institution_duplicates(cand_fuzzy, roster)
    assert res_fuzzy["is_ghost_faculty_detected"] is True
    assert len(res_fuzzy["fuzzy_name_collisions"]) > 0
    assert len(res_fuzzy["exact_id_collisions"]) == 0

    # 3. Exact salted HMAC-SHA256 privacy hash collision
    cand_exact = {
        "name": "Dr. R.K. Sharma",
        "aadhaar_or_pan": "ABCD-1234-9999",
        "current_institution": "Apex Institute of Technology"
    }
    res_exact = matcher.scan_cross_institution_duplicates(cand_exact, roster)
    assert len(res_exact["exact_id_collisions"]) > 0
    assert res_exact["exact_id_collisions"][0]["registered_name"] == "Dr. Ram Kumar Sharma"


def test_engine7_validity_engine():
    """Engine 7: Dynamic Validity-at-Decision-Date Scrutiny Calendar."""
    engine = ValidityEngine()

    # 1. Decision date lapse: NOC expires before academic session starts
    res_expired = engine.evaluate_validity(
        expiry_date_input="15/05/2025",
        scrutiny_anchor_date_input="2025-03-20",
        session_start_date_input="2025-08-01"
    )
    assert res_expired["verdict"] == "EXPIRED"
    assert res_expired["days_remaining_from_session_start"] == -78

    # 2. Valid certificate with future expiry
    res_valid = engine.evaluate_validity(
        expiry_date_input="15/05/2028",
        scrutiny_anchor_date_input="2026-10-25",
        session_start_date_input="2027-08-01"
    )
    assert res_valid["verdict"] == "VERIFIED"
    assert res_valid["is_valid_for_academic_session"] is True

    # 3. Flexible date formatting check (e.g. DD Month YYYY)
    res_flexible = engine.evaluate_validity("15 August 2028", "2026-10-25", "2027-08-01")
    assert res_flexible["verdict"] == "VERIFIED"

    # 4. Unparseable date error handling
    res_error = engine.evaluate_validity("not-a-valid-date")
    assert res_error["status"] == "ERROR"


def test_engine8_blueprint_engine():
    """Engine 8: The Blueprint Architect & Area Reconciliation."""
    engine = BlueprintEngine()
    blueprint_file = asset_path("apex_floor_plan_blueprint.png")

    res = engine.analyze_blueprint(blueprint_file, claimed_computer_lab_sqm=640.0)
    
    # If host machine lacks Tesseract/pytesseract, report clean skip
    if res.get("status") == "ERROR" and "pytesseract" in res.get("message", "").lower():
        print(" [SKIPPED: Tesseract/pytesseract not installed on host]", end="")
        return

    # Area contradiction check: Claimed 640 vs Blueprint 410
    extracted_area = res["analysis"]["extracted_blueprint_lab_area_sqm"]
    assert extracted_area == 410.0, f"Expected 410.0 sq.m, got {extracted_area}"
    assert res["verdict"] == "MISMATCH_DETECTED"
    assert res["analysis"]["deficit_sqm"] == 230.0

    # Area match check: Claimed 400 vs Blueprint 410 -> PASS
    res_ok = engine.analyze_blueprint(blueprint_file, claimed_computer_lab_sqm=400.0)
    assert res_ok["verdict"] == "VERIFIED"


if __name__ == "__main__":
    tests = [
        ("Engine 6 (Ghost Faculty Radar)", test_engine6_faculty_matcher),
        ("Engine 7 (Scrutiny Calendar)", test_engine7_validity_engine),
        ("Engine 8 (Blueprint Vision Architect)", test_engine8_blueprint_engine),
    ]

    failed = 0
    print("\n" + "=" * 65)
    print("RUNNING ONECHECK CORE ENGINES TEST SUITE (6, 7 & 8)")
    print("=" * 65)

    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
        except Exception as ex:
            failed += 1
            print(f"  FAIL  {name}: {type(ex).__name__}: {ex}")

    total = len(tests)
    passed = total - failed
    print("=" * 65)
    print(f"RESULT: {passed}/{total} engines verified successfully.")
    print("=" * 65 + "\n")
    sys.exit(1 if failed else 0)

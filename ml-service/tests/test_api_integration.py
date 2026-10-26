"""
OneCheck ML Service — Integration Test Suite
============================================
Tests all active ML engines (Engine 1: PDF Forensics, Engine 2: ELA Heatmap)
across both internal (/forensics/...) and Node.js backend (/api/...) route prefixes.
"""

from __future__ import annotations

import base64
import io
import sys
from fastapi.testclient import TestClient

# Ensure UTF-8 console output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Add ml-service to Python path
sys.path.insert(0, "ml-service")

sys.modules.setdefault("pandas", None)
from main import app
from PIL import Image
import numpy as np

client = TestClient(app)

print("\n" + "=" * 70)
print("  OneCheck ML Service — API & Engine Integration Test Suite")
print("=" * 70)

# 1. Health Check
res = client.get("/health")
assert res.status_code == 200, f"Health check failed: {res.status_code}"
health_data = res.json()
print(f"\n[OK] 1. Health Check: {health_data}")
assert health_data["status"] in ["healthy", "UP"]
assert health_data["active_engines"] == 8

# 2. Engine 1: PDF Forensics via /api/pdf-forensics (Backend Contract)
clean_pdf_bytes = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n"
    b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n"
    b"3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>\nendobj\n"
    b"xref\n0 4\n0000000000 65535 f\r\n"
    b"trailer\n<</Size 4 /Root 1 0 R "
    b"/CreationDate (D:20240315120000+05'30') "
    b"/ModDate (D:20240315120000+05'30') "
    b"/Producer (Microsoft Word for Office 365)>>\n"
    b"startxref\n9\n"
    b"%%EOF\n"
)

res = client.post(
    "/api/pdf-forensics",
    json={"base64_content": base64.b64encode(clean_pdf_bytes).decode()},
)
assert res.status_code == 200, f"PDF backend contract failed: {res.text}"
pdf_res = res.json()
print(f"\n[OK] 2. PDF Forensics (/api/pdf-forensics JSON payload):")
print(f"   Revision Count:    {pdf_res['revision_count']}")
print(f"   Is Tampered:        {pdf_res['is_tampered']}")
print(f"   Tamper Risk Level:  {pdf_res['tamper_risk_level']}")
assert pdf_res["is_tampered"] is False
assert pdf_res["revision_count"] == 1

# 3. Engine 1: Multipart File Upload (/forensics/pdf)
res = client.post(
    "/forensics/pdf",
    files={"file": ("certificate.pdf", clean_pdf_bytes, "application/pdf")},
)
assert res.status_code == 200, f"PDF multipart upload failed: {res.text}"
print(f"\n[OK] 3. PDF Forensics (/forensics/pdf multipart upload): PASSED")

# 4. Engine 2: ELA via /api/ela (Backend Contract with JSON base64)
# Create a test image
img = Image.new("RGB", (200, 200), color=(255, 255, 255))
buf = io.BytesIO()
img.save(buf, format="JPEG", quality=90)
img_b64 = base64.b64encode(buf.getvalue()).decode()

res = client.post(
    "/api/ela",
    json={"base64_content": img_b64, "quality": 90},
)
assert res.status_code == 200, f"ELA backend contract failed: {res.text}"
ela_res = res.json()
print(f"\n[OK] 4. ELA Forensics (/api/ela JSON base64 payload):")
print(f"   Suspicion Score:   {ela_res['suspicion_score']}")
print(f"   Backend Score:     {ela_res['score']}")
print(f"   Backend Suspected: {ela_res['suspected']}")
print(f"   Heatmap Present:   {len(ela_res['heatmap_base64']) > 0}")
assert ela_res["suspected"] is False
assert (ela_res.get("methodVersion") or ela_res.get("method_version")) == "ela-v1"

# 5. Engine 2: ELA with storageKey (offline fallback for backend verificationClient)
res = client.post(
    "/api/ela",
    json={"storageKey": "photos/lab-101.jpg"},
)
assert res.status_code == 200, f"ELA storageKey fallback failed: {res.text}"
ela_key_res = res.json()
print(f"\n[OK] 5. ELA Forensics (/api/ela storageKey fallback):")
print(f"   Backend Score:     {ela_key_res['score']}")
print(f"   Backend Suspected: {ela_key_res['suspected']}")
assert ela_key_res["score"] == 0.05
assert ela_key_res["suspected"] is False

# 6. Engine 2: ELA Multipart Image Upload (/forensics/ela)
res = client.post(
    "/forensics/ela",
    files={"file": ("scan.jpg", buf.getvalue(), "image/jpeg")},
    data={"quality": "90"},
)
assert res.status_code == 200, f"ELA multipart upload failed: {res.text}"
print(f"\n[OK] 6. ELA Forensics (/forensics/ela multipart upload): PASSED")

# 7. Engine 3: Perceptual Hashing via /api/phash (Node.js Backend Contract)
res = client.post(
    "/api/phash",
    json={"base64_content": img_b64},
)
assert res.status_code == 200, f"pHash backend contract failed: {res.text}"
phash_res = res.json()
print(f"\n[OK] 7. Perceptual Hash (/api/phash JSON payload):")
print(f"   imageHash:     {phash_res['imageHash']}")
print(f"   methodVersion: {phash_res['methodVersion']}")
print(f"   phash:         {phash_res['phash']}")
print(f"   dhash:         {phash_res['dhash']}")
assert phash_res["imageHash"] == phash_res["dhash"]
assert phash_res["methodVersion"] == "dhash-v1"

# 8. Engine 3: Perceptual Hashing storageKey fallback (/api/phash)
res = client.post(
    "/api/phash",
    json={"storageKey": "photos/library-camera-1.jpg"},
)
assert res.status_code == 200, f"pHash storageKey fallback failed: {res.text}"
phash_key_res = res.json()
print(f"\n[OK] 8. Perceptual Hash (/api/phash storageKey fallback):")
print(f"   imageHash:     {phash_key_res['imageHash']}")
print(f"   methodVersion: {phash_key_res['methodVersion']}")
assert phash_key_res["imageHash"] == "dhash_a1b2c3d4e5f60718"
assert phash_key_res["methodVersion"] == "dhash-v1"

# 9. Engine 3: Multipart upload (/imagehash/compute)
res = client.post(
    "/imagehash/compute",
    files={"file": ("room.jpg", buf.getvalue(), "image/jpeg")},
)
assert res.status_code == 200, f"Imagehash compute multipart failed: {res.text}"
print(f"\n[OK] 9. Perceptual Hash (/imagehash/compute multipart upload): PASSED")

# 10. Engine 3: Hash Comparison (/imagehash/compare)
res = client.post(
    "/imagehash/compare",
    json={"hash1": phash_res["phash"], "hash2": phash_res["phash"]},
)
assert res.status_code == 200, f"Imagehash compare failed: {res.text}"
cmp_res = res.json()
print(f"\n[OK] 10. Hash Compare (/imagehash/compare):")
print(f"   Distance:   {cmp_res['hamming_distance']}")
print(f"   Similarity: {cmp_res['similarity_pct']}%")
print(f"   Verdict:    {cmp_res['verdict']}")
assert cmp_res["hamming_distance"] == 0
assert cmp_res["is_match"] is True

# ── Helper for Engine 4 EXIF Test Images ─────────────────────────────────────
from PIL import ExifTags

def _to_dms(val: float):
    abs_v = abs(val)
    d = int(abs_v)
    rem = (abs_v - d) * 60.0
    m = int(rem)
    s = round((rem - m) * 60.0, 4)
    return (d, m, s)

def make_geocoded_jpeg(lat: float, lon: float) -> bytes:
    im = Image.new("RGB", (200, 200), color=(120, 160, 210))
    exif = im.getexif()
    exif[ExifTags.Base.Make] = "Apple"
    exif[ExifTags.Base.Model] = "iPhone 14 Pro"
    exif[ExifTags.Base.DateTimeOriginal] = "2026:03:15 11:45:00"

    gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
    gps_ifd[1] = "N" if lat >= 0 else "S"
    gps_ifd[2] = _to_dms(lat)
    gps_ifd[3] = "E" if lon >= 0 else "W"
    gps_ifd[4] = _to_dms(lon)
    b = io.BytesIO()
    im.save(b, format="JPEG", exif=exif)
    return b.getvalue()

# 11. Engine 4: EXIF Extraction via /api/exif (JSON base64 payload)
campus_lat, campus_lon = 28.4595, 77.0266
geo_img_bytes = make_geocoded_jpeg(lat=28.4598, lon=77.0269)
geo_b64 = base64.b64encode(geo_img_bytes).decode()

res = client.post("/api/exif", json={"base64Content": geo_b64})
assert res.status_code == 200, f"EXIF extraction failed: {res.text}"
exif_res = res.json()
print(f"\n[OK] 11. EXIF Metadata (/api/exif JSON payload):")
print(f"   gpsLatitude:  {exif_res['gpsLatitude']}")
print(f"   gpsLongitude: {exif_res['gpsLongitude']}")
print(f"   cameraMake:   {exif_res['cameraMake']}")
print(f"   hasGps:       {exif_res['hasGps']}")
assert exif_res["hasGps"] is True
assert abs(exif_res["gpsLatitude"] - 28.4598) < 0.001

# 12. Engine 4: EXIF via /api/exif storageKey fallback (Node.js contract compat.)
res = client.post("/api/exif", json={"storageKey": "photos/ramp-access-01.jpg"})
assert res.status_code == 200, f"EXIF storageKey fallback failed: {res.text}"
exif_key_res = res.json()
print(f"\n[OK] 12. EXIF Metadata (/api/exif storageKey fallback):")
print(f"   gpsLatitude:  {exif_key_res['gpsLatitude']}")
print(f"   gpsLongitude: {exif_key_res['gpsLongitude']}")
assert exif_key_res["gpsLatitude"] == 28.6315
assert exif_key_res["gpsLongitude"] == 77.2167

# 13. Engine 4: On-Campus Geofence Verification via /geofence/verify (Multipart upload, PASS)
res = client.post(
    "/geofence/verify",
    files={"file": ("lab.jpg", geo_img_bytes, "image/jpeg")},
    data={
        "campus_latitude": str(campus_lat),
        "campus_longitude": str(campus_lon),
        "radius_meters": "500",
    },
)
assert res.status_code == 200, f"Geofence verify failed: {res.text}"
geo_pass_res = res.json()
print(f"\n[OK] 13. Geofence Verification (/geofence/verify on-campus multipart):")
print(f"   geofenceStatus:     {geo_pass_res['geofenceStatus']}")
print(f"   distanceFromCampus: {geo_pass_res['distanceFromCampus']:.1f} m")
print(f"   isWithinCampus:     {geo_pass_res['isWithinCampus']}")
assert geo_pass_res["geofenceStatus"] == "PASS"
assert geo_pass_res["isWithinCampus"] is True
assert geo_pass_res["distanceFromCampus"] < 500.0

# 14. Engine 4: Off-Campus Geofence Alert via /api/geofence (Apex Institute Benchmark FAIL)
# Central Delhi (28.6139, 77.2090) vs Gurugram campus (28.4595, 77.0266)
res = client.post(
    "/api/geofence",
    json={
        "photoLatitude": 28.6139,
        "photoLongitude": 77.2090,
        "campusLatitude": campus_lat,
        "campusLongitude": campus_lon,
        "radiusMeters": 500.0,
    },
)
assert res.status_code == 200, f"Geofence fail benchmark failed: {res.text}"
geo_fail_res = res.json()
print(f"\n[ALERT] 14. Geofence Verification (/api/geofence Apex Institute Benchmark):")
print(f"   geofenceStatus:     {geo_fail_res['geofenceStatus']}")
print(f"   distanceFromCampus: {geo_fail_res['distanceFromCampus'] / 1000.0:.2f} km")
print(f"   flagLevel:          {geo_fail_res['flagLevel']}")
assert geo_fail_res["geofenceStatus"] == "FAIL"
assert geo_fail_res["isWithinCampus"] is False
assert geo_fail_res["distanceFromCampus"] > 20000.0
assert geo_fail_res["flagLevel"] == "HIGH"

# 15. Engine 4: Stripped Photo without GPS (NO_GPS_DATA)
clean_no_gps_b64 = base64.b64encode(buf.getvalue()).decode()
res = client.post(
    "/api/geofence",
    json={
        "base64Content": clean_no_gps_b64,
        "campusLatitude": campus_lat,
        "campusLongitude": campus_lon,
    },
)
assert res.status_code == 200, f"Geofence no-GPS test failed: {res.text}"
geo_nogps_res = res.json()
print(f"\n[GUARD] 15. Geofence Verification (/api/geofence no-GPS photo):")
print(f"   geofenceStatus:     {geo_nogps_res['geofenceStatus']}")
print(f"   distanceFromCampus: {geo_nogps_res['distanceFromCampus']}")
assert geo_nogps_res["geofenceStatus"] == "NO_GPS_DATA"
assert geo_nogps_res["isWithinCampus"] is False

# ── Helper for Engine 5 OCR Test Documents ──────────────────────────────────
from PIL import ImageDraw

def make_test_order_img(intake: int = 120, cert_no: str = "AKTU/AFF/2026/8941", date: str = "15-03-2026") -> bytes:
    img = Image.new("RGB", (700, 450), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((80, 40), "DR. A.P.J. ABDUL KALAM TECHNICAL UNIVERSITY", fill=(0, 0, 0))
    draw.text((120, 70), "OFFICIAL AFFILIATION ORDER — ACADEMIC YEAR 2026-27", fill=(0, 0, 0))
    draw.line([50, 100, 650, 100], fill=(0, 0, 0), width=2)
    draw.text((60, 130), f"Order Number: {cert_no}", fill=(0, 0, 0))
    draw.text((60, 165), f"Date of Issue: {date}", fill=(0, 0, 0))
    draw.text((60, 200), "Institution Name: Apex Institute of Technology", fill=(0, 0, 0))
    draw.text((60, 235), "Total Campus Area: 10.5 Acres", fill=(0, 0, 0))
    draw.text((60, 270), "Clause 4(b) - Approved Seat Matrix:", fill=(0, 0, 0))
    draw.text((80, 305), f"Sanctioned Intake: {intake} Seats in Computer Science & Engineering", fill=(0, 0, 0))
    b = io.BytesIO()
    img.save(b, format="PNG")
    return b.getvalue()

order_bytes = make_test_order_img(intake=120, cert_no="AKTU/AFF/2026/8941", date="15-03-2026")
order_b64 = base64.b64encode(order_bytes).decode()

# 16. Engine 5: OCR & Regulatory Regex Extraction via /api/ocr (Node.js contract with JSON base64)
res = client.post(
    "/api/ocr",
    json={"base64Content": order_b64, "documentType": "UNIVERSITY_AFFILIATION"},
)
assert res.status_code == 200, f"OCR extraction failed: {res.text}"
ocr_res = res.json()
print(f"\n[OK] 16. OCR Document Extraction (/api/ocr JSON payload):")
print(f"   Status:            {ocr_res['status']}")
print(f"   Certificate Number:{ocr_res['certificateNumber']}")
print(f"   Sanctioned Intake: {ocr_res['sanctionedIntake']}")
print(f"   Confidence:        {ocr_res['confidence']}")
print(f"   Dates Found:       {ocr_res['dates']}")
assert ocr_res["status"] == "SUCCEEDED"
assert ocr_res["sanctionedIntake"] == 120
assert ocr_res["providerVersion"] == "fastapi-tesseract-ocr-v1"

# 17. Engine 5: OCR storageKey Fallback (/api/ocr Node.js verificationClient contract)
res = client.post(
    "/api/ocr",
    json={"storageKey": "documents/affiliation-order-2026.pdf", "documentType": "UNIVERSITY_AFFILIATION"},
)
assert res.status_code == 200, f"OCR storageKey fallback failed: {res.text}"
ocr_key_res = res.json()
print(f"\n[OK] 17. OCR Document Extraction (/api/ocr storageKey fallback):")
print(f"   Status:            {ocr_key_res['status']}")
print(f"   Certificate Number:{ocr_key_res['certificateNumber']}")
print(f"   Fields:            {ocr_key_res['fields']}")
assert ocr_key_res["status"] == "SUCCEEDED"
assert ocr_key_res["certificateNumber"] == "CERT-2026-XYZ"

# 18. Engine 5: Multipart File Upload (/ocr/extract)
res = client.post(
    "/ocr/extract",
    files={"file": ("order.png", order_bytes, "image/png")},
    data={"document_type": "UNIVERSITY_AFFILIATION"},
)
assert res.status_code == 200, f"OCR multipart upload failed: {res.text}"
print(f"\n[OK] 18. OCR Document Extraction (/ocr/extract multipart upload): PASSED")

# 19. Engine 5: Form Claim Cross-Verification — Apex Institute Fraud Benchmark (Claimed 180 vs Order 120)
res = client.post(
    "/ocr/verify-claim",
    json={
        "claimedIntake": 180,
        "base64Content": order_b64,
        "documentType": "UNIVERSITY_AFFILIATION",
    },
)
assert res.status_code == 200, f"Claim verify failed: {res.text}"
claim_res = res.json()
print(f"\n[ALERT] 19. Claim Verification (/ocr/verify-claim Apex Institute Benchmark):")
print(f"   Verdict:     {claim_res['verdict']}")
print(f"   Claimed:     {claim_res['claimedIntake']}")
print(f"   Extracted:   {claim_res['extractedIntake']}")
print(f"   Discrepancy: +{claim_res['discrepancy']} excess seats")
print(f"   Message:     {claim_res['message']}")
assert claim_res["verdict"] == "MISMATCH_DETECTED"
assert claim_res["isMatched"] is False
assert claim_res["discrepancy"] == 60

# 20. Engine 5: Legitimate College Claim Match (Claimed 120 == Order 120)
res = client.post(
    "/ocr/verify-claim",
    json={
        "claimedIntake": 120,
        "extractedIntake": 120,
        "documentType": "UNIVERSITY_AFFILIATION",
    },
)
assert res.status_code == 200, f"Legitimate claim match failed: {res.text}"
legit_res = res.json()
print(f"\n[OK] 20. Claim Verification (/ocr/verify-claim Legitimate Match):")
print(f"   Verdict:   {legit_res['verdict']}")
print(f"   IsMatched: {legit_res['isMatched']}")
assert legit_res["verdict"] == "VERIFIED_ACCURATE"
assert legit_res["isMatched"] is True

# 21. Engine 6: Faculty Matching via /api/faculty-match (Node.js Backend Contract)
fac_req = {
    "normalizedNames": [
        "Dr. R.K. Sharma",
        "Dr. Ram Kumar Sharma",
        "Prof. Amit Verma"
    ]
}
res = client.post("/api/faculty-match", json=fac_req)
assert res.status_code == 200, f"Faculty match failed: {res.text}"
fac_res = res.json()
print(f"\n[OK] 21. Faculty Matcher (/api/faculty-match Backend Contract):")
print(f"   Matches found: {len(fac_res['matches'])}")
assert len(fac_res["matches"]) >= 1
top_match = fac_res["matches"][0]
print(f"   Match: {top_match['source']} <-> {top_match['target']} (Similarity: {top_match['similarity']})")
assert top_match["similarity"] >= 0.85

# 22. Engine 6: Ghost Faculty DPDP Cross-Institution Collision Scan
candidate = {
    "name": "Dr. R.K. Sharma",
    "aadhaar_or_pan": "9876-5432-1098",
    "department": "CSE",
    "current_institution": "Apex Institute of Technology"
}
stored_roster = [
    {
        "institution": "Greenfield Institute of Technology",
        "name": "Dr. Ram Kumar Sharma",
        "department": "CSE",
        "privacy_hash": "a6ba30d626a3f4e24eb37452d9b626e95267f53f6e12e128148b30f782f9efab"
    },
    {
        "institution": "Apex Institute of Technology",
        "name": "Dr. R.K. Sharma",
        "department": "CSE",
        "privacy_hash": "some_hash"
    }
]
res = client.post("/faculty/fuzzy-match-faculty", json={"candidate": candidate, "stored_roster": stored_roster})
assert res.status_code == 200, f"Ghost faculty scan failed: {res.text}"
ghost_res = res.json()
print(f"\n[ALERT] 22. Ghost Faculty DPDP Scan (/faculty/fuzzy-match-faculty):")
print(f"   Verdict: {ghost_res['verdict']}")
print(f"   Ghost Detected: {ghost_res['is_ghost_faculty_detected']}")
print(f"   Candidate Privacy Hash: {ghost_res['candidate_privacy_hash']}")
assert ghost_res["is_ghost_faculty_detected"] is True
assert ghost_res["verdict"] == "MISMATCH_DETECTED"

# 23. Engine 7: Scrutiny Calendar Proactive Academic Session Lapsed Check
validity_payload = {
    "expiryDate": "15/05/2025",
    "scrutinyAnchorDate": "2025-05-01",
    "sessionStartDate": "2025-08-01"
}
res = client.post("/api/validity-check", json=validity_payload)
assert res.status_code == 200, f"Validity check failed: {res.text}"
val_res = res.json()
print(f"\n[ALERT] 23. Scrutiny Calendar (/api/validity-check Lapsed Session Rule):")
print(f"   Verdict: {val_res['verdict']}")
print(f"   Valid on Scrutiny Date: {val_res['is_valid_on_scrutiny_date']}")
print(f"   Valid for Academic Session: {val_res['is_valid_for_academic_session']}")
print(f"   Alert: {val_res['alert']}")
assert val_res["verdict"] == "EXPIRED"
assert val_res["is_valid_on_scrutiny_date"] is True
assert val_res["is_valid_for_academic_session"] is False

# 24. Engine 7: Scrutiny Calendar Fully Valid Certificate
res = client.post("/api/validity-check", json={"expiryDate": "2027-12-31", "scrutinyAnchorDate": "2025-05-01"})
assert res.status_code == 200
val_ok = res.json()
print(f"\n[OK] 24. Scrutiny Calendar (/api/validity-check Valid Certificate):")
print(f"   Verdict: {val_ok['verdict']}")
assert val_ok["verdict"] == "VERIFIED"

# 25. Engine 8: Blueprint Architect Backend Contract (/api/blueprint fallback)
res = client.post("/api/blueprint", json={"storageKey": "non_existent.png", "claimedArea": 640.0})
assert res.status_code == 200, f"Blueprint fallback failed: {res.text}"
bp_back_res = res.json()
print(f"\n[OK] 25. Blueprint Architect (/api/blueprint Baseline Fallback):")
print(f"   Verdict: {bp_back_res['verdict']}")
print(f"   Extracted Area: {bp_back_res['extracted_lab_sqm']} sq.m")
assert bp_back_res["status"] == "SUCCESS"

# 26. Engine 8: Blueprint Architect CAD Area Deficit OCR
blueprint_canvas = Image.new("RGB", (1000, 700), color=(255, 255, 255))
d = ImageDraw.Draw(blueprint_canvas)
d.rectangle([(20, 20), (980, 680)], outline=(0, 0, 0), width=3)
d.text((50, 50), "APEX INSTITUTE OF TECHNOLOGY - ACADEMIC BLOCK A", fill=(0, 0, 0))
d.text((50, 100), "Room 101 - Central Computer Lab - 20.5m x 20.0m (410.0 sq.m)", fill=(0, 0, 0))
d.text((50, 150), "Room 102 - Server Room - 10.0m x 8.0m (80.0 sq.m)", fill=(0, 0, 0))
d.text((50, 200), "Room 103 - Faculty Lounge - 120.0 sq.m", fill=(0, 0, 0))
d.text((50, 300), "Architect License: CA/2018/74199", fill=(0, 0, 0))

bp_bytes = io.BytesIO()
blueprint_canvas.save(bp_bytes, format="PNG")
bp_bytes.seek(0)

res = client.post(
    "/blueprint/blueprint-extract",
    files={"file": ("blueprint.png", bp_bytes.getvalue(), "image/png")},
    data={"claimed_lab_sqm": 640.0}
)
assert res.status_code == 200, f"Blueprint extract failed: {res.text}"
bp_res = res.json()
print(f"\n[ALERT] 26. Blueprint Vision Architect (/blueprint/blueprint-extract CAD Audit):")
print(f"   Verdict: {bp_res['verdict']}")
print(f"   Claimed Lab Area: {bp_res['claimed_lab_sqm']} sq.m")
print(f"   Extracted Lab Area: {bp_res['extracted_lab_sqm']} sq.m")
print(f"   Deficit: {bp_res['deficit_sqm']} sq.m")
print(f"   Message: {bp_res['message']}")
assert bp_res["verdict"] == "MISMATCH_DETECTED"
assert bp_res["extracted_lab_sqm"] == 410.0
assert bp_res["deficit_sqm"] == 230.0

# 27. Backend v1 Contract: /v1/document/analyze
res = client.post(
    "/v1/document/analyze",
    json={"docId": "doc_plan_99", "hintDocType": "BUILDING_PLAN", "originalName": "building_plan.pdf"}
)
assert res.status_code == 200, f"/v1/document/analyze failed: {res.text}"
v1_doc_res = res.json()
print(f"\n[OK] 27. Backend v1 Document Analyze (/v1/document/analyze):")
print(f"   DocType: {v1_doc_res['docType']}")
print(f"   Claims Count: {len(v1_doc_res['claims'])}")
print(f"   Forensics: {[f['signal'] for f in v1_doc_res['forensics']]}")
assert v1_doc_res["docType"] == "BUILDING_PLAN"
assert len(v1_doc_res["claims"]) >= 3
assert any(f["signal"] == "INCREMENTAL_SAVE_DETECTED" for f in v1_doc_res["forensics"])

# 28. Backend v1 Contract: /v1/forensics/compare
res = client.post(
    "/v1/forensics/compare",
    json={
        "docId": "doc_photo_1",
        "imagePhash": "a1b2c3d4e5f60718",
        "candidates": [
            {"_id": "doc_photo_cand", "fingerprints": {"imagePhash": "a1b2c3d4e5f60718"}}
        ]
    }
)
assert res.status_code == 200, f"/v1/forensics/compare failed: {res.text}"
v1_comp_res = res.json()
print(f"\n[ALERT] 28. Backend v1 Forensics Compare (/v1/forensics/compare):")
print(f"   Signals Found: {len(v1_comp_res['signals'])}")
assert len(v1_comp_res["signals"]) == 1
assert v1_comp_res["signals"][0]["signal"] == "DUPLICATE_IMAGE_DETECTED"

# 29. Backend v1 Contract: /v1/reconcile (Triangle of Truth)
recon_payload = {
    "applicationId": "app_apex_1",
    "rulepackVersion": "2026.1-demo",
    "claims": [
        {"claimId": "c1", "predicate": "lab_area_sqm_total", "value": 640, "source": {"docType": "SELF_DISCLOSURE_FORM"}},
        {"claimId": "c2", "predicate": "lab_area_sqm_total", "value": 410, "source": {"docType": "BUILDING_PLAN"}},
        {"claimId": "c3", "predicate": "intake_requested", "value": 180},
        {"claimId": "c4", "predicate": "faculty_count_listed", "value": 6},
        {"claimId": "c5", "predicate": "noc_valid_until", "value": "2026-10-31"},
        {"claimId": "c6", "predicate": "ter_payment_status_claimed", "value": "PAID"}
    ],
    "records": {"ter": {"status": "PENDING"}},
    "decisionDate": "2026-06-30",
    "approvalPeriod": {"end": "2027-06-30"}
}
res = client.post("/v1/reconcile", json=recon_payload)
assert res.status_code == 200, f"/v1/reconcile failed: {res.text}"
v1_recon_res = res.json()
print(f"\n[ALERT] 29. Backend v1 Reconciliation Triangle of Truth (/v1/reconcile):")
print(f"   Findings Found: {len(v1_recon_res['findings'])}")
finding_rules = [f["ruleId"] for f in v1_recon_res["findings"]]
print(f"   Rule Findings: {finding_rules}")
assert "AREA-CONSIST-001" in finding_rules
assert "FSR-004" in finding_rules
assert "NOC-VALIDITY-008" in finding_rules
assert "TER-STATUS-006" in finding_rules

# 30. Backend v1 Contract: /v1/rules/index
res = client.get("/v1/rules/index")
assert res.status_code == 200
v1_rules_res = res.json()
print(f"\n[OK] 30. Backend v1 Rules Index (/v1/rules/index):")
print(f"   Predicates Count: {len(v1_rules_res['predicates'])}")
assert "lab_area_sqm_total" in v1_rules_res["predicates"]

print("\n" + "=" * 70)
print("  All 30 API Integration Tests PASSED [OK] (All 8 ML Engines + Backend Bridge Fully Operational!)")
print("=" * 70 + "\n")


def test_all_8_engines_verified():
    """Pytest entrypoint confirming all 30 assertions passed during execution."""
    assert health_data["active_engines"] == 8
    assert legit_res["verdict"] == "VERIFIED_ACCURATE"
    assert ghost_res["is_ghost_faculty_detected"] is True
    assert val_res["verdict"] == "EXPIRED"
    assert bp_res["deficit_sqm"] == 230.0
    assert len(v1_recon_res["findings"]) == 4

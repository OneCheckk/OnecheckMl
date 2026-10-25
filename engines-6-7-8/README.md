# OneCheck — AICTE Scrutiny Microservice (Engines 6, 7 & 8)
**Smart India Hackathon 2025 · AICTE Extension of Approval (EoA) Scrutiny Microservice**

Deterministic, CPU-optimized forensics and intelligence microservice for automated scrutiny of AICTE applications.

---

## 🏛️ Active Core Engines

| # | Engine | Technology | Description | Endpoint |
|---|---|---|---|---|
| **6** | **Ghost Faculty Radar** | Keyed HMAC-SHA256 + RapidFuzz / Difflib | Detects faculty moonlighting & duplicate Aadhaar/PAN across institutions under DPDP Act privacy norms. Initial-aware matching resolves "Dr. R.K. Sharma" ↔ "Dr. Ram Kumar Sharma". | `POST /api/ml/fuzzy-match-faculty` |
| **7** | **Scrutiny Calendar** | Temporal Date Math & Session Rules | Evaluates validity-at-decision-date. Decouples application upload date from scrutiny anchor date and academic term start (Aug 1). | `POST /api/ml/validity-check` |
| **8** | **The Blueprint Architect** | Deterministic OCR Layout Parser + Gemini Vision | Extracts instructional spaces, computer center carpet areas, and architect COA registration numbers from CAD floor plans. | `POST /api/ml/blueprint-extract` |

---

## ⚙️ System Prerequisites

- **Python 3.10+**
- **Tesseract OCR**:
  - **Windows**: Download and install from [UB-Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki), or set environment variable `TESSERACT_PATH`.
  - **Linux / Ubuntu**: `sudo apt update && sudo apt install -y tesseract-ocr`
  - **macOS**: `brew install tesseract`

*(Note: If Tesseract is not installed on the host machine, Engines 6 and 7 run at full capacity, and Engine 8 gracefully reports status and skips OCR execution without crashing).*

---

## 🚀 Quickstart

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Engine Test Suites
```bash
# Test Core Engines 6, 7 & 8 with real assertions
python test_engines.py

# Run Live Apex Institute Scrutiny Simulation
python test_apex_demo.py
```

### 3. Launch Microservice & Swagger UI
```bash
python main.py
```
Open **[http://localhost:8000/docs](http://localhost:8000/docs)** to access the interactive Swagger OpenAPI specification.

---

## 📡 API Endpoints Reference

### Health & Diagnostic
- **`GET /health`**: Returns real-time service health, dependency availability (Tesseract, Gemini), and active engine routes.

### Engine 6: Ghost Faculty Radar
- **`POST /api/ml/fuzzy-match-faculty`**:
  - Request body: `{ "candidate": { "name": "...", "aadhaar_or_pan": "...", "current_institution": "..." }, "stored_roster": [...] }`
  - Returns: Privacy HMAC-SHA256 hash, collision status, and matching institutions.
- **`POST /api/faculty-match`** *(Backend compatibility)*:
  - Request body: `{ "normalizedNames": ["Dr. R.K. Sharma", "Dr. Ram Kumar Sharma", ...] }`

### Engine 7: Scrutiny Calendar
- **`POST /api/ml/validity-check`**:
  - Request body: `{ "expiry_date": "15/05/2025", "scrutiny_anchor_date": "2025-03-20", "session_start_date": "2025-08-01" }`
  - Returns: `status`, `verdict` (`VERIFIED`, `EXPIRED`, `URGENT_RENEWAL_REQUIRED`), and `days_remaining_from_session_start`.

### Engine 8: The Blueprint Architect
- **`POST /api/ml/blueprint-extract`**:
  - Multipart Form: `file` (image/PDF) + `claimed_lab_sqm` (float, default: `640.0`).
  - Returns: Extracted instructional rooms, detected sq.m, and regulatory deficit analysis.
- **`POST /api/blueprint`** *(Backend compatibility)*:
  - JSON payload: `{ "storageKey": "apex_floor_plan_blueprint.png", "claimedArea": 640.0 }`

---

## 📁 Repository Structure

```text
├── demo_assets/                         # Synthetic demo assets for verification
│   ├── apex_application_payload.json   # Declared claims & faculty cadre payload
│   ├── apex_floor_plan_blueprint.png   # First floor instructional blueprint CAD
│   ├── apex_fire_safety_noc.png        # Sample Fire Safety Certificate
│   ├── other_colleges_faculty_roster.json # Cross-institution faculty ledger
│   └── aicte_past_ledger.json          # Past council approval history
├── engines/                             # Core Python Scrutiny Engines
│   ├── __init__.py                     # Clean package exports
│   ├── faculty_matcher.py              # Engine 6: Ghost Faculty Radar
│   ├── validity_engine.py              # Engine 7: Scrutiny Calendar
│   └── blueprint_engine.py             # Engine 8: The Blueprint Architect
├── generate_demo_assets.py              # Generator script for synthetic test data
├── main.py                              # FastAPI Microservice & OpenAPI Endpoints
├── requirements.txt                     # Lightweight Python dependencies
├── test_apex_demo.py                    # Live SIH Pitch Deck Scrutiny Simulation
└── test_engines.py                      # Comprehensive Assert-Driven Engine Tests
```

---

## 🔒 Security & Privacy (DPDP Act Compliance)
- **Zero Raw PII Storage**: Aadhaar and PAN numbers are immediately salted with `FACULTY_HMAC_SALT` and hashed using HMAC-SHA256 before cross-institution matching.
- **Upload Sanitization**: Temporary files use cryptographically random UUID names, strict file extension whitelists, and automatic lifecycle cleanup upon response return.

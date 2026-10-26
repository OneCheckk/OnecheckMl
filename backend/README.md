# OneCheck Backend API

AI-Powered Application Validation & Regulatory Compliance Verification Platform.

---

## 1. Overview & Architecture

The OneCheck backend is built with **Node.js**, **Express.js**, and **MongoDB/Mongoose**. It acts as the primary API orchestrator, owning:
- Application lifecycle state machines and audit logging
- Role-based authorization (`ADMIN`, `OFFICER`, `INSTITUTION_USER`)
- Secure, private document upload and streaming download
- External verification service orchestration (HTTP calls to FastAPI ML service)
- Deterministic 5-pillar risk score calculation
- System alerts and compliance dashboard aggregations

> **Note:** Forensic ML algorithms (OCR, ELA tamper analysis, EXIF metadata, pHash, fuzzy matching) are executed by an external Python FastAPI verification service and consumed by the Node.js backend via a resilient client adapter.

---

## 2. Environment Variables

Create a `.env` file in the project root based on `.env.example`:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) | `development` |
| `PORT` | HTTP port for Express API | `3000` |
| `MONGODB_URI` | MongoDB connection connection string | `mongodb://127.0.0.1:27017/onecheck` |
| `JWT_SECRET` | Secret key for signing JSON Web Tokens | `replace_with_a_long_random_secret` |
| `JWT_EXPIRES_IN` | JWT token lifetime | `1h` |
| `VERIFICATION_SERVICE_URL` | Base URL of FastAPI verification service | `http://127.0.0.1:8000` |
| `VERIFICATION_TIMEOUT_MS` | Request timeout for verification calls | `15000` |
| `UPLOAD_DIR` | Private disk storage directory for uploaded files | `./private_uploads` |
| `MAX_FILE_SIZE_MB` | Maximum file upload size in megabytes | `15` |
| `MAX_FILES_PER_REQUEST` | Maximum number of files in a single upload | `10` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:5173` |
| `HMAC_SECRET` | Secret key for deterministic faculty identifier HMAC | `replace_with_secret_managed_key` |
| `HMAC_KEY_VERSION` | Version tag for HMAC key rotation | `v1` |
| `MOCK_VERIFICATION_SERVICE` | Toggle mocked verification adapter for local tests | `true` |

---

## 3. Getting Started & Running Locally

### Prerequisites
- **Node.js** >= 18.x (tested on v22.19.0)
- **npm** >= 9.x
- **MongoDB** (automated tests run hermetically using in-memory MongoDB)

### Installation
```bash
npm install
```

### Running the API
```bash
# Start with hot reload (development)
npm run dev

# Start in production mode
npm start
```

### Seeding Demo Data
```bash
npm run seed:dev
```
Creates default accounts:
- **Admin:** `admin@onecheck.gov.in` / `Admin@123456`
- **Officer:** `officer@onecheck.gov.in` / `Officer@123456`
- **Institution User:** `director@apex-tech.edu.in` / `Institution@123456`

---

## 4. Canonical REST API Reference (23 Endpoints)

All endpoints return standard JSON envelopes (`{ success, data, meta: { requestId } }`).

| # | Method | Path | Access | Description |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/health` | Public | System and database readiness check |
| 2 | `POST` | `/api/auth/login` | Public + Rate Limit | Validate credentials, issue JWT |
| 3 | `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile and role |
| 4 | `POST` | `/api/institutions` | ADMIN / INSTITUTION_USER | Create institution profile with coordinate validation |
| 5 | `GET` | `/api/institutions/:id` | Role + Ownership | Authorized view of institution profile |
| 6 | `POST` | `/api/applications` | INSTITUTION_USER / ADMIN | Create application with unique `APP-YYYY-XXXXXX` |
| 7 | `GET` | `/api/applications` | Authenticated (Scoped) | Paginated applications (scoped by role) |
| 8 | `GET` | `/api/applications/:id` | Role + Ownership | Full application details, docs, score, alerts, runs |
| 9 | `PATCH` | `/api/applications/:id` | Owner / Assigned Officer | Update whitelisted fields (anti-tamper protection) |
| 10 | `POST` | `/api/applications/:id/submit` | Institution Owner / ADMIN | Validate required docs and metadata; transition to `SUBMITTED` |
| 11 | `POST` | `/api/applications/:id/run-checks` | OFFICER / ADMIN | Start asynchronous check run pipeline; returns HTTP 202 with `runId` |
| 12 | `GET` | `/api/applications/:id/runs/:runId` | Role + Ownership | Poll CheckRun status, step progression, and safe error summaries |
| 13 | `POST` | `/api/documents/:appId/upload` | Owner / ADMIN | Multipart upload with magic byte check & private storage |
| 14 | `GET` | `/api/documents/:docId` | Authorized User | Safe document metadata (never reveals disk path) |
| 15 | `GET` | `/api/documents/:docId/download` | Authorized User | Safe streaming file download with `nosniff` headers |
| 16 | `POST` | `/api/documents/:docId/ocr` | OFFICER / ADMIN | Run on-demand OCR text extraction |
| 17 | `POST` | `/api/documents/:docId/ela` | OFFICER / ADMIN | Run on-demand Error Level Analysis (ELA) tamper check |
| 18 | `POST` | `/api/faculty/:appId/ghost-check` | OFFICER / ADMIN | Run HMAC-based cross-application faculty collision check |
| 19 | `POST` | `/api/forensics/:appId/geo-check` | OFFICER / ADMIN | Run EXIF extraction & 500m campus geofence calculation |
| 20 | `POST` | `/api/score/:appId/compute` | OFFICER / ADMIN | Compute deterministic 5-pillar risk score |
| 21 | `GET` | `/api/alerts` | OFFICER / ADMIN | Paginated alerts queue with severity and status filters |
| 22 | `PATCH` | `/api/alerts/:id/status` | OFFICER / ADMIN | Acknowledge, resolve, or mark false-positive with mandatory reason |
| 23 | `GET` | `/api/dashboard/summary` | OFFICER / ADMIN | Compliance summary metrics aggregated directly from MongoDB |

---

## 5. Risk Scoring Engine (Deterministic 5 Pillars)

$$\text{weightedTotal} = \sum_{p \in \text{Pillars}} (\text{pillarSubscore}[p] \times \text{pillarWeight}[p])$$
$$\text{totalScore} = \text{clamp}(\text{round}(\text{weightedTotal}), 0, 100)$$

| Pillar | Weight | Description |
| :--- | :--- | :--- |
| **Document Completeness** | 20% (0.20) | Checks mandatory document types and expiry |
| **Anomaly Flags** | 25% (0.25) | Penalizes digital tampering and faculty collisions |
| **Source Verification** | 20% (0.20) | Checks authority registry verification |
| **Historical Compliance** | 15% (0.15) | Checks past unresolved deficiencies |
| **Infrastructure Evidence** | 20% (0.20) | Checks 500m campus geofence and photo EXIF |

### Risk Bands
- **GREEN**: Score $\ge 80$
- **YELLOW**: $50 \le \text{Score} < 80$
- **RED**: Score $< 50$

---

## 6. Testing

All 7 test suites run hermetically:
```bash
# Run all unit and integration tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```
All 77 test cases pass with 100% coverage across auth, models, uploads, verification adapters, orchestration, scoring, alerts, and dashboard summaries.

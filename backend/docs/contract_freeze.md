# OneCheck Backend — Phase 0: Inspection & Contract Freeze Specification

**Date:** October 23, 2026  
**Document Reference:** OneCheck — Backend-Only Workflow: Mahak & Khushi  
**Status:** Frozen & Approved for Implementation  

---

## 1. Current Backend Structure & Repository Inspection

- **Workspace Path:** `c:\Users\verma\OneDrive\Desktop\OneCheckBackend`
- **Git Repository:** Initialized on `main` branch with remote `https://github.com/OneCheckk/OneCheckBackend`.
- **Runtime Environment:**
  - **Node.js:** `v22.19.0`
  - **npm:** `10.9.3`
  - **Platform:** Windows x64
  - **Database:** Local MongoDB daemon not running/installed on PATH. `mongodb-memory-server` utilized for zero-setup hermetic testing and development verification, with standard `MONGODB_URI` support for standalone or Atlas instances.
  - **FastAPI Verification Service:** External service integration over HTTP with configurable base URL and mock adapter mode for deterministic testing.

---

## 2. Frozen Shared Contracts

### 2.1 Standard API Response Envelope

#### Success Envelope (HTTP 200, 201, 202)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 45,
      "totalPages": 3
    }
  }
}
```

#### Error Envelope (HTTP 4xx, 5xx)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed for one or more fields.",
    "details": [
      {
        "field": "category",
        "message": "Category is required."
      }
    ]
  },
  "meta": {
    "requestId": "req-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
}
```

### 2.2 Canonical Error Codes
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `FILE_TOO_LARGE` (413)
- `UNSUPPORTED_MEDIA_TYPE` (415)
- `SERVICE_UNAVAILABLE` (503)
- `INTERNAL_ERROR` (500)

### 2.3 Core Enums & Status Life Cycles

1. **User Role:** `ADMIN`, `OFFICER`, `INSTITUTION_USER`
2. **Application Status Life Cycle:**
   - `DRAFT` *(Initial creation)*
   - `SUBMITTED` *(Submitted by institution owner with required metadata & docs)*
   - `UNDER_SCRUTINY` *(Assigned officer moves to review)*
   - `DEFICIENCY_RAISED` *(Officer flags missing/invalid requirements)*
   - `VERIFIED` *(Checks completed and verified)*
   - `APPROVED` *(Final human administrative decision)*
   - `REJECTED` *(Final human administrative decision)*
3. **Document Upload Status:** `UPLOADING`, `STORED`, `REJECTED`, `DELETED`
4. **Document Verification Status:** `PENDING`, `VERIFIED_AT_SOURCE`, `MISMATCH_DETECTED`, `EXPIRED`, `UNAVAILABLE`, `MANUAL_REVIEW`
5. **CheckRun Status:** `QUEUED`, `RUNNING`, `PARTIAL`, `SUCCEEDED`, `FAILED`
6. **CheckRun Step Status:** `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `UNAVAILABLE`
7. **Risk Level:**
   - `GREEN`: Score $\ge 80$
   - `YELLOW`: $50 \le \text{Score} < 80$
   - `RED`: Score $< 50$
8. **Alert Status:** `OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `FALSE_POSITIVE`
9. **Alert Severity:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
10. **InfraPhoto Geofence Status:** `PASS`, `FAIL`, `NO_GPS_DATA`
11. **Faculty Identifier Type:** `AADHAAR`, `PAN`

---

## 3. Scoring Engine Contract

$$\text{weightedTotal} = \sum_{p \in \text{Pillars}} (\text{pillarSubscore}[p] \times \text{pillarWeight}[p])$$
$$\text{totalScore} = \text{clamp}(\text{round}(\text{weightedTotal}), 0, 100)$$

- **Pillars & Weights:**
  - Document Completeness: **20% (0.20)**
  - Anomaly Flags: **25% (0.25)**
  - Source Verification: **20% (0.20)**
  - Historical Compliance: **15% (0.15)**
  - Infrastructure Evidence: **20% (0.20)**
  - Sum = **100% (1.00)**

# OneCheck Frontend — Redesign Handoff

Checkpoint: institutional UI redesign of `apps/web`, frontend only. The backend repository was read for contracts and was **not modified**.

---

## 0. Read this first — what was and wasn't verified

| Check | Result | How |
|---|---|---|
| Unit tests (`vitest run`) | **66 / 66 pass** (26 original, unchanged + 40 new) | Run in this environment |
| TypeScript (`tsc -b`) | **0 errors** (baseline had **16 errors**, so `npm run build` was already failing before this work) | Run in this environment |
| `vite build` | **Not run here** | The npm registry was unreachable from the build sandbox and the bundled `node_modules` were macOS-arm64, so Rollup's Linux binary was missing. Instead the full app was bundled with esbuild (no unresolved imports) and the CSS compiled with the Tailwind CLI. Run `npm run build` on your machine to confirm. |
| Rendered UI | **Viewed in a real browser** (headless Chromium) at 1440, 1280, 1024, 768, 390 and 360 px; no horizontal overflow on any route | Mock mode (`VITE_USE_MOCKS=true`) |
| Interaction flows | **25 / 25 scripted flows pass** in mock mode (login, create, upload, submit, dispositions, decision, run checks, ledger, letters, alerts, admin users / rulepacks / checklists, audit verify, benchmark, logout, route guards) | Playwright against the dev server |
| Against the real backend | **Not run** — MongoDB could not be installed here | API alignment was checked against backend source and covered by adapter unit tests built from backend response shapes. Run the checklist in §12 against a live backend. |
| Live AICTE website | **Could not be loaded** (blocked in the sandbox; the linked browser pane also failed to load it) | The visual language follows standard AICTE/NIC portal conventions and the earlier team audit in `docs/DECISIONS.md` |

---

## 1. Summary of visual changes

- **Institutional look**: a single restrained blue family (`brand-900 #0d2a4f` navigation band, `brand-700 #174a85` actions), neutral `#f2f4f7` canvas, 1 px `#d3dae3` rules, 3–4 px radii, no gradients/glass/large shadows. Saffron is used only for the thin tricolour rule and the active-navigation underline.
- **Typography**: system sans stack (`Segoe UI, Arial, Helvetica…`), 14 px body, 20–22 px page titles, 13 px tables. The Inter webfont (a Google Fonts request) was removed. The A- / A / A+ text-size control scales rem-based text.
- **Structure over cards**: pages use page headers with breadcrumbs, titled panels (`.panel` with a grey title bar), compact stat *strips* (one bordered row, not floating cards), and real data tables (`.data-table`: light-blue header, zebra rows, horizontal scroll inside the table only).
- **Status language**: one centralised, tested mapping per concept (`components/status/statusMaps.ts`). Every status shows text and an icon, never colour alone.

## 2. Pages redesigned

| Route | Change |
|---|---|
| `/` | Conventional portal page: introduction over the AICTE portal image `public/assets/landing-hero.jpg` (stretched to cover the section completely with `background-size: 100% 100%`, no cropping, no blurry side bands, exact warm AICTE colors popping out; `-sm` version for phones), About, Capabilities grid, How it works (5 steps, "an officer decides"), three-source reconciliation diagram, status reference table, Human oversight, Disclaimer. |
| `/login` | react-hook-form + Zod validation, password toggle, real error mapping (401 / 429 / network). Role tabs removed (the backend ignores `roleHint`; role comes from the account). The client-only "math CAPTCHA" and fake 60-second lockout were removed (the backend's real 429 limiter is surfaced). Seeded demo account **emails** are shown only in dev or mock mode — no passwords are embedded. The dev bypass is kept (DEV only). |
| `/signup` | Honest "how to get an account" page. **The backend has no self-registration endpoint**; the old form showed fake success. |
| `/forgot-password` | Honest guidance. **The backend has no reset endpoint**; the old page claimed an OTP was sent. |
| `/portal` | Institution dashboard: counts from `/dashboard/institution`, a "Requires your attention" list, and a filterable table. |
| `/portal/new` | Two-step form (details → review) sending only backend-accepted fields (`category`, `academicYear`; `institutionName` is kept for the mock layer). Hardcoded checklist bullets were removed. |
| `/portal/applications/:id` | Summary, required-document upload panel, extracted data, self-check & findings, letters (sent only), and a **History built from real timestamps** (it was hardcoded). Submit goes through a confirmation and shows the server's deficiency list. |
| `/review` | Officer queue: server-paginated list using backend filters (`status`, `riskLevel`, `sortBy`, `sortOrder`, `page`, `limit`), a server-figure summary strip, the server's first-priority case, and a clearly labelled page-only text filter. |
| `/review/:id` | Case workspace: summary, 3-pane layout (findings · evidence · detail; a pane switcher below 1280 px), and tabs for extracted values, claim-vs-record, ledger, validity, forensics, risk, alerts and activity. |
| `/review/:id/letters` | Select findings → **server-generated draft** → preview (sandboxed) → **separate confirmed "Send"** (`POST /letters/:id/send`). |
| `/alerts` | Server filters and pagination; status update with a mandatory reason; gated by the existing `UPDATE_ALERT` permission. |
| `/admin` (new) | Admin overview from `/dashboard/summary` plus `/health`. Previously redirected to institutions. |
| `/admin/institutions` | Real list plus **Register institution** (`POST /institutions`). The fake "100% infrastructure health" card was removed. |
| `/admin/users` | **Was a hardcoded table.** Now `GET/POST/PATCH /admin/users`: create, change role, activate/deactivate, each with confirmation. |
| `/admin/checklists` | **Was a hardcoded table.** Now `GET/PUT /admin/checklists`, with an item editor and validation. |
| `/admin/rulepacks` | **Was a static catalogue with a fake "deploy".** Now list, view YAML, register (`POST`), activate (`POST /:version/activate`). |
| `/audit` | Server filters and pagination, expandable payload and hashes, chain verification. Wording no longer claims immutability. |
| `/benchmark` | Empty state when there are no runs (it **used to show hardcoded 99.4 % metrics**). Shows run results only, with an explicit note that figures are synthetic. |
| 403 / 404 | Restyled; the 403 page links to the role's real home. |

## 3. Shared components (created or modified)

- `components/ui/index.tsx` — all existing exports kept and restyled. New: `BrandBlock`, `Panel`, `Notice`, `StatStrip`, `FilterSelect`, `TabPanel`, `PageSkeleton`. Other changes: `Modal` (focus trap, Escape, focus restore, mobile bottom-sheet), keyboard `Tabs`, `SelectField` with `forwardRef`, `ErrorState` (shows error code and request ID), `DataTable` (row click, `aria-sort`, skeleton rows), `Pagination`, `FilterBar`.
- `components/status/statusMaps.ts` (new), `components/status/index.tsx` — mapping-driven `StatusPill`, plus the existing `StatusBadge`, `BandChip`, `SeverityChip`, `StateChip`, `PlaceholderTag`, and new `ApplicationStatusBadge`, `DocumentStatusBadge`, `CheckRunBadge`, `AlertStatusBadge`, `SyntheticTag`.
- `components/layout/AppLayout.tsx`, `PublicLayout.tsx` (new), `navigation.ts` (new), `HelpDialog.tsx` (new).
- Case and evidence: `EvidenceViewer`, `BBoxOverlay` (math unchanged; adds `isDrawableBBox`), `EvidenceCompare`, `FindingList`, `FindingDetail`, `RiskScorePanel`, `ForensicsPanel`, `TrianglePanel`.
- Data: `ChecklistPanel`, `ClaimTable`, `LedgerPanel`, `ValidityTimeline`, `LetterPreview` (new).
- `DemoControlsDrawer`.

## 4. Fabricated or misleading content removed

- The Prime Minister's quote and photo; the "Satyameva Jayate" motto in the logo (`logo2.png`). The OneCheck mark `onecheck-logo.png` is now used.
- "© OneCheck — Government of India. All rights reserved" and "AICTE Regulatory Verification Division". Replaced with "Independent SIH project — not affiliated with or endorsed by AICTE or the Government of India".
- An invented helpline (1800-11-2026 / 011-29581000) and `support-regulatory@onecheck.gov.in`; "Standard GFR Rule 194 Conformance" labels; "194+ handbook rules / 0% guesswork / 100% traceability" metrics; dead `#terms` / `#privacy` footer links.
- **Evidence viewer fallback** that rendered a fake "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION" page with "Cryptographic Hash: 8f9b…a102 · Verified Source Seal Active".
- A hardcoded "Survey #48/2A • 640 sq m" land record in the comparison view.
- "Checks passed (14)" with invented passed checks, and invented document signals, in the findings list. Passed checks now come only from the server's `application.lastTrace`.
- A forensics hardcoded perimeter "28.6280, 77.3649", "Conforms to Norm" on every room, "Authentic Campus Image", a frontend-computed area deficit, and an "HSM salt" claim.
- Officer dashboard defaults `oldestUnresolvedDays: 4` / `avgTimePerStageDays: 1.8` and the "SLA 3.0 days" card. **Note: the backend itself returns these two numbers as constants**, so the UI no longer displays them.
- A fake 65 % extraction progress, fake Workspace history, the "All Automated Norms Satisfied" message shown when no checks had run, and success messages shown before the server confirmed anything (letter "dispatched", run "completed", ledger confirmation that did nothing).
- Unused public assets deleted: `modi_ji.png`, `logo2.png`, `bg*.png`, `landing-bg.jpg`, `birds*.png`, `test_birds_comparison.png`.

## 5. Existing features preserved

Routes and paths (plus the new `/admin` overview), the RequireRole guard and the 403 screen test IDs, the permission utilities (`auth/permissions.ts` unchanged), the JWT flow and session storage keys, the dev bypass login (DEV only), SSE with polling fallback, 401 / 409 interceptor behaviour, the mock mode and all fixtures, query keys, claim edit/confirm, finding dispositions (including the 10-character dismissal rule), the adverse-action client guard, the validity decision-date demo, the audit tamper demo (ADMIN only), benchmark JSON download, and all original tests unchanged.

## 6. API integration — what changed (frontend-only adapters)

All requests still go through the existing `api/client.ts` (same base URL, Bearer header, `X-Request-Id`).

- **`_id` → `id` alias**: the backend returns Mongo `_id` everywhere and the UI keyed on `.id`. A non-destructive response adapter (`addIdAliases`) adds `id`; nothing is renamed or removed.
- **Shape adapters** (`api/adapters.ts`) accept both backend and mock shapes: applications (populated `institution`, `summary.*`, `riskLevel`), the application detail wrapper `{application, documents, alerts, latestRun}`, `disposition.state` on findings, alerts `status` vs `acknowledged`, letters `body` (server HTML), audit verify `verified/brokenSeq`, benchmark `scores` (fractions and ms), forensics (two shapes), triangle (no `nodes`), and pagination from `meta.pagination` or top-level `pagination`.
- **Contract fixes** (the old code called endpoints that didn't match the backend):

| Area | Before | Now |
|---|---|---|
| Claim confirm | `PATCH /claims/:id/confirm` | `POST` (the backend route) |
| Queue filter | `band` | `riskLevel` (`band` still sent for mocks), plus pagination and sort |
| Demo clock | sent `decisionDateOffsetDays` only | also sends `clockOffsetDays`, which the backend reads |
| Decision outcomes | `APPROVED` / `REJECTED` (not accepted by the backend) | `decision.service` values; APPROVE/REJECT only for Regional Director |
| Refer for inspection | `alert()` | records `REFER_FOR_INSPECTION` |
| Run checks | showed "completed" after a 202 response | polls `GET /applications/:id/runs/:runId` |
| Ledger manual confirm | did nothing | `POST /ledger/:id/manual-confirm {confirmed, note}` (note ≥ 10 characters) |
| Letters | client-composed text "dispatched" | draft via `POST …/letters {findingIds}`, then `POST /letters/:id/send` |
| Create application | navigated to `/portal/applications/undefined` | reads `data.application._id` |
| Validity timeline | PUT demo settings on mount | only on explicit Apply |
| Admin, institutions, health | not wired | wired to their real endpoints |

- **Documents** in the case viewer are fetched with the auth header from `GET /documents/:id/file` and rendered as PDF or image. The bundled mock PDFs are used **only in mock mode**.
- **PDF.js worker**: react-pdf 9.2.1 needs pdfjs 4.8.69 (nested copy per the lockfile) but the worker was loaded from the root pdfjs 4.10.38, which caused a version-mismatch error (this triggered the fake fallback page). The worker now loads from react-pdf's own copy.
- **Errors**: `api/errors.ts` maps 400/401/403/404/409/413/415/429/5xx and network/timeout errors to plain messages with the code and request ID. The global toast no longer duplicates 400/404 errors that screens already show inline.

## 7. Authentication and authorisation

Unchanged model: JWT from `POST /auth/login`; role from the response; guards via `RequireRole`. Two frontend fixes:

1. Route role lists now include the backend's equivalent roles: `OFFICER` with officer routes, `INSTITUTION_USER` with institution routes. **The seeded accounts (`officer@onecheck.gov.in` has role `OFFICER`, `director@apex-tech.edu.in` has role `INSTITUTION_USER`) previously got 403 on their own pages.** The role lists live in `auth/routeAccess.ts` and are shared by the guard and the navigation.
2. Post-login landing: ADMIN → `/admin` (new overview). Other roles are unchanged (unknown roles still go to `/portal`).

Hidden controls are a convenience only; the guards and the server enforce access.

## 8. Dependencies

**No dependencies added or changed.** `package.json` and `package-lock.json` are untouched. A tiny local Zod resolver (`lib/zodResolver.ts`) avoids adding `@hookform/resolvers`.

## 9. Tests

- Existing (unchanged): `securityRbac`, `requireRole`, `claimTable`, `statusBadge`, `bboxMath`, `bannedWords`.
- New:
  - `statusMaps.test.ts` — only VERIFIED is success; unavailable and pending are never success; unknown values are neutral; lifecycle, check-run and document concepts are separate.
  - `adapters.test.ts` — backend-shaped fixtures for every adapter, risk-placeholder detection, forensics shapes, pagination, error mapping.
  - `routeAccess.test.ts` — role aliases, no admin links for other roles, nav derived from guard roles, drawable bboxes.
  - `bannedWordsSource.test.ts` — the honest-language rule extended to the UI source and mocks.
- Result: **10 files, 66 tests, all passing.**

## 10. Known issues and limitations

1. `vite build` not executed here (see §0). Verify locally.
2. No live-backend run; see the checklist in §12.
3. **The pdfjs worker path depends on the lockfile layout** (`node_modules/react-pdf/node_modules/pdfjs-dist`). Recommended follow-up: pin `"pdfjs-dist": "4.8.69"` in `apps/web/package.json` and reinstall, then point the worker back at `pdfjs-dist/build/pdf.worker.min.mjs`.
4. A 409 from admin "create user" (duplicate email) also opens the global "record changed — reload?" dialog (existing interceptor behaviour). The inline error is shown as well.
5. The backend has no search parameter on `/applications`, so the officer queue's text box filters only the loaded page and says so.
6. The mock PDFs (`public/mock-docs/D1–D3.pdf`) contain project text, not real certificates; overlay positions in mock mode are illustrative.
7. `docs/DECISIONS.md` (earlier team document) still describes the previous design and contains claims removed from the UI; treat it as historical.
8. The 409 dialog, toasts and help are English-only. The old Hindi toggle did nothing and was removed.

## 11. Backend limitations found (would need backend changes — not done)

- `GET /dashboard/officer` returns hardcoded `oldestUnresolvedDays: 4` and `avgTimePerStageDays: 1.8`.
- `GET /applications/:id/risk-score` returns a placeholder 100 / GREEN when no score exists. The UI detects this and shows "not computed".
- `GET /applications/:id/forensics` returns ELA scores hardcoded to 0.85 / 0.05 and a fixed region from a boolean flag, not real ELA output.
- `GET /applications/:id/triangle` returns no claim/document/record nodes.
- There are no endpoints for self-registration or password reset, and admins cannot reset passwords (`PATCH /admin/users` accepts only `role` and `isActive`).
- Benchmark scores are fixed fixture values when `MOCK_VERIFICATION_SERVICE=true`.
- Several routes authorise with `authorize('OFFICER','ADMIN')`; `REGIONAL_DIRECTOR` passes via equivalence, `AUDITOR` does not.
- `env.js` defaults `PORT` to 4000, while `.env.example` and the Vite proxy use 3000. Make sure the backend `.env` sets `PORT=3000`.
- The `applicationDecisionSchema` (Zod) is not applied on the decision route, so the server does not enforce a minimum reason length; the UI does.

## 12. Run locally

```bash
# from the repository root (Node 18+; tested with Node 22)
npm ci                      # installs workspace deps from package-lock.json
npm run dev                 # Vite on http://localhost:5173 (proxies /api → http://localhost:3000)
npm test                    # vitest
npm run build               # tsc -b && vite build
```

Environment (`apps/web/.env` — copy from `.env.example`; placeholders only):

```
VITE_API_BASE=/api          # API base URL (proxied to the backend in dev)
VITE_USE_MOCKS=false        # true = serve all API calls from local MSW fixtures (a "Mock mode" strip is shown)
```

Live-backend checklist (backend: `npm run seed:dev`, `PORT=3000`; seeded credentials are in the backend README):

1. Sign in with each seeded account → lands on `/portal`, `/review`, `/admin`, `/audit`.
2. Institution: create an application → upload a PDF per checklist item → submit (expect the server's deficiency list until all are stored).
3. Officer: open the case → the PDF renders through `/documents/:id/file`, findings select and boxes are drawn → disposition → Run checks (status polls) → letters draft and send → record a decision.
4. Admin: create a user, change a role, register and activate a rulepack, edit a checklist, verify the audit chain.

## 13. Regression report

| Area | Status | Basis |
|---|---|---|
| Authentication | Verified (mock) / partially verified (real) | Flows in mock mode; login code path unchanged |
| Role-based navigation | Verified | Unit tests + browser per role |
| Protected routes | Verified | `requireRole` tests + redirect and 403 flows |
| Application creation | Verified (mock) | Flow test; payload matches the backend validator |
| Application listing | Verified (mock) | Browser + adapter tests on backend shape |
| Document uploads | Partially verified | Mock upload + client validation; real multipart unchanged except progress callback |
| Case inspection | Verified (mock) | Browser at all widths; real PDF render via worker fix |
| Verification findings | Verified (mock) | Disposition flows |
| Risk information | Verified (mock) / adapter-tested | Placeholder detection test |
| Alerts | Verified (mock) | Update flow |
| Letters and decisions | Verified (mock) | Draft → send; decision with preset |
| Audit | Verified (mock) | List + verify; adapter test for backend keys |
| Administration | Verified (mock) | Users, rulepacks, checklists flows |
| Benchmark dashboard | Verified (mock) | Run flow + adapter test for backend scores |
| API connectivity (real backend) | **Not verified** | No backend runtime available here |

## 14. Most important files changed

`src/api/{adapters.ts (new), errors.ts (new), queries.ts, client.ts}` · `src/auth/{routeAccess.ts (new), RequireRole.tsx, AuthProvider.tsx (routeByRole only)}` · `src/routes.tsx` · `src/components/{ui, status, layout, evidence, case, data, demo}/*` · all pages under `src/pages/*` · `src/mocks/handlers.ts` (backend-mirroring handlers added) · `src/styles/tokens.css`, `tailwind.config.js`, `index.html` · `src/config.ts`, `src/lib/{format.ts, zodResolver.ts}` (new) · tests under `src/tests/unit/`.

## 15. Where to resume

1. Run `npm run build` and the §12 live-backend checklist; fix any shape surprises in `api/adapters.ts`, the single place where backend shapes are mapped.
2. Pin `pdfjs-dist@4.8.69` (see §10.3).
3. Backend follow-ups listed in §11, if the backend team agrees.

# OneCheck Frontend — Technical Decisions & Inspection Report

> **Historical document.** This describes the earlier design. Several claims below (for example "GFR Rule 194 conformance", official contact details, government branding) were removed from the UI in the institutional redesign. See `HANDOFF.md` at the repository root for the current state.

## Milestone 1: Official Portal Reference Audit & Inspection

### 1.1 Reference Websites Inspected
1. **AICTE National Internship Portal (`https://internship.aicte-india.org/`)**:
   - **Top Government Belt**: 3px tricolor progress stripe at the very top (`#FF671F`, `#FFFFFF`, `#046A38`), followed by a bilingual government identity banner (`भारत सरकार · Government of India · Ministry of Education`), an "Important Note / Advisory" pill, and a Helpline & Support widget.
   - **Branding & Identity**: Clean institutional logo area, subtle vertical divider, bilingual organization text, and clean navigation links with rounded pill badges.
   - **Color Palette**: Off-white/cream neutral surfaces (`#FFFCF6`, `#F8FAFC`, `#FFFFFF`), deep navy institutional headers (`#0B2545`, `#005EA2`), slate borders (`#CBD5E1`, `#E2E8F0`), high-contrast dark text (`#0F172A`), saffron (`#FF671F`) and emerald (`#046A38`) accents.
   - **Information Density**: High density without clutter. Structured tables with explicit status badges, quick filters, and clear visual hierarchy.

2. **AICTE Portal Login Interface (`https://internship.aicte-india.org/login_new.php`)**:
   - **Role-Based Tab Switcher**: Segmented tabs across distinct user categories (Institute, Officer, Admin, Auditor) allowing explicit role context before credentials entry.
   - **Clear Field Semantics**: Explicit labels, password toggle, CAPTCHA / verification indicator, forgotten-password flow, and demo fast-fill for evaluation.

3. **AICTE Search & Browsing Interface (`https://internship.aicte-india.org/internships`)**:
   - **Filter Belt**: Quick search input, category dropdowns, status filters, active-filter tags with one-click clear, result count summary, and pagination.

4. **Primary Reference (`https://www.aicte-india.org/`)**:
   - Primary domain returned HTTP EOF during automated agent fetch; as instructed by the specification, verified accessible official sub-portals (`internship.aicte-india.org`) were directly inspected without fabricating inaccessible content.

---

### 1.2 Official Reference Matrix

| Official AICTE Portal Pattern | OneCheck Application Component | Implementation Strategy |
| :--- | :--- | :--- |
| **Top Government & Helpline Belt** | `GovtTopBar` & `AppHeader` | Bilingual national identity banner, tricolor accent stripe, helpline/support modal, and active zero-trust audit indicator. |
| **Institutional Identity Area** | `AppHeader` Logo & Title | Product branding as "OneCheck — AICTE Regulatory Compliance & Verification Platform" without falsely claiming official endorsement. |
| **Role-Specific Authentication** | `LoginPage` Role Switcher | Segmented role tabs (Institute, Scrutiny Officer, System Admin, Auditor) with demo quick-fill presets and high-contrast inputs. |
| **Portal Forms & Validation** | `NewApplication`, `Letters`, `AdminManage` | Structured multi-step forms, explicit labels, required asterisks, helper text, and Zod/React Hook Form error validation. |
| **Search & Filtering Belts** | `OfficerQueuePage`, `InstitutionApplicationsPage` | Debounced text search, status dropdowns, active filter chips, "Clear All" action, and total count indicator. |
| **Structured Data Tables** | `DataTable`, `ClaimTable`, `LedgerPanel` | Compact high-contrast tables with sortable headers, sticky table heads, confidence bars, and row-level action toolbars. |
| **Document Presentation** | `EvidenceViewer`, `EvidenceCompare` | Split-pane case packet with React PDF canvas, zoom controls, page navigation, and normalized coordinate bounding-box overlays. |
| **Status & Severity Indicators** | `StatusBadge`, `SeverityChip`, `BandChip` | High-contrast badges with explicit icons and text (never color alone) adhering to frozen 8-status enum. |
| **Official Guidance & Hierarchy** | `LandingPage`, Help Footers, Tooltips | Structured Indian public infrastructure layout (DPI commitment, statutory advisory disclaimers, clear role guidance). |

---

### 1.3 Route Inventory & Coverage

| Route | Role Permissions | Purpose & Specification Section | Status |
| :--- | :--- | :--- | :--- |
| `/` | Public | Landing page with Hero, Vision, Core Features, Metric Highlights, and DPI Commitment (Sec 3.4). | Verified & Live |
| `/login` | Public | Role-based authentication with demo quick-fill credentials (Sec 3.4). | Verified & Live |
| `/signup` | Public | Institutional registration flow with field validation (Sec 3.4). | Verified & Live |
| `/forgot-password` | Public | Password recovery workflow with email verification (Sec 3.4). | Verified & Live |
| `/portal` | `INSTITUTION` | Institution dashboard & applications list with search and status badges (Sec 3.5). | Verified & Live |
| `/portal/new` | `INSTITUTION` | Multi-step regulatory application submission form (Sec 3.5). | Verified & Live |
| `/portal/applications/:id` | `INSTITUTION` | 5-tab workspace: Overview, Documents, Claims, Discrepancies, Timeline (Sec 3.5). | Verified & Live |
| `/review` | `SCRUTINY_OFFICER`, `REGIONAL_DIRECTOR` | Regulatory officer review queue with sorting, filtering, and risk indicators (Sec 3.6). | Verified & Live |
| `/review/:id` | `SCRUTINY_OFFICER`, `REGIONAL_DIRECTOR` | 3-pane Case Packet: Findings, Document Viewer with BBoxes, Cross-Source Ledger (Sec 3.7). | Verified & Live |
| `/review/:id/letters` | `SCRUTINY_OFFICER`, `REGIONAL_DIRECTOR` | Deficiency and clarification letter drafting workflow (Sec 3.8). | Verified & Live |
| `/admin/rulepacks` | `ADMIN` | Rulepack configuration and YAML inspection (Sec 3.9). | Verified & Live |
| `/admin/checklists` | `ADMIN` | Document checklist definitions and requirements CRUD (Sec 3.9). | Verified & Live |
| `/admin/users` | `ADMIN` | Role-based user access management table (Sec 3.9). | Verified & Live |
| `/audit` | `AUDITOR`, `ADMIN` | Cryptographic SHA-256 hash chain verification and tampering audit (Sec 3.10). | Verified & Live |
| `/benchmark` | `ADMIN`, `SCRUTINY_OFFICER`, `REGIONAL_DIRECTOR` | Synthetic benchmark suite runner with recall metrics and JSON report (Sec 3.11). | Verified & Live |

---

### 1.4 Design Tokens Proposal (Refined Government Palette)

```css
:root {
  /* Institutional Brand Palette */
  --gov-navy-900: #0B2545;       /* Deep header & institutional brand */
  --gov-navy-800: #133E6E;       /* Primary navigation & active states */
  --gov-blue-600: #005EA2;       /* Primary interactive buttons & links */
  --gov-blue-700: #0B4778;       /* Primary hover */
  --gov-blue-50:  #EDF4F9;       /* Light blue selection surfaces */

  /* National Tricolor Accents */
  --gov-saffron:  #FF671F;       /* Saffron accent & top stripe */
  --gov-green:    #046A38;       /* Green accent & success indications */
  --gov-white:    #FFFFFF;       /* Pure white content card */

  /* Neutrals & Surfaces */
  --gov-surface:  #F8FAFC;       /* App background surface */
  --gov-surface-card: #FFFFFF;  /* Table & card background */
  --gov-border:   #CBD5E1;       /* Standard high-contrast border */
  --gov-border-subtle: #E2E8F0; /* Internal divider */
  --gov-text-main: #0F172A;     /* Primary readable text (contrast > 7:1) */
  --gov-text-muted: #475569;    /* Secondary supportive text */
  --gov-text-faint: #64748B;    /* Metadata & timestamps */

  /* Status Tokens (Adheres strictly to frozen 8-status enum) */
  --status-verified: #046A38;
  --status-mismatch: #B91C1C;
  --status-expired: #C2410C;
  --status-pending: #1D4ED8;
  --status-source-unavail: #B45309;
  --status-manual-review: #6D28D9;
  --status-not-checked: #475569;
  --status-blocked: #991B1B;
}
```

---

### 1.5 Gap Analysis & Technical Constraints

1. **Banned Words Compliance**:
   - Words "fraud", "forged", and "fake" are strictly forbidden across UI labels, status text, tooltips, and mock records.
   - Enforced terms: "possible anomaly", "needs verification", "mismatch detected".

2. **Zero Client-Side Calculation**:
   - Verification status, risk scores, formula computations, and band classifications are strictly received from API responses or MSW fixtures.
   - Bounding boxes are rendered via proportional percentage coordinates (`left: x0*100%`, `top: y0*100%`, `width: (x1-x0)*100%`, `height: (y1-y0)*100%`) ensuring stability during zoom operations.

3. **Statutory Case Disclaimer**:
   - Mandatory notice rendered on all case reviews: *"Automated findings are advisory and are for review by authorized officials."*


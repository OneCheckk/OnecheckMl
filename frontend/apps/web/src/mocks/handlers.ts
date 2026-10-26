import { http, HttpResponse, delay } from 'msw';
import {
  faultedApplication,
  faultedFindings,
  faultedClaims,
  faultedChecklist,
  faultedLedger,
  faultedValidity,
} from './fixtures/faultedApplication';
import {
  cleanApplication,
  cleanFindings,
  cleanClaims,
  cleanChecklist,
  cleanLedger,
  cleanValidity,
} from './fixtures/cleanApplication';
import type {
  Finding,
  Claim,
  ChecklistItem,
  AuditEvent,
  BenchmarkRun,
  Alert,
  Institution,
  TriangleFinding,
  ForensicsSuiteData,
  RiskScoreBreakdown,
  CheckRun,
} from '@contracts';
import {
  archiveInstitutions,
  archiveApplications,
  archiveTriangleFindings,
  archiveForensicsData,
  archiveRiskScore,
  archiveAlerts,
} from './fixtures/archiveData';

// In-memory mutable states for MSW session
let applications = [faultedApplication, cleanApplication, ...archiveApplications];
let findingsMap: Record<string, Finding[]> = {
  [faultedApplication.id]: [...faultedFindings],
  [cleanApplication.id]: [...cleanFindings],
  'app-101': [...faultedFindings],
};
let claimsMap: Record<string, Claim[]> = {
  [faultedApplication.id]: [...faultedClaims],
  [cleanApplication.id]: [...cleanClaims],
};
let checklistMap: Record<string, ChecklistItem[]> = {
  [faultedApplication.id]: [...faultedChecklist],
  [cleanApplication.id]: [...cleanChecklist],
};
let ledgerMap = {
  [faultedApplication.id]: [...faultedLedger],
  [cleanApplication.id]: [...cleanLedger],
};
let lettersMap: Record<string, any[]> = {
  [faultedApplication.id]: [
    {
      id: 'let-01',
      applicationId: faultedApplication.id,
      findingIds: ['F-017', 'F-035'],
      content:
        'Sub: Formal Clarification Request regarding AICTE Application AICTE-2026-NRO-8921.\n\nPlease furnish the clarified sanctioned architectural drawing demonstrating laboratory space conformity as per Clause 4.2. Additionally, submit authenticated banking settlement advice for TER deposit challan UTR 9831128827 within 7 calendar days.',
      status: 'SENT',
      createdAt: '2026-10-24T09:40:00Z',
      sentAt: '2026-10-24T09:45:00Z',
      recipient: 'registrar@apex-institute.ac.in',
    },
  ],
};

let auditEvents: AuditEvent[] = [
  {
    seq: 1,
    ts: '2026-10-24T07:15:00Z',
    actor: { id: 'usr-inst-1', name: 'Dr. R. K. Sharma', role: 'INSTITUTION' },
    action: 'DOC_UPLOADED',
    entity: { type: 'DOCUMENT', id: 'D1' },
    payload: { filename: 'Affidavit_SelfDisclosure_2026.pdf', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
  },
  {
    seq: 2,
    ts: '2026-10-24T08:00:00Z',
    actor: { id: 'usr-inst-1', name: 'Dr. R. K. Sharma', role: 'INSTITUTION' },
    action: 'APPLICATION_SUBMITTED',
    entity: { type: 'APPLICATION', id: faultedApplication.id },
    payload: { applicationNumber: faultedApplication.applicationNumber },
    prevHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    hash: 'b2c3d4e5f6a17890123456789abcdef0123456789abcdef0123456789abcdef1',
  },
  {
    seq: 3,
    ts: '2026-10-24T09:30:00Z',
    actor: { id: 'sys-pipeline', name: 'OneCheck Automated Pipeline', role: 'SYSTEM' },
    action: 'RULES_EVALUATED',
    entity: { type: 'FINDINGS', id: faultedApplication.id },
    payload: { findingsGenerated: 6, riskBandAssigned: 'RED' },
    prevHash: 'b2c3d4e5f6a17890123456789abcdef0123456789abcdef0123456789abcdef1',
    hash: 'c3d4e5f6a1b27890123456789abcdef0123456789abcdef0123456789abcdef2',
  },
];

let alerts: Alert[] = [
  {
    id: 'alt-1',
    type: 'DOC_EXPIRING',
    severity: 'MEDIUM',
    message: 'State Fire Department NOC lapses within 22 days of academic period commencement.',
    applicationId: faultedApplication.id,
    raisedAt: '2026-10-24T08:05:00Z',
    acknowledged: false,
  },
  {
    id: 'alt-2',
    type: 'FORENSIC_SIGNAL',
    severity: 'HIGH',
    message: 'Post-generation xref modifications and dual producers detected on Building Plan document.',
    applicationId: faultedApplication.id,
    raisedAt: '2026-10-24T08:06:00Z',
    acknowledged: false,
  },
  ...archiveAlerts,
];

let benchmarkRuns: BenchmarkRun[] = [
  {
    runId: 'bench-2026-run-001',
    timestamp: '2026-10-24T06:00:00Z',
    n: 100,
    seed: 42,
    faultRate: 0.35,
    scanRatio: 0.4,
    manifestHash: 'sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'COMPLETED',
    results: {
      extractionAccuracy: 99.4,
      validationAccuracy: 99.1,
      cleanAppFalsePositiveRate: 0.0,
      avgVerificationTimeSec: 1.2,
      scanVsTextAccuracy: { scan: 98.7, text: 99.8 },
      alertTimelinessMin: 4.8,
      perFault: [
        { faultType: 'AREA_MISMATCH', precision: 1.0, recall: 0.98, f1: 0.99, tp: 34, fp: 0, fn: 1 },
        { faultType: 'FACULTY_INTAKE', precision: 0.97, recall: 1.0, f1: 0.98, tp: 28, fp: 1, fn: 0 },
        { faultType: 'TER_PAYMENT', precision: 1.0, recall: 1.0, f1: 1.0, tp: 22, fp: 0, fn: 0 },
        { faultType: 'NOC_VALIDITY', precision: 1.0, recall: 0.96, f1: 0.98, tp: 25, fp: 0, fn: 1 },
        { faultType: 'DOC_FORENSICS', precision: 0.95, recall: 0.92, f1: 0.93, tp: 19, fp: 1, fn: 2 },
      ],
    },
  },
];

let demoSettings = {
  enabled: true,
  decisionDateOffsetDays: 0,
  forceSourceUnavailable: false,
};

let auditTampered = false;

// Demonstration stores for admin endpoints (mock mode only)
let mockUsers: any[] = [
  { id: 'usr-inst-1', name: 'Dr. R. K. Sharma', email: 'director@apex-tech.edu.in', role: 'INSTITUTION_USER', institutionId: 'inst-001', isActive: true, createdAt: '2026-09-01T10:00:00Z', lastLoginAt: '2026-10-24T07:10:00Z' },
  { id: 'usr-off-1', name: 'Shri V. S. Rao', email: 'officer@onecheck.gov.in', role: 'OFFICER', institutionId: null, isActive: true, createdAt: '2026-09-01T10:00:00Z', lastLoginAt: '2026-10-24T08:30:00Z' },
  { id: 'usr-dir-1', name: 'Dr. S. Deshmukh', email: 'director.regional@onecheck.gov.in', role: 'REGIONAL_DIRECTOR', institutionId: null, isActive: true, createdAt: '2026-09-01T10:00:00Z', lastLoginAt: null },
  { id: 'usr-adm-1', name: 'System Administrator', email: 'admin@onecheck.gov.in', role: 'ADMIN', institutionId: null, isActive: true, createdAt: '2026-09-01T10:00:00Z', lastLoginAt: '2026-10-25T05:00:00Z' },
  { id: 'usr-aud-1', name: 'Compliance Auditor', email: 'auditor@onecheck.gov.in', role: 'AUDITOR', institutionId: null, isActive: true, createdAt: '2026-09-01T10:00:00Z', lastLoginAt: null },
];

let mockChecklists: any[] = [
  {
    id: 'chk-eoa-intake',
    category: 'EOA_INTAKE_INCREASE',
    version: '2026.1',
    active: true,
    updatedAt: '2026-09-15T09:00:00Z',
    items: [
      { id: 'self-disclosure', label: 'Self-disclosure form', docTypes: ['SELF_DISCLOSURE_FORM'], required: true, clauseRef: 'HANDBOOK-REF-TBD', placeholder: true },
      { id: 'building-plan', label: 'Sanctioned building plan', docTypes: ['BUILDING_PLAN'], required: true, clauseRef: 'HANDBOOK-REF-TBD', placeholder: true },
      { id: 'fire-noc', label: 'Fire safety NOC', docTypes: ['FIRE_NOC'], required: true, clauseRef: 'HANDBOOK-REF-TBD', placeholder: true },
      { id: 'faculty-list', label: 'Faculty list', docTypes: ['FACULTY_LIST'], required: true, clauseRef: 'HANDBOOK-REF-TBD', placeholder: true },
    ],
  },
];

let mockRulepacks: any[] = [
  { id: 'rp-1', version: '2026.1-demo', yamlText: '# Demonstration rulepack (mock layer)\nversion: 2026.1-demo\nrules:\n  - id: AREA-CONSIST-001\n    tolerance_pct: 2\n', sha256: 'mock0000000000000000000000000000000000000000000000000000000000', active: true, notes: 'Mock-mode demonstration rulepack', createdAt: '2026-09-15T09:00:00Z' },
];

// Helper to register both relative '/api/...' and wildcard '*/api/...' paths with explicit any signature
function route(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  resolver: (info: any) => any
) {
  const normPath = path.startsWith('/') ? path : `/${path}`;
  const apiPath = normPath.startsWith('/api/') ? normPath : `/api${normPath}`;
  return [
    http[method](apiPath, resolver as any),
    http[method](`*${apiPath}`, resolver as any),
  ];
}

export const handlers = [
  // --- Auth Handlers ---
  ...route('post', '/api/auth/login', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const email = body.email || '';

    let role = 'INSTITUTION';
    let name = 'Institutional Officer';
    if (email.includes('officer')) {
      role = 'SCRUTINY_OFFICER';
      name = 'Shri V. S. Rao (Scrutiny Officer)';
    } else if (email.includes('regional') || email.startsWith('director@aicte')) {
      // Note: the seeded institution account is director@apex-tech.edu.in, so a bare
      // "director" match would wrongly assign the Regional Director role.
      role = 'REGIONAL_DIRECTOR';
      name = 'Dr. Sunita Deshmukh (Regional Director)';
    } else if (email.includes('admin')) {
      role = 'ADMIN';
      name = 'AICTE Central System Admin';
    } else if (email.includes('auditor')) {
      role = 'AUDITOR';
      name = 'Statutory Compliance Auditor';
    }

    return HttpResponse.json({
      success: true,
      data: {
        token: `mock-jwt-token-for-${role}`,
        user: {
          id: `usr-${role.toLowerCase()}`,
          name,
          email,
          role,
        },
      },
    });
  }),

  // --- Dashboard Officer ---
  ...route('get', '/api/dashboard/officer', () => {
    return HttpResponse.json({
      success: true,
      data: {
        bandCounts: {
          RED: applications.filter((a) => a.band === 'RED').length,
          YELLOW: applications.filter((a) => a.band === 'YELLOW').length,
          GREEN: applications.filter((a) => a.band === 'GREEN').length,
        },
        pendingSourceVerifications: 1,
        oldestUnresolvedDays: 4,
        avgTimePerStageDays: 1.8,
      },
    });
  }),

  // --- Applications ---
  ...route('get', '/api/applications', ({ request }) => {
    // Mirrors backend query params: status, riskLevel (band kept for older callers), page, limit, sortBy, sortOrder
    const url = new URL(request.url);
    const band = url.searchParams.get('riskLevel') || url.searchParams.get('band');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    let result = [...applications];
    if (band && band !== 'ALL') result = result.filter((a) => a.band === band);
    if (status) result = result.filter((a) => a.status === status);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) => a.applicationNumber.toLowerCase().includes(q) || a.institutionName.toLowerCase().includes(q)
      );
    }
    const key = (a: any) =>
      sortBy === 'applicationNumber' ? a.applicationNumber : sortBy === 'riskScore' ? (a.riskScore ?? 999) : (a.submittedAt || a.updatedAt || '');
    result.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * sortOrder);

    const totalItems = result.length;
    const items = result.slice((page - 1) * limit, page * limit);
    return HttpResponse.json({
      success: true,
      data: items,
      meta: {
        requestId: 'req-' + Date.now(),
        pagination: { page, limit, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / limit)) },
      },
    });
  }),

  ...route('post', '/api/applications', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const newApp = {
      id: `app-new-${Date.now()}`,
      applicationNumber: `AICTE-2026-RO-${Math.floor(1000 + Math.random() * 9000)}`,
      institutionId: 'inst-user-current',
      institutionName: body.institutionName || 'National Institute of Science & Technology',
      category: body.category || 'ENGINEERING_UNDERGRADUATE',
      status: 'DRAFT',
      band: undefined,
      missingItemsCount: 4,
      openFindingsCount: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
      pendingSourcesCount: 0,
      claimsNeedingConfirmationCount: 0,
      updatedAt: new Date().toISOString(),
      sourceLabel: 'DEMO ADAPTER - simulated source',
    };

    applications.unshift(newApp as any);
    checklistMap[newApp.id] = [
      {
        id: 'chk-new-1',
        category: newApp.category,
        label: 'Mandatory Self-Disclosure Affidavit',
        clauseRef: 'APH-2026-APP-1',
        required: true,
        state: 'MISSING',
        docType: 'SELF_DISCLOSURE_FORM',
      },
      {
        id: 'chk-new-2',
        category: newApp.category,
        label: 'Approved Architectural Blueprint CAD Drawing',
        clauseRef: 'APH-2026-INFRA-1',
        required: true,
        state: 'MISSING',
        docType: 'BUILDING_PLAN',
      },
      {
        id: 'chk-new-3',
        category: newApp.category,
        label: 'Sanctioned Faculty Cadre List with Biometric Identification',
        clauseRef: 'APH-2026-FAC-1',
        required: true,
        state: 'MISSING',
        docType: 'FACULTY_LIST',
      },
      {
        id: 'chk-new-4',
        category: newApp.category,
        label: 'State Fire Service Safety NOC',
        clauseRef: 'APH-2026-SAFETY-1',
        required: true,
        state: 'MISSING',
        docType: 'FIRE_NOC',
      },
    ];

    claimsMap[newApp.id] = [
      {
        claimId: `clm-${Date.now()}-1`,
        applicationId: newApp.id,
        docId: 'chk-new-1',
        predicate: 'carpet_area_sqm',
        predicateLabel: 'Total Carpet Area (sq.m)',
        value: 12500,
        unit: 'sqm',
        confidence: 0.95,
        status: 'VERIFICATION_PENDING',
        source: {
          docId: 'chk-new-1',
          page: 1,
          bbox: [0.1, 0.1, 0.9, 0.2],
          snippet: 'Declared Carpet Area: 12500 sqm',
          docType: 'SELF_DISCLOSURE_FORM',
        },
        needsConfirmation: false,
      },
      {
        claimId: `clm-${Date.now()}-2`,
        applicationId: newApp.id,
        docId: 'chk-new-3',
        predicate: 'student_faculty_ratio',
        predicateLabel: 'Student-to-Faculty Ratio',
        value: '1:20',
        confidence: 0.92,
        status: 'VERIFICATION_PENDING',
        source: {
          docId: 'chk-new-3',
          page: 1,
          bbox: [0.1, 0.3, 0.9, 0.4],
          snippet: 'Cadre ratio: 1:20',
          docType: 'FACULTY_LIST',
        },
        needsConfirmation: false,
      },
    ];

    findingsMap[newApp.id] = [];

    return HttpResponse.json({ success: true, data: newApp });
  }),

  ...route('get', '/api/applications/:id', ({ params }) => {
    const { id } = params;
    const app = applications.find((a) => a.id === id);
    if (!app) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } },
        { status: 404 }
      );
    }
    return HttpResponse.json({ success: true, data: app });
  }),

  // --- Documents & Checklists ---
  ...route('get', '/api/applications/:id/documents', ({ params }) => {
    const { id } = params as { id: string };
    const items = checklistMap[id] || checklistMap[faultedApplication.id] || [];
    return HttpResponse.json({ success: true, data: items });
  }),

  ...route('post', '/api/documents/upload', async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      data: {
        docId: `D-${Date.now()}`,
        status: 'UPLOADED',
        detectedDocType: 'SELF_DISCLOSURE_FORM',
      },
    });
  }),

  // --- Claims ---
  ...route('get', '/api/applications/:id/claims', ({ params }) => {
    const { id } = params as { id: string };
    const claims = claimsMap[id] || claimsMap[faultedApplication.id] || [];
    return HttpResponse.json({ success: true, data: claims });
  }),

  ...route('patch', '/api/claims/:claimId', async ({ params, request }) => {
    const { claimId } = params as { claimId: string };
    const body = (await request.json().catch(() => ({}))) as any;
    const { value, reason } = body;

    if (!reason || reason.trim().length < 5) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'A mandatory reason is required for editing claimed data.' },
        },
        { status: 400 }
      );
    }

    // Update in-memory claim across all lists
    Object.values(claimsMap).forEach((list) => {
      const target = list.find((c) => c.claimId === claimId);
      if (target) {
        target.originalValue = target.originalValue || target.value;
        target.value = value;
        target.correctionReason = reason;
        target.status = 'VERIFIED';
        target.needsConfirmation = false;
      }
    });

    return HttpResponse.json({
      success: true,
      data: {
        claimId,
        newStatus: 'VERIFIED',
        recheckFindings: [],
        timestamp: new Date().toISOString(),
      },
    });
  }),

  ...route('post', '/api/claims/:claimId/confirm', ({ params }) => {
    const { claimId } = params as { claimId: string };
    let confirmedClaim: Claim | undefined;
    Object.values(claimsMap).forEach((list) => {
      const target = list.find((c) => c.claimId === claimId);
      if (target) {
        target.needsConfirmation = false;
        target.confirmed = true;
        confirmedClaim = target;
      }
    });
    return HttpResponse.json({ success: true, data: confirmedClaim || { claimId, needsConfirmation: false } });
  }),

  ...route('patch', '/api/claims/:claimId/confirm', ({ params }) => {
    const { claimId } = params as { claimId: string };
    let confirmedClaim: Claim | undefined;
    Object.values(claimsMap).forEach((list) => {
      const target = list.find((c) => c.claimId === claimId);
      if (target) {
        target.needsConfirmation = false;
        target.status = 'VERIFIED';
        confirmedClaim = target;
      }
    });

    return HttpResponse.json({
      success: true,
      data: confirmedClaim || { claimId, needsConfirmation: false },
    });
  }),

  // --- Findings ---
  ...route('get', '/api/applications/:id/findings', ({ params }) => {
    const { id } = params as { id: string };
    const findings = findingsMap[id] || findingsMap[faultedApplication.id] || [];
    return HttpResponse.json({ success: true, data: findings });
  }),

  ...route('post', '/api/findings/:id/disposition', async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json().catch(() => ({}))) as any;
    const { state, reason } = body;

    if (state === 'DISMISSED' && (!reason || reason.trim().length < 10)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dismissing an automated regulatory finding requires a justification of at least 10 characters.',
          },
        },
        { status: 400 }
      );
    }

    let updatedFinding: Finding | undefined;
    Object.values(findingsMap).forEach((list) => {
      const f = list.find((item) => item.findingId === id);
      if (f) {
        f.state = state;
        f.dismissalReason = reason;
        updatedFinding = f;
      }
    });

    return HttpResponse.json({
      success: true,
      data: updatedFinding || { findingId: id, state },
    });
  }),

  // --- Ledger ---
  ...route('get', '/api/applications/:id/ledger', ({ params }) => {
    const { id } = params as { id: string };
    const ledger = (ledgerMap as any)[id] || ledgerMap[faultedApplication.id] || [];
    return HttpResponse.json({ success: true, data: ledger });
  }),

  // --- Validity ---
  ...route('get', '/api/applications/:id/validity', ({ params }) => {
    const { id } = params as { id: string };
    let validity = id === cleanApplication.id ? [...cleanValidity] : [...faultedValidity];

    // If decision date slider offset is active in demo settings, shift remaining days
    if (demoSettings.decisionDateOffsetDays > 0) {
      validity = validity.map((v) => {
        const remaining = v.daysRemaining - demoSettings.decisionDateOffsetDays;
        let state = v.state;
        if (remaining <= 0) {
          state = 'EXPIRED';
        } else if (remaining < 60) {
          state = 'LAPSES_IN_PERIOD';
        }
        return {
          ...v,
          daysRemaining: Math.max(0, remaining),
          state,
        };
      });
    }

    return HttpResponse.json({ success: true, data: validity });
  }),

  // --- Self-Check ---
  ...route('post', '/api/applications/:id/self-check', async ({ params }) => {
    const { id } = params as { id: string };
    await delay(600);
    const findings = findingsMap[id] || findingsMap[faultedApplication.id] || [];
    return HttpResponse.json({
      success: true,
      data: {
        findings,
        timestamp: new Date().toISOString(),
      },
    });
  }),

  // --- Decision ---
  ...route('post', '/api/applications/:id/decision', async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json().catch(() => ({}))) as any;
    const { outcome, reason } = body;

    const app = applications.find((a) => a.id === id);
    if (app) {
      app.status = outcome === 'APPROVE' ? 'APPROVED' : outcome === 'REJECT' ? 'REJECTED' : 'DEFICIENCY_RAISED';
      (app as any).decisionReason = reason;
      (app as any).decidedAt = new Date().toISOString();
    }

    return HttpResponse.json({
      success: true,
      data: app,
    });
  }),

  // --- Deficiency Letters ---
  ...route('get', '/api/applications/:id/letters', ({ params }) => {
    const { id } = params as { id: string };
    const letters = lettersMap[id] || [];
    return HttpResponse.json({ success: true, data: letters });
  }),

  ...route('post', '/api/applications/:id/letters', async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json().catch(() => ({}))) as any;
    const findings = (findingsMap[id] || findingsMap[faultedApplication.id] || []).filter((f) =>
      (body.findingIds || []).includes(f.findingId)
    );
    if (findings.length === 0) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No regulatory findings available to include in deficiency letter.' } },
        { status: 400 }
      );
    }
    const app = applications.find((a) => a.id === id);
    const content =
      `DEMONSTRATION DRAFT — generated by the mock layer\n\n` +
      `Application: ${app?.applicationNumber ?? id}\nInstitution: ${app?.institutionName ?? ''}\n\n` +
      `The following matters require clarification:\n\n` +
      findings.map((f, i) => `${i + 1}. [${f.ruleId}] ${f.title}\n   ${f.message}`).join('\n\n');
    const newLetter = {
      id: `let-${Date.now()}`,
      applicationId: id,
      findingIds: findings.map((f) => f.findingId),
      content,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    };
    if (!lettersMap[id]) lettersMap[id] = [];
    lettersMap[id].unshift(newLetter);
    return HttpResponse.json({ success: true, data: newLetter }, { status: 201 });
  }),

  ...route('post', '/api/letters/:letterId/send', ({ params }) => {
    const { letterId } = params as { letterId: string };
    let sent: any;
    Object.entries(lettersMap).forEach(([appId, list]) => {
      const l = list.find((x) => x.id === letterId);
      if (l) {
        l.status = 'SENT';
        l.sentAt = new Date().toISOString();
        sent = l;
        const app = applications.find((a) => a.id === appId);
        if (app) app.status = 'DEFICIENCY_RAISED';
      }
    });
    if (!sent) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Deficiency letter not found' } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: sent });
  }),

  // --- Cryptographic Audit Chain ---
  ...route('get', '/api/audit', () => {
    return HttpResponse.json({
      success: true,
      data: auditEvents,
      meta: {
        totalItems: auditEvents.length,
      },
    });
  }),

  ...route('get', '/api/audit/verify', () => {
    if (auditTampered) {
      return HttpResponse.json({
        success: true,
        data: {
          intact: false,
          verifiedCount: 1,
          brokenAtSeq: 2,
          reason: 'SHA-256 hash mismatch at event sequence #2: cryptographic parent pointer violated.',
        },
      });
    }

    return HttpResponse.json({
      success: true,
      data: {
        intact: true,
        verifiedCount: auditEvents.length,
      },
    });
  }),

  // --- Benchmark Runs ---
  ...route('get', '/api/benchmark/runs', () => {
    return HttpResponse.json({
      success: true,
      data: benchmarkRuns,
    });
  }),

  ...route('post', '/api/benchmark/run', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const n = Number(body.n) || 100;
    const seed = Number(body.seed) || 42;
    const faultRate = typeof body.faultRate === 'number' ? body.faultRate : 0.35;
    const scanRatio = typeof body.scanRatio === 'number' ? body.scanRatio : 0.4;

    const totalInjectedFaults = Math.round(n * faultRate);

    const newRun: BenchmarkRun = {
      runId: `bench-${Date.now()}`,
      timestamp: new Date().toISOString(),
      n,
      seed,
      faultRate,
      scanRatio,
      manifestHash: `sha256-${Math.random().toString(36).substring(2, 10)}${Date.now()}`,
      status: 'COMPLETED',
      results: {
        extractionAccuracy: +(99.2 + Math.random() * 0.6).toFixed(1),
        validationAccuracy: +(99.0 + Math.random() * 0.8).toFixed(1),
        cleanAppFalsePositiveRate: 0.0,
        avgVerificationTimeSec: +(1.1 + Math.random() * 0.3).toFixed(1),
        scanVsTextAccuracy: { scan: 98.6, text: 99.8 },
        alertTimelinessMin: +(4.2 + Math.random() * 0.9).toFixed(1),
        perFault: [
          {
            faultType: 'AREA_MISMATCH',
            precision: 1.0,
            recall: +(0.97 + Math.random() * 0.03).toFixed(2),
            f1: 0.99,
            tp: Math.max(1, Math.round(totalInjectedFaults * 0.28)),
            fp: 0,
            fn: 1,
          },
          {
            faultType: 'FACULTY_INTAKE',
            precision: 0.98,
            recall: 1.0,
            f1: 0.99,
            tp: Math.max(1, Math.round(totalInjectedFaults * 0.24)),
            fp: 1,
            fn: 0,
          },
          {
            faultType: 'TER_PAYMENT',
            precision: 1.0,
            recall: 1.0,
            f1: 1.0,
            tp: Math.max(1, Math.round(totalInjectedFaults * 0.20)),
            fp: 0,
            fn: 0,
          },
          {
            faultType: 'NOC_VALIDITY',
            precision: 1.0,
            recall: +(0.96 + Math.random() * 0.04).toFixed(2),
            f1: 0.98,
            tp: Math.max(1, Math.round(totalInjectedFaults * 0.22)),
            fp: 0,
            fn: 1,
          },
          {
            faultType: 'DOC_FORENSICS',
            precision: 0.96,
            recall: +(0.93 + Math.random() * 0.05).toFixed(2),
            f1: 0.94,
            tp: Math.max(1, Math.round(totalInjectedFaults * 0.16)),
            fp: 1,
            fn: 1,
          },
        ],
      },
    };

    benchmarkRuns.unshift(newRun);
    return HttpResponse.json({ success: true, data: newRun });
  }),

  // --- Demo Settings ---
  ...route('get', '/api/demo/settings', () => {
    return HttpResponse.json({ success: true, data: demoSettings });
  }),

  ...route('put', '/api/demo/settings', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    demoSettings = { ...demoSettings, ...body };
    return HttpResponse.json({ success: true, data: demoSettings });
  }),

  ...route('post', '/api/demo/tamper-audit', () => {
    auditTampered = true;
    return HttpResponse.json({ success: true, message: 'Audit event #2 tampered in test environment.' });
  }),

  // --- Categories ---
  ...route('get', '/api/categories', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'ENGINEERING_UNDERGRADUATE', name: 'Engineering & Technology (Undergraduate / B.Tech)', checklistCount: 4 },
        { id: 'MANAGEMENT_POSTGRADUATE', name: 'Management Studies (Postgraduate / MBA)', checklistCount: 2 },
        { id: 'PHARMACY_DIPLOMA', name: 'Pharmacy & Medical Sciences (Diploma / B.Pharm)', checklistCount: 3 },
      ],
    });
  }),

  // --- Alerts ---
  ...route('get', '/api/alerts', () => {
    return HttpResponse.json({
      success: true,
      data: alerts,
    });
  }),

  ...route('post', '/api/alerts/:id/ack', ({ params }) => {
    const { id } = params as { id: string };
    const alt = alerts.find((a) => a.id === id);
    if (alt) alt.acknowledged = true;
    return HttpResponse.json({ success: true, data: alt });
  }),

  ...route('patch', '/api/alerts/:id', async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json().catch(() => ({}))) as any;
    const alt = alerts.find((a) => a.id === id);
    if (alt) {
      if (body.status === 'RESOLVED' || body.status === 'ACKNOWLEDGED' || body.status === 'FALSE_POSITIVE') {
        alt.acknowledged = true;
        (alt as any).status = body.status;
      }
      if (body.reason) {
        (alt as any).resolutionReason = body.reason;
      }
    }
    return HttpResponse.json({ success: true, data: alt });
  }),

  // --- Institutions ---
  ...route('get', '/api/institutions', () => {
    return HttpResponse.json({
      success: true,
      data: archiveInstitutions,
    });
  }),

  ...route('get', '/api/institutions/:id', ({ params }) => {
    const { id } = params as { id: string };
    const inst = archiveInstitutions.find((i) => i.id === id) || archiveInstitutions[0];
    return HttpResponse.json({
      success: true,
      data: inst,
    });
  }),

  // --- Triangle of Truth ---
  ...route('get', '/api/applications/:id/triangle', () => {
    return HttpResponse.json({
      success: true,
      data: archiveTriangleFindings,
    });
  }),

  // --- Forensics Suite ---
  ...route('get', '/api/applications/:id/forensics', () => {
    return HttpResponse.json({
      success: true,
      data: archiveForensicsData,
    });
  }),

  // --- 5-Pillar Risk Score Breakdown ---
  ...route('get', '/api/applications/:id/risk-score', ({ params }) => {
    const { id } = params as { id: string };
    return HttpResponse.json({
      success: true,
      data: {
        ...archiveRiskScore,
        applicationId: id,
      },
    });
  }),

  // --- Automated Scrutiny Check Run ---
  ...route('post', '/api/applications/:id/run-checks', async () => {
    await delay(500);
    const steps = [
      { name: 'OCR extraction', status: 'SUCCEEDED' as const },
      { name: 'PDF revision forensics', status: 'SUCCEEDED' as const },
      { name: 'ELA tamper analysis', status: 'SUCCEEDED' as const },
      { name: 'Perceptual image matching', status: 'SUCCEEDED' as const },
      { name: 'Geofence (500 m) validation', status: 'SUCCEEDED' as const },
      { name: 'Faculty identity collision check', status: 'SUCCEEDED' as const },
      { name: 'Architectural blueprint CAD analysis', status: 'SUCCEEDED' as const },
      { name: 'Records reconciliation', status: 'SUCCEEDED' as const },
      { name: 'Objective 5-pillar risk calculation', status: 'SUCCEEDED' as const },
    ];
    return HttpResponse.json({
      success: true,
      data: {
        runId: `run-${Date.now()}`,
        status: 'SUCCEEDED',
        steps,
      },
    });
  }),
  // ===== Handlers added to mirror backend endpoints used by the redesigned UI =====

  ...route('get', '/api/health', () =>
    HttpResponse.json({ success: true, data: { status: 'UP', database: 'MOCK', timestamp: new Date().toISOString(), uptimeSeconds: 0 } })
  ),

  ...route('get', '/api/applications/:id/checklist', ({ params }) => {
    const { id } = params as { id: string };
    const items = checklistMap[id] || checklistMap[faultedApplication.id] || [];
    return HttpResponse.json({ success: true, data: { applicationId: id, items, isComplete: items.every((i) => !i.required || i.state !== 'MISSING') } });
  }),

  ...route('post', '/api/applications/:id/documents', async ({ params, request }) => {
    const { id } = params as { id: string };
    await delay(400);
    const form = await request.formData().catch(() => null);
    const file = form?.get('file') as File | null;
    const itemId = form?.get('checklistItemId') as string | null;
    const list = checklistMap[id];
    const item = list?.find((i) => i.id === itemId);
    if (item) {
      item.state = 'UPLOADED';
      item.fileName = file?.name;
      item.uploadedAt = new Date().toISOString();
    }
    return HttpResponse.json({ success: true, data: { docId: `D-${Date.now()}`, uploadStatus: 'STORED', originalName: file?.name } }, { status: 201 });
  }),

  ...route('post', '/api/applications/:id/submit', ({ params }) => {
    const { id } = params as { id: string };
    const app = applications.find((a) => a.id === id);
    const missing = (checklistMap[id] || []).filter((i) => i.required && i.state === 'MISSING');
    if (missing.length > 0) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Application has deficiencies preventing submission',
            details: missing.map((m) => ({ field: m.docType, message: `Mandatory regulatory document '${m.label}' has not been uploaded.` })),
          },
        },
        { status: 400 }
      );
    }
    if (app) {
      app.status = 'SUBMITTED';
      app.submittedAt = new Date().toISOString();
    }
    return HttpResponse.json({ success: true, data: { application: app } });
  }),

  ...route('get', '/api/applications/:id/runs/:runId', ({ params }) => {
    const { runId } = params as { runId: string };
    return HttpResponse.json({
      success: true,
      data: {
        run: {
          runId,
          status: 'SUCCEEDED',
          steps: [
            { name: 'OCR extraction', status: 'SUCCEEDED' },
            { name: 'Records reconciliation', status: 'SUCCEEDED' },
            { name: 'Risk score', status: 'SUCCEEDED' },
          ],
        },
      },
    });
  }),

  ...route('post', '/api/ledger/:entryId/manual-confirm', async ({ params, request }) => {
    const { entryId } = params as { entryId: string };
    const body = (await request.json().catch(() => ({}))) as any;
    if (!body.note || String(body.note).trim().length < 10) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Manual confirmation note must be at least 10 characters' } },
        { status: 400 }
      );
    }
    let updated: any;
    Object.values(ledgerMap).forEach((list: any[]) => {
      const e = list.find((x) => x.id === entryId);
      if (e) {
        e.manual = { state: body.confirmed ? 'CONFIRMED' : 'REJECTED', officerId: 'mock-officer', note: body.note, timestamp: new Date().toISOString() };
        e.status = body.confirmed ? 'VERIFIED' : 'MISMATCH_DETECTED';
        updated = e;
      }
    });
    return HttpResponse.json({ success: true, data: updated });
  }),

  ...route('get', '/api/dashboard/institution', () =>
    HttpResponse.json({ success: true, data: { totalApplications: applications.length, applications } })
  ),

  ...route('get', '/api/dashboard/summary', () => {
    const byStatus: Record<string, number> = {};
    applications.forEach((a) => (byStatus[a.status] = (byStatus[a.status] || 0) + 1));
    const byRisk: Record<string, number> = { GREEN: 0, YELLOW: 0, RED: 0 };
    applications.forEach((a) => a.band && (byRisk[a.band] = (byRisk[a.band] || 0) + 1));
    const bySev: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    alerts.filter((a) => !a.acknowledged).forEach((a) => (bySev[a.severity] = (bySev[a.severity] || 0) + 1));
    return HttpResponse.json({
      success: true,
      data: {
        overview: {
          totalInstitutions: archiveInstitutions.length,
          totalApplications: applications.length,
          totalOpenAlerts: Object.values(bySev).reduce((x, y) => x + y, 0),
        },
        applicationsByStatus: byStatus,
        applicationsByRiskLevel: byRisk,
        openAlertsBySeverity: bySev,
        recentRuns: [],
      },
    });
  }),

  ...route('get', '/api/admin/users', () => HttpResponse.json({ success: true, data: mockUsers })),

  ...route('post', '/api/admin/users', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    if (mockUsers.some((u) => u.email === String(body.email).toLowerCase())) {
      return HttpResponse.json({ success: false, error: { code: 'CONFLICT', message: `User with email '${body.email}' already exists` } }, { status: 409 });
    }
    const u = { id: `usr-${Date.now()}`, name: body.name, email: String(body.email).toLowerCase(), role: body.role, institutionId: body.institutionId ?? null, isActive: true, createdAt: new Date().toISOString(), lastLoginAt: null };
    mockUsers.unshift(u);
    return HttpResponse.json({ success: true, data: u }, { status: 201 });
  }),

  ...route('patch', '/api/admin/users/:id', async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json().catch(() => ({}))) as any;
    const u = mockUsers.find((x) => x.id === id);
    if (!u) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, { status: 404 });
    if (body.role) u.role = body.role;
    if (body.isActive !== undefined) u.isActive = !!body.isActive;
    return HttpResponse.json({ success: true, data: u });
  }),

  ...route('get', '/api/admin/checklists', () => HttpResponse.json({ success: true, data: mockChecklists })),

  ...route('put', '/api/admin/checklists/:category', async ({ params, request }) => {
    const { category } = params as { category: string };
    const body = (await request.json().catch(() => ({}))) as any;
    let c = mockChecklists.find((x) => x.category === category);
    if (!c) {
      c = { id: `chk-${category}`, category, version: body.version ?? '2026.1', active: true, items: [] };
      mockChecklists.push(c);
    }
    c.items = body.items ?? [];
    c.version = body.version ?? c.version;
    c.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: c });
  }),

  ...route('get', '/api/admin/rulepacks', () => HttpResponse.json({ success: true, data: mockRulepacks })),

  ...route('post', '/api/admin/rulepacks', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    if (!body.version || !body.yamlText) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'version and yamlText are required' } }, { status: 400 });
    }
    const r = { id: `rp-${Date.now()}`, version: body.version, yamlText: body.yamlText, sha256: 'mock-' + Math.random().toString(16).slice(2).padEnd(56, '0'), active: false, notes: body.notes ?? null, createdAt: new Date().toISOString() };
    mockRulepacks.unshift(r);
    return HttpResponse.json({ success: true, data: r }, { status: 201 });
  }),

  ...route('post', '/api/admin/rulepacks/:version/activate', ({ params }) => {
    const { version } = params as { version: string };
    const target = mockRulepacks.find((r) => r.version === version);
    if (!target) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Rulepack version '${version}' not found` } }, { status: 404 });
    mockRulepacks.forEach((r) => (r.active = false));
    target.active = true;
    return HttpResponse.json({ success: true, data: target });
  }),

  ...route('post', '/api/institutions', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const inst: any = { id: `inst-${Date.now()}`, name: body.name, registrationId: body.registrationId?.toUpperCase(), address: body.address, state: body.state, latitude: body.latitude, longitude: body.longitude, verificationStatus: 'PENDING' };
    (archiveInstitutions as any[]).push(inst);
    return HttpResponse.json({ success: true, data: { institution: inst } }, { status: 201 });
  }),

  // --- Feature 1: Syndicate Network MSW Handlers ---
  ...route('get', '/api/syndicate/graph', () => {
    // High-fidelity mock syndicate graph mirroring backend seeder
    const cartelColleges = [
      { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', city: 'Noida', riskScore: 88, riskLevel: 'RED', isCartel: true },
      { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', city: 'Pune', riskScore: 84, riskLevel: 'RED', isCartel: true },
      { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', city: 'Bengaluru', riskScore: 82, riskLevel: 'RED', isCartel: true },
      { id: 'COL-CARTEL-04', name: 'Horizon Institute of Management & Science', state: 'Tamil Nadu', city: 'Chennai', riskScore: 79, riskLevel: 'RED', isCartel: true },
      { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', city: 'Ahmedabad', riskScore: 86, riskLevel: 'RED', isCartel: true },
    ];

    const normalColleges = [
      { id: 'COL-NORM-01', name: 'St. Xavier Institute of Technology', state: 'Tamil Nadu', city: 'Chennai', riskScore: 18, riskLevel: 'GREEN', isCartel: false },
      { id: 'COL-NORM-02', name: 'Kalinga Institute of Architecture', state: 'Odisha', city: 'Bhubaneswar', riskScore: 24, riskLevel: 'GREEN', isCartel: false },
      { id: 'COL-NORM-03', name: 'Sardar Patel College of Pharmacy', state: 'Gujarat', city: 'Ahmedabad', riskScore: 16, riskLevel: 'GREEN', isCartel: false },
      { id: 'COL-NORM-04', name: 'Chanakya Polytechnic Institute', state: 'Karnataka', city: 'Mysuru', riskScore: 32, riskLevel: 'GREEN', isCartel: false },
    ];

    const ghostFaculty = [
      { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', type: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', type: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8' },
      { id: 'FAC-3', name: 'Dr. Arvind Kumar Verma', type: 'AADHAAR', hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a' },
      { id: 'FAC-4', name: 'Prof. Rajeshwari Natarajan', type: 'AADHAAR', hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d' },
      { id: 'FAC-5', name: 'Dr. Vikramaditya Rathore', type: 'PAN', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
    ];

    const elements: any[] = [];

    // College Nodes (Large Blue)
    [...cartelColleges, ...normalColleges].forEach((c) => {
      elements.push({
        data: {
          id: c.id,
          label: c.name.replace(/ Institute.*| College.*| Academy.*/, '').trim(),
          fullName: c.name,
          nodeType: 'college',
          color: c.isCartel ? '#2563eb' : '#3b82f6',
          size: c.isCartel ? 55 : 44,
          state: c.state,
          city: c.city,
          riskScore: c.riskScore,
          riskLevel: c.riskLevel,
          isCartelMember: c.isCartel,
        },
      });
    });

    // Faculty Nodes (Small Red)
    ghostFaculty.forEach((f) => {
      elements.push({
        data: {
          id: f.id,
          label: `${f.name.split(' ')[0]} (${f.type})`,
          fullName: f.name,
          nodeType: 'faculty',
          hash: f.hash,
          shortHash: `${f.hash.slice(0, 8)}…`,
          identifierType: f.type,
          color: '#ef4444',
          size: 26,
          isGhost: true,
        },
      });
    });

    // Severity Edges (Thickness = Severity)
    const severityPairs = [
      ['COL-CARTEL-01', 'COL-CARTEL-02', 4, 8, '#b91c1c'],
      ['COL-CARTEL-02', 'COL-CARTEL-03', 3, 6, '#ea580c'],
      ['COL-CARTEL-03', 'COL-CARTEL-04', 4, 8, '#b91c1c'],
      ['COL-CARTEL-04', 'COL-CARTEL-05', 3, 6, '#ea580c'],
      ['COL-CARTEL-05', 'COL-CARTEL-01', 5, 10, '#b91c1c'],
    ];

    severityPairs.forEach(([src, tgt, count, width, color]) => {
      elements.push({
        data: {
          id: `EDGE-${src}-${tgt}`,
          source: src,
          target: tgt,
          edgeType: 'shared_severity',
          severityCount: count,
          width,
          lineColor: color,
        },
      });
    });

    // Connect some ghost faculty to colleges
    ghostFaculty.forEach((f, idx) => {
      elements.push({
        data: {
          id: `EMP-${f.id}-1`,
          source: cartelColleges[idx % cartelColleges.length].id,
          target: f.id,
          edgeType: 'employs',
        },
      });
      elements.push({
        data: {
          id: `EMP-${f.id}-2`,
          source: cartelColleges[(idx + 1) % cartelColleges.length].id,
          target: f.id,
          edgeType: 'employs',
        },
      });
    });

    return HttpResponse.json({
      success: true,
      graph: {
        elements,
        nodesCount: elements.filter((e) => !e.data.source).length,
        edgesCount: elements.filter((e) => !!e.data.source).length,
      },
      cartel: {
        cartelId: 'CARTEL-RING-ALPHA',
        name: '5-College High-Risk Faculty Sharing Syndicate',
        colleges: cartelColleges,
        size: 5,
        totalSharedGhostFaculty: 10,
        riskScoreAvg: 85,
        riskLevel: 'CRITICAL',
        description: 'Autonomous graph detection identified a closed 5-node cycle sharing 10 identical faculty HMAC hashes across 5 states, violating AICTE section 2.4 accreditation standards.',
      },
      cypherQueries: {
        detectMultiHop: 'MATCH path = (start:College)-[:SHARES_FACULTY*2..4]->(target:College)\nWHERE start.id <> target.id\nRETURN path, length(path) AS hops',
        detectCycles: 'MATCH cyclePath = (c:College)-[r:SHARES_FACULTY*3..6]->(c)\nRETURN cyclePath',
        aggregateSeverity: 'MATCH (c1:College)-[r:SHARES_FACULTY]-(c2:College)\nRETURN c1, c2, count(r) AS severityWeight',
      },
    });
  }),

  ...route('get', '/api/syndicate/node/:id', ({ params }) => {
    const { id } = params as { id: string };
    if (id.startsWith('COL')) {
      return HttpResponse.json({
        success: true,
        data: {
          type: 'college',
          id,
          name: id.includes('01') ? 'Apex National Institute of Technology' : 'Paramount College of Engineering & Research',
          registrationId: `AICTE-${id}`,
          state: 'Delhi NCR',
          city: 'Noida',
          riskScore: 88,
          riskLevel: 'RED',
          isCartelMember: true,
          facultyCount: 14,
          sharedFacultyCount: 6,
          facultyList: [
            { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', department: 'Computer Science', identifierType: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', isGhost: true },
            { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', department: 'Information Technology', identifierType: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', isGhost: true },
          ],
          colludingInstitutions: [
            { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
            { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', riskScore: 82 },
          ],
          definitiveProof: {
            statement: 'Definitive multi-hop graph proof: Participates in a closed 5-node cartel syndicate sharing 6 ghost faculty across 4 institutions.',
            recommendedAction: 'IMMEDIATE_EVC_INSPECTION_AND_HOLD',
          },
        },
      });
    }

    return HttpResponse.json({
      success: true,
      data: {
        type: 'faculty',
        id,
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        name: 'Dr. Ramesh Chandra Sharma',
        identifierType: 'AADHAAR',
        department: 'Computer Science',
        isGhost: true,
        associatedColleges: [
          { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
          { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
        ],
        definitiveProof: {
          statement: 'Duplication collision proof: Identifier AADHAAR hash appears simultaneously on active regulatory rosters of 2 distinct institutions.',
          collisionDetected: true,
        },
      },
    });
  }),

  ...route('post', '/api/syndicate/seed', () => HttpResponse.json({ success: true, message: 'Re-seeded successfully' })),

  // --- Feature 3: Cryptographic Integrity Audit MSW Handlers ---
  ...route('get', '/api/audit/integrity', () => {
    // Check if simulated tamper is active
    if ((globalThis as any).__mockBreachActive) {
      return HttpResponse.json({
        success: true,
        intact: false,
        breachDetected: true,
        status: 'CRYPTOGRAPHIC BREACH',
        alert: 'CRYPTOGRAPHIC BREACH',
        message: 'CRYPTOGRAPHIC BREACH DETECTED: 1 application record has an invalid cryptographic signature. Direct database modification detected.',
        summary: {
          totalApplications: 10,
          verifiedCount: 9,
          tamperedCount: 1,
        },
        tamperedRecords: [
          {
            applicationId: 'app-tampered-001',
            applicationNumber: 'APP-2026-000101',
            institutionName: 'Apex National Institute of Technology',
            state: 'Uttar Pradesh',
            status: 'APPROVED',
            riskScore: 95,
            riskLevel: 'GREEN',
            storedHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
            recalculatedHash: 'c7b508f7f2b184a56c07df74d9e262c5e52d67d71b3e85e135118f90a9829f27',
            previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
            tamperedReason: 'Stored cryptographic hash does not match computed signature. Row was directly manipulated in database storage bypassing the Node.js API layer (DBA bypass attack).',
          },
        ],
        auditedAt: new Date().toISOString(),
      });
    }

    return HttpResponse.json({
      success: true,
      intact: true,
      breachDetected: false,
      status: 'VERIFIED_INTACT',
      alert: null,
      message: 'Integrity Audit passed successfully. All 10 application records match their immutable cryptographic signatures.',
      summary: {
        totalApplications: 10,
        verifiedCount: 10,
        tamperedCount: 0,
      },
      tamperedRecords: [],
      auditedAt: new Date().toISOString(),
    });
  }),

  ...route('post', '/api/audit/tamper-application', () => {
    (globalThis as any).__mockBreachActive = true;
    return HttpResponse.json({ success: true, message: 'DBA bypass executed' });
  }),

  ...route('post', '/api/audit/repair-application', () => {
    (globalThis as any).__mockBreachActive = false;
    return HttpResponse.json({ success: true, message: 'Application repaired and re-signed' });
  }),
];


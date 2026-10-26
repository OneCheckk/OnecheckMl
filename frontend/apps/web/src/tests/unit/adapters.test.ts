import { describe, it, expect } from 'vitest';
import {
  addIdAliases,
  extractList,
  extractPagination,
  normalizeAlert,
  normalizeApplication,
  normalizeApplicationDetail,
  normalizeAuditVerify,
  normalizeBenchmarkRun,
  normalizeFinding,
  normalizeForensics,
  normalizeLetter,
  normalizeRiskScore,
  normalizeTriangle,
} from '../../api/adapters';
import { describeApiError } from '../../api/errors';

// Shapes below are taken from the backend services (OneCheckBackend-main/src).

describe('addIdAliases', () => {
  it('adds id from _id without removing _id, recursively', () => {
    const data = { applications: [{ _id: 'a1', institution: { _id: 'i1', name: 'X' } }] };
    addIdAliases(data);
    expect(data.applications[0]).toMatchObject({ _id: 'a1', id: 'a1' });
    expect((data.applications[0].institution as any).id).toBe('i1');
  });
  it('does not overwrite an existing id', () => {
    const d: any = { _id: 'mongo', id: 'keep' };
    addIdAliases(d);
    expect(d.id).toBe('keep');
  });
});

describe('Application normalisation', () => {
  const backendListItem = {
    _id: '65f0',
    id: '65f0',
    applicationNumber: 'APP-2026-123456',
    institution: { _id: 'inst9', name: 'Apex Institute of Technology', state: 'Delhi' },
    category: 'EOA_INTAKE_INCREASE',
    academicYear: '2026-2027',
    status: 'SUBMITTED',
    summary: { band: 'RED', maxSeverity: 'HIGH', openFindings: 4, needsConfirmation: 1, pendingSources: 2 },
    riskScore: 42,
    riskLevel: 'RED',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
  };

  it('maps the backend list shape without inventing a severity breakdown', () => {
    const a = normalizeApplication(backendListItem)!;
    expect(a.id).toBe('65f0');
    expect(a.institutionName).toBe('Apex Institute of Technology');
    expect(a.institutionId).toBe('inst9');
    expect(a.band).toBe('RED');
    expect(a.hasSeverityBreakdown).toBe(false);
    expect(a.openFindingsTotal).toBe(4);
    expect(a.pendingSourcesCount).toBe(2);
    expect(a.claimsNeedingConfirmationCount).toBe(1);
    expect(a.riskScore).toBe(42);
  });

  it('leaves counts undefined when the server does not send them', () => {
    const a = normalizeApplication({ _id: 'x', applicationNumber: 'A', status: 'DRAFT', category: 'C' })!;
    expect(a.openFindingsTotal).toBeUndefined();
    expect(a.pendingSourcesCount).toBeUndefined();
    expect(a.band).toBeUndefined();
  });

  it('keeps the contract/mock shape intact', () => {
    const mock = {
      id: 'app-1',
      applicationNumber: 'AICTE-1',
      institutionId: 'inst-1',
      institutionName: 'Mock Inst',
      category: 'X',
      status: 'UNDER_SCRUTINY',
      band: 'YELLOW',
      missingItemsCount: 0,
      openFindingsCount: { info: 0, low: 1, medium: 0, high: 2, critical: 0 },
      pendingSourcesCount: 1,
      claimsNeedingConfirmationCount: 0,
      updatedAt: '2026-10-01T00:00:00Z',
    };
    const a = normalizeApplication(mock)!;
    expect(a.hasSeverityBreakdown).toBe(true);
    expect(a.openFindingsTotal).toBe(3);
    expect(a.institutionName).toBe('Mock Inst');
  });

  it('unwraps GET /applications/:id {application, documents, alerts}', () => {
    const d = normalizeApplicationDetail({
      application: backendListItem,
      documents: [{ _id: 'd1', id: 'd1', originalName: 'plan.pdf', documentType: 'BUILDING_PLAN', version: 2 }],
      alerts: [{ _id: 'al1', id: 'al1', severity: 'HIGH', status: 'OPEN', application: '65f0', message: 'm', type: 'T' }],
      latestRun: null,
    })!;
    expect(d.id).toBe('65f0');
    expect(d.documents[0]).toMatchObject({ id: 'd1', originalName: 'plan.pdf', docType: 'BUILDING_PLAN', version: 2 });
    expect(d.relatedAlerts[0].applicationId).toBe('65f0');
  });
});

describe('Finding, triangle, alert, letter adapters', () => {
  it('reads disposition.state from backend findings', () => {
    const f = normalizeFinding({ findingId: 'F1', disposition: { state: 'ACCEPTED' }, state: 'OPEN', proof: { statement: 's' } });
    expect(f.state).toBe('ACCEPTED');
    expect(f.proof.evidence).toEqual([]);
  });

  it('does not fabricate triangle nodes when the server sends none', () => {
    const t = normalizeTriangle({ id: 'F1', title: 'T', status: 'MISMATCH_DETECTED', message: 'msg', clauseRef: 'C-1', proof: { evidence: [{ label: 'a', value: 1 }] } });
    expect(t.nodes).toBeUndefined();
    expect(t.explanation).toBe('msg');
    expect(t.handbookClause).toBe('C-1');
    expect(t.evidence).toHaveLength(1);
  });

  it('derives alert workflow status from backend status or legacy acknowledged flag', () => {
    expect(normalizeAlert({ _id: 'a', status: 'RESOLVED', application: 'x' }).status).toBe('RESOLVED');
    expect(normalizeAlert({ id: 'a', acknowledged: false }).status).toBe('OPEN');
    expect(normalizeAlert({ id: 'a', acknowledged: true }).status).toBe('ACKNOWLEDGED');
  });

  it('treats server-rendered letter bodies as HTML', () => {
    expect(normalizeLetter({ _id: 'l', body: '<html><body><p>Hi</p></body></html>', status: 'DRAFT' }).isHtml).toBe(true);
    expect(normalizeLetter({ id: 'l', content: 'Plain text', status: 'SENT' }).isHtml).toBe(false);
  });
});

describe('Risk score placeholder detection', () => {
  it('flags the backend fallback object (no persisted score) as not computed', () => {
    const fallback = {
      applicationId: 'a',
      application: 'a',
      totalScore: 100,
      riskLevel: 'GREEN',
      pillarScores: {},
      deductions: [],
      rulesVersion: 'v1.0',
    };
    expect(normalizeRiskScore(fallback).isComputed).toBe(false);
  });
  it('accepts a persisted score', () => {
    expect(normalizeRiskScore({ _id: 'r', application: 'a', totalScore: 48, riskLevel: 'RED', createdAt: '2026-10-01' }).isComputed).toBe(true);
    expect(normalizeRiskScore({ applicationId: 'a', totalScore: 48, riskLevel: 'RED', deductions: [] }).isComputed).toBe(true);
  });
});

describe('Forensics shape detection', () => {
  it('recognises the backend documents/photos shape', () => {
    const v = normalizeForensics({ summary: { totalDocuments: 1 }, documents: [{ documentId: 'd' }], photos: [] });
    expect(v.kind).toBe('documents');
  });
  it('recognises the contract suite shape', () => {
    expect(normalizeForensics({ pdfRevisions: [], ela: [] }).kind).toBe('suite');
  });
  it('reports empty when nothing is returned', () => {
    expect(normalizeForensics(undefined).kind).toBe('empty');
  });
});

describe('Audit verification and benchmark adapters', () => {
  it('maps backend verify keys (verified/brokenSeq)', () => {
    expect(normalizeAuditVerify({ verified: false, brokenSeq: 7, reason: 'r' })).toMatchObject({ intact: false, brokenAtSeq: 7, reason: 'r' });
    expect(normalizeAuditVerify({ intact: true, verifiedCount: 3 })).toMatchObject({ intact: true, totalEvents: 3 });
  });

  it('maps backend benchmark scores (fractions, ms) to display units', () => {
    const b = normalizeBenchmarkRun({
      runId: 'r1',
      appsCount: 2,
      executedAt: '2026-10-01',
      scores: {
        extractionAccuracy: { overall: 0.96 },
        validationAccuracy: 0.98,
        cleanAppFalsePositiveRate: 0,
        averageVerificationTimeMs: 1420,
        perFault: [{ ruleId: 'AREA-CONSIST-001', precision: 1, recall: 0.5, f1: 0.67 }],
      },
    });
    expect(b.extractionAccuracy).toBeCloseTo(96);
    expect(b.validationAccuracy).toBeCloseTo(98);
    expect(b.avgVerificationTimeSec).toBeCloseTo(1.42);
    expect(b.n).toBe(2);
    expect(b.perFault[0]).toMatchObject({ label: 'AREA-CONSIST-001', recall: 50 });
  });

  it('leaves benchmark metrics undefined when not reported', () => {
    const b = normalizeBenchmarkRun({ runId: 'r2' });
    expect(b.extractionAccuracy).toBeUndefined();
    expect(b.perFault).toEqual([]);
  });
});

describe('List and pagination extraction', () => {
  it('reads meta.pagination (applications) and top-level pagination (audit)', () => {
    expect(extractPagination({ meta: { pagination: { page: 2, limit: 20, totalItems: 41, totalPages: 3 } } })).toEqual({ page: 2, limit: 20, totalItems: 41, totalPages: 3 });
    expect(extractPagination({ pagination: { page: 1, limit: 20, totalItems: 5, totalPages: 1 } })?.totalItems).toBe(5);
    expect(extractPagination({})).toBeUndefined();
  });
  it('reads arrays from data or a nested key', () => {
    expect(extractList({ data: [1, 2] } as any)).toHaveLength(2);
    expect(extractList({ data: { applications: [1] } } as any, 'applications')).toHaveLength(1);
    expect(extractList({ data: null } as any)).toEqual([]);
  });
});

describe('API error descriptions', () => {
  it('describes network failures without technical detail', () => {
    const info = describeApiError({ isAxiosError: true, request: {}, message: 'Network Error' });
    expect(info.code).toBe('NETWORK_ERROR');
    expect(info.title).toMatch(/Cannot reach/);
  });
  it('keeps the server message and request ID', () => {
    const info = describeApiError({
      isAxiosError: true,
      response: { status: 429, data: { error: { code: 'TOO_MANY_REQUESTS', message: 'Slow down' }, meta: { requestId: 'req-1' } }, headers: {} },
    });
    expect(info).toMatchObject({ status: 429, message: 'Slow down', requestId: 'req-1', title: 'Too many attempts' });
  });
});

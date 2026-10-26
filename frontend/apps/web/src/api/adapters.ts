/**
 * Frontend presentation adapters.
 *
 * The backend (Express + Mongoose) returns documents keyed by `_id`, nests
 * related entities, and in a few places uses field names that differ from the
 * shared contract in `contracts/index.ts`. The mock layer (MSW) returns the
 * contract shapes directly. These adapters accept BOTH and produce one
 * presentation shape, without renaming or dropping any original field, so the
 * real API contract stays untouched.
 *
 * Rule: adapters never invent values. A field the server did not send stays
 * `undefined` and the UI renders it as "not available".
 */
import type {
  Application,
  Alert,
  AuditEvent,
  Band,
  BenchmarkRun,
  ChecklistItem,
  Finding,
  LedgerEntry,
  RiskScoreBreakdown,
  Severity,
  TriangleFinding,
  ForensicsSuiteData,
} from '@contracts';

type AnyRecord = Record<string, any>;

const isPlainObject = (v: unknown): v is AnyRecord =>
  !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Adds an `id` alias to every plain object that carries a Mongo `_id` but no
 * `id`. Applied once in the axios response interceptor. Non-destructive.
 */
export function addIdAliases<T>(value: T, depth = 0): T {
  if (depth > 12) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => addIdAliases(item, depth + 1));
    return value;
  }
  if (isPlainObject(value)) {
    const obj: AnyRecord = value;
    if (obj._id !== undefined && obj._id !== null && obj.id === undefined) {
      const raw = obj._id;
      obj.id = typeof raw === 'object' && raw !== null && '$oid' in raw ? String(raw.$oid) : String(raw);
    }
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (child && typeof child === 'object') addIdAliases(child, depth + 1);
    }
  }
  return value;
}

/** Converts an id-or-populated-reference into a string id. */
export const refId = (ref: unknown): string | undefined => {
  if (ref === null || ref === undefined) return undefined;
  if (typeof ref === 'string') return ref;
  if (isPlainObject(ref)) return (ref.id ?? ref._id)?.toString();
  return String(ref);
};

// ------------------------------------------------------------------
// Pagination
// ------------------------------------------------------------------
export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export function extractPagination(body: AnyRecord | undefined): PaginationMeta | undefined {
  const p = body?.meta?.pagination ?? body?.pagination;
  if (!p || typeof p.totalItems !== 'number') return undefined;
  return {
    page: Number(p.page) || 1,
    limit: Number(p.limit) || 20,
    totalItems: Number(p.totalItems),
    totalPages: Number(p.totalPages) || 1,
  };
}

/** Pulls the array out of `{data: [...]}` or `{data: {<key>: [...]}}`. */
export function extractList(body: AnyRecord | undefined, ...keys: string[]): AnyRecord[] {
  const data = body?.data;
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

// ------------------------------------------------------------------
// Applications
// ------------------------------------------------------------------
export interface ApplicationView extends Application {
  academicYear?: string;
  createdAt?: string;
  riskScore?: number | null;
  maxSeverity?: Severity | null;
  /** Total open findings when only an aggregate is available (backend `summary.openFindings`). */
  openFindingsTotal?: number;
  /** True when per-severity counts were supplied by the server. */
  hasSeverityBreakdown: boolean;
  decision?: { outcome?: string | null; reason?: string | null; at?: string | null } | null;
  lastTrace?: AnyRecord[];
  assignedOfficerName?: string;
  institutionState?: string;
  synthetic?: boolean;
}

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function normalizeApplication(raw: AnyRecord | undefined | null): ApplicationView | undefined {
  if (!raw) return undefined;
  const inst = isPlainObject(raw.institution) ? raw.institution : undefined;
  const summary = isPlainObject(raw.summary) ? raw.summary : undefined;
  const hasBreakdown = isPlainObject(raw.openFindingsCount);
  const band: Band | undefined = raw.band ?? summary?.band ?? raw.riskLevel ?? undefined;

  return {
    ...raw,
    id: (raw.id ?? raw._id ?? '').toString(),
    applicationNumber: raw.applicationNumber ?? raw.appNo ?? '',
    institutionId: refId(raw.institutionId) ?? refId(raw.institution) ?? '',
    institutionName: raw.institutionName ?? inst?.name ?? '',
    institutionState: inst?.state,
    category: raw.category ?? '',
    status: raw.status,
    band: band && ['RED', 'YELLOW', 'GREEN'].includes(band) ? band : undefined,
    missingItemsCount: raw.missingItemsCount,
    openFindingsCount: hasBreakdown
      ? raw.openFindingsCount
      : { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
    hasSeverityBreakdown: hasBreakdown,
    openFindingsTotal: hasBreakdown
      ? Object.values(raw.openFindingsCount as Record<string, number>).reduce((a, b) => a + (b || 0), 0)
      : typeof summary?.openFindings === 'number'
        ? summary.openFindings
        : undefined,
    maxSeverity: summary?.maxSeverity ?? undefined,
    pendingSourcesCount: raw.pendingSourcesCount ?? summary?.pendingSources,
    claimsNeedingConfirmationCount: raw.claimsNeedingConfirmationCount ?? summary?.needsConfirmation,
    submittedAt: raw.submittedAt ?? undefined,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? '',
    createdAt: raw.createdAt,
    academicYear: raw.academicYear,
    riskScore: raw.riskScore ?? undefined,
    decision: raw.decision ?? null,
    lastTrace: Array.isArray(raw.lastTrace) ? raw.lastTrace : undefined,
    assignedOfficerName: isPlainObject(raw.assignedOfficer) ? raw.assignedOfficer.name : undefined,
    synthetic: raw.synthetic,
  } as ApplicationView;
}

export interface ApplicationDocument {
  id: string;
  originalName?: string;
  docType?: string;
  version?: number;
  uploadStatus?: string;
  verificationStatus?: string;
  analysisStatus?: string;
  pageCount?: number;
  sizeBytes?: number;
  createdAt?: string;
}

export function normalizeDocument(raw: AnyRecord): ApplicationDocument {
  return {
    id: (raw.id ?? raw._id ?? raw.docId ?? '').toString(),
    originalName: raw.originalName ?? raw.fileName ?? raw.label,
    docType: raw.docType ?? raw.documentType,
    version: raw.version,
    uploadStatus: raw.uploadStatus,
    verificationStatus: raw.verificationStatus,
    analysisStatus: raw.analysis?.status,
    pageCount: raw.pageCount,
    sizeBytes: raw.fileSize ?? raw.size ?? raw.sizeBytes,
    createdAt: raw.createdAt ?? raw.uploadedAt,
  };
}

export interface ApplicationDetail extends ApplicationView {
  documents: ApplicationDocument[];
  relatedAlerts: AlertView[];
  latestRun?: AnyRecord | null;
  latestScore?: AnyRecord | null;
}

/** GET /applications/:id returns either the app itself (mock) or {application, documents, ...} (backend). */
export function normalizeApplicationDetail(data: AnyRecord | undefined): ApplicationDetail | undefined {
  if (!data) return undefined;
  const rawApp = isPlainObject(data.application) ? data.application : data;
  const app = normalizeApplication(rawApp);
  if (!app) return undefined;
  return {
    ...app,
    documents: Array.isArray(data.documents) ? data.documents.map(normalizeDocument) : [],
    relatedAlerts: Array.isArray(data.alerts) ? data.alerts.map(normalizeAlert) : [],
    latestRun: data.latestRun ?? null,
    latestScore: data.latestScore ?? null,
  };
}

// ------------------------------------------------------------------
// Checklist
// ------------------------------------------------------------------
export function normalizeChecklistItem(item: AnyRecord): ChecklistItem & { docTypes?: string[] } {
  const docTypes: string[] | undefined = Array.isArray(item.docTypes) ? item.docTypes : undefined;
  return {
    ...item,
    id: (item.id ?? item._id ?? '').toString(),
    label: item.label ?? item.originalName ?? item.documentType ?? 'Document',
    state: item.status ?? item.state ?? 'MISSING',
    docType: item.docType ?? docTypes?.[0] ?? item.document?.docType ?? '',
    docTypes,
    docId: item.docId ?? refId(item.document?.docId),
    fileName: item.document?.originalName ?? item.fileName,
    clauseRef: item.clauseRef ?? '',
    required: item.required !== false,
  } as ChecklistItem & { docTypes?: string[] };
}

// ------------------------------------------------------------------
// Findings
// ------------------------------------------------------------------
export function normalizeFinding(raw: AnyRecord): Finding {
  const proof = isPlainObject(raw.proof) ? raw.proof : {};
  return {
    ...raw,
    findingId: raw.findingId ?? (raw.id ?? raw._id ?? '').toString(),
    state: raw.disposition?.state ?? raw.state ?? 'OPEN',
    dismissalReason: raw.dismissalReason ?? raw.disposition?.reason,
    proof: {
      statement: proof.statement ?? '',
      evidence: Array.isArray(proof.evidence) ? proof.evidence : [],
      computation: proof.computation ?? undefined,
    },
    claimIds: Array.isArray(raw.claimIds) ? raw.claimIds : [],
  } as Finding;
}

// ------------------------------------------------------------------
// Triangle findings (backend returns finding-like records without `nodes`)
// ------------------------------------------------------------------
export interface TriangleView extends Omit<TriangleFinding, 'nodes'> {
  nodes?: TriangleFinding['nodes'];
  severity?: Severity;
  evidence?: AnyRecord[];
}

export function normalizeTriangle(raw: AnyRecord): TriangleView {
  return {
    ...raw,
    id: (raw.id ?? raw.findingId ?? raw._id ?? '').toString(),
    title: raw.title ?? '',
    claimKey: raw.claimKey ?? raw.ruleId ?? '',
    status: raw.status,
    explanation: raw.explanation ?? raw.message ?? raw.proof?.statement ?? '',
    handbookClause: raw.handbookClause ?? raw.clauseRef ?? '',
    evidencePage: raw.evidencePage ?? '',
    nodes: Array.isArray(raw.nodes) && raw.nodes.length > 0 ? raw.nodes : undefined,
    evidence: Array.isArray(raw.proof?.evidence) ? raw.proof.evidence : undefined,
  } as TriangleView;
}

// ------------------------------------------------------------------
// Ledger
// ------------------------------------------------------------------
export function normalizeLedgerEntry(raw: AnyRecord): LedgerEntry {
  const src = raw.source;
  return {
    ...raw,
    id: (raw.id ?? raw._id ?? '').toString(),
    docId: refId(raw.docId) ?? '',
    source:
      typeof src === 'string'
        ? { label: src, kind: raw.sourceKind ?? undefined }
        : { label: src?.label ?? src?.name ?? 'Source not specified', kind: src?.kind },
    requestSummary: raw.requestSummary ?? '',
    responseSummary: raw.responseSummary ?? (raw.error ? String(raw.error) : ''),
  } as LedgerEntry;
}

// ------------------------------------------------------------------
// Alerts
// ------------------------------------------------------------------
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface AlertView extends Alert {
  status: AlertStatus;
  title?: string;
  applicationNumber?: string;
}

export function normalizeAlert(raw: AnyRecord): AlertView {
  const app = isPlainObject(raw.application) ? raw.application : undefined;
  const status: AlertStatus =
    raw.status ?? (raw.acknowledged === true ? 'ACKNOWLEDGED' : 'OPEN');
  return {
    ...raw,
    id: (raw.id ?? raw._id ?? '').toString(),
    type: raw.type ?? 'ALERT',
    severity: raw.severity ?? 'INFO',
    message: raw.message ?? '',
    title: raw.title,
    applicationId: refId(raw.applicationId) ?? refId(raw.application) ?? '',
    applicationNumber: raw.applicationNumber ?? app?.applicationNumber,
    raisedAt: raw.raisedAt ?? raw.createdAt ?? '',
    acknowledged: status !== 'OPEN',
    status,
  } as AlertView;
}

// ------------------------------------------------------------------
// Letters
// ------------------------------------------------------------------
export interface LetterView {
  id: string;
  applicationId: string;
  findingIds: string[];
  content: string;
  isHtml: boolean;
  status: 'DRAFT' | 'SENT' | string;
  createdAt?: string;
  sentAt?: string;
  recipient?: string;
}

export function normalizeLetter(raw: AnyRecord): LetterView {
  const content: string = raw.content ?? raw.body ?? '';
  return {
    id: (raw.id ?? raw._id ?? '').toString(),
    applicationId: refId(raw.applicationId) ?? '',
    findingIds: Array.isArray(raw.findingIds) ? raw.findingIds : [],
    content,
    isHtml: /<\s*(html|body|p|div|table|h\d)[\s>]/i.test(content),
    status: raw.status ?? 'DRAFT',
    createdAt: raw.createdAt,
    sentAt: raw.sentAt,
    recipient: raw.recipient,
  };
}

// ------------------------------------------------------------------
// Audit
// ------------------------------------------------------------------
export function normalizeAuditEvent(raw: AnyRecord): AuditEvent {
  return {
    ...raw,
    seq: raw.seq,
    ts: raw.ts ?? raw.createdAt ?? '',
    actor: {
      id: raw.actor?.id ?? '',
      name: raw.actor?.name ?? '',
      role: raw.actor?.role ?? '',
    },
    action: raw.action ?? '',
    entity: { type: raw.entity?.type ?? '', id: raw.entity?.id?.toString?.() ?? '' },
    payload: raw.payload ?? {},
    prevHash: raw.prevHash ?? '',
    hash: raw.hash ?? '',
  } as AuditEvent;
}

export interface AuditVerifyView {
  intact: boolean;
  totalEvents?: number;
  brokenAtSeq?: number;
  reason?: string;
  verifiedAt?: string;
}

export function normalizeAuditVerify(raw: AnyRecord): AuditVerifyView {
  return {
    intact: raw.intact ?? raw.verified ?? false,
    totalEvents: raw.verifiedCount ?? raw.totalEvents,
    brokenAtSeq: raw.brokenAtSeq ?? raw.brokenSeq,
    reason: raw.reason,
    verifiedAt: raw.verifiedAt,
  };
}

// ------------------------------------------------------------------
// Risk score
// ------------------------------------------------------------------
export interface RiskScoreView extends RiskScoreBreakdown {
  /**
   * False when the server returned its placeholder object because no score has
   * been computed yet (backend returns 100/GREEN with no persisted document).
   */
  isComputed: boolean;
  calculatedAt?: string;
}

export function normalizeRiskScore(raw: AnyRecord): RiskScoreView {
  // The backend fallback has `application` set but no persisted `_id`/timestamps.
  const isBackendPlaceholder =
    raw.application !== undefined && raw._id === undefined && raw.createdAt === undefined;
  return {
    ...raw,
    deductions: Array.isArray(raw.deductions) ? raw.deductions : [],
    pillarScores: raw.pillarScores ?? {},
    isComputed: !isBackendPlaceholder,
    calculatedAt: raw.calculatedAt ?? raw.createdAt,
  } as RiskScoreView;
}

// ------------------------------------------------------------------
// Forensics: two shapes exist
//  A) contract/mock: ForensicsSuiteData
//  B) backend: { summary, documents[], photos[] }
// ------------------------------------------------------------------
export type ForensicsView =
  | { kind: 'suite'; data: ForensicsSuiteData }
  | {
      kind: 'documents';
      summary?: AnyRecord;
      documents: AnyRecord[];
      photos: AnyRecord[];
      faculty?: AnyRecord[];
    }
  | { kind: 'empty' };

export function normalizeForensics(raw: AnyRecord | undefined): ForensicsView {
  if (!raw) return { kind: 'empty' };
  if (Array.isArray(raw.pdfRevisions) || Array.isArray(raw.ela)) {
    return {
      kind: 'suite',
      data: {
        pdfRevisions: raw.pdfRevisions ?? [],
        ela: raw.ela ?? [],
        photos: raw.photos ?? [],
        perceptual: raw.perceptual ?? [],
        faculty: raw.faculty ?? [],
        blueprint: raw.blueprint ?? { claimedSqm: 0, detectedSqm: 0, rooms: [], isSimulated: true },
      },
    };
  }
  if (Array.isArray(raw.documents) || Array.isArray(raw.photos) || Array.isArray(raw.faculty)) {
    return {
      kind: 'documents',
      summary: raw.summary,
      documents: raw.documents ?? [],
      photos: raw.photos ?? [],
      faculty: raw.faculty ?? [],
    };
  }
  return { kind: 'empty' };
}

// ------------------------------------------------------------------
// Benchmark: contract/mock `results` vs backend `scores`
// ------------------------------------------------------------------
export interface BenchmarkView {
  runId: string;
  executedAt?: string;
  seed?: number;
  n?: number;
  manifestHash?: string;
  status?: string;
  /** Percentages 0-100, or undefined when the server did not report them */
  extractionAccuracy?: number;
  validationAccuracy?: number;
  falsePositiveRate?: number;
  avgVerificationTimeSec?: number;
  perFault: { label: string; precision?: number; recall?: number; f1?: number; tp?: number; fp?: number; fn?: number }[];
  raw: AnyRecord;
}

const pct = (v: unknown): number | undefined => {
  if (typeof v !== 'number' || Number.isNaN(v)) return undefined;
  return v <= 1 ? v * 100 : v;
};

export function normalizeBenchmarkRun(raw: AnyRecord): BenchmarkView {
  const r: AnyRecord = raw.results ?? raw.scores ?? {};
  const extraction =
    typeof r.extractionAccuracy === 'object' ? r.extractionAccuracy?.overall : r.extractionAccuracy;
  const avgSec =
    typeof r.avgVerificationTimeSec === 'number'
      ? r.avgVerificationTimeSec
      : typeof r.averageVerificationTimeMs === 'number'
        ? r.averageVerificationTimeMs / 1000
        : undefined;
  return {
    runId: raw.runId ?? raw.id ?? '',
    executedAt: raw.executedAt ?? raw.timestamp,
    seed: raw.seed,
    n: raw.n ?? raw.appsCount,
    manifestHash: raw.manifestHash,
    status: raw.status,
    extractionAccuracy: pct(extraction),
    validationAccuracy: pct(r.validationAccuracy),
    falsePositiveRate: pct(r.cleanAppFalsePositiveRate),
    avgVerificationTimeSec: avgSec,
    perFault: Array.isArray(r.perFault)
      ? r.perFault.map((f: AnyRecord) => ({
          label: f.faultType ?? f.ruleId ?? f.faultId ?? 'Fault',
          precision: pct(f.precision),
          recall: pct(f.recall),
          f1: pct(f.f1),
          tp: f.tp,
          fp: f.fp,
          fn: f.fn,
        }))
      : [],
    raw,
  };
}

// Re-export for convenience
export { SEVERITY_ORDER };
export type { BenchmarkRun };

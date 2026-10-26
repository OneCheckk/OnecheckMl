/**
 * OneCheck Shared API Contracts
 * Single source of truth for types between Backend, ML Service, and Frontend.
 * Follows OneCheck Build Specification for Antigravity, Part 1.6 & Part 3.
 */

export type VerificationStatus =
  | 'VERIFIED'
  | 'MISMATCH_DETECTED'
  | 'EXPIRED'
  | 'VERIFICATION_PENDING'
  | 'SOURCE_UNAVAILABLE'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'NOT_CHECKED'
  | 'BLOCKED_LOW_CONFIDENCE';

export type Band = 'RED' | 'YELLOW' | 'GREEN';

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FindingState = 'OPEN' | 'ACCEPTED' | 'DISMISSED' | 'CLARIFICATION_REQUESTED';

export type ApplicationStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'DEFICIENCY_RAISED'
  | 'APPROVED'
  | 'REJECTED';

export type UserRole =
  | 'PUBLIC'
  | 'INSTITUTION'
  | 'INSTITUTION_USER'
  | 'SCRUTINY_OFFICER'
  | 'OFFICER'
  | 'REGIONAL_DIRECTOR'
  | 'ADMIN'
  | 'AUDITOR';

export type ChecklistState = 'MISSING' | 'UPLOADED' | 'EXTRACTING' | 'DONE' | 'FAILED';

export type ValidityState = 'VALID' | 'LAPSES_IN_PERIOD' | 'EXPIRED';

export type SourceKind = 'LIVE' | 'SYNTHETIC_DEMO';

/** Bounding box in normalized coordinates [x0, y0, x1, y1] on a 1-based page, origin top-left */
export type BBox = [number, number, number, number];

export interface EvidenceSource {
  docId: string;
  page: number;
  bbox: BBox;
  snippet?: string;
  docType?: string;
}

export interface FindingEvidence {
  label: string;
  value: string | number;
  unit?: string;
  confidence: number;
  source: EvidenceSource;
}

export interface FindingProof {
  statement: string;
  evidence: FindingEvidence[];
  computation?: {
    formula: string;
    inputs: Record<string, number>;
    result: number;
  };
}

export interface Finding {
  findingId: string;
  applicationId: string;
  ruleId: string;
  ruleVersion: string;
  rulepackVersion: string;
  clauseRef: string;
  placeholder?: boolean;
  status: VerificationStatus;
  severity: Severity;
  state: FindingState;
  title: string;
  message: string;
  claimIds: string[];
  proof: FindingProof;
  createdAt: string;
  officerNotes?: string;
  dismissalReason?: string;
}

export interface Claim {
  claimId: string;
  applicationId: string;
  docId: string;
  predicate: string;
  predicateLabel: string;
  value: string | number;
  unit?: string;
  confidence: number;
  status: VerificationStatus;
  needsConfirmation?: boolean;
  source: EvidenceSource;
  confirmed?: boolean;
  originalValue?: string | number;
  correctionReason?: string;
}

export interface DocumentSignal {
  docId: string;
  signalType: string;
  title: string;
  description: string;
  severity: Severity;
  limitationText: string;
}

export interface PassedCheckTrace {
  ruleId: string;
  title: string;
  comparedValues: {
    field: string;
    valueA: string | number;
    valueB: string | number;
    status: 'MATCH';
  }[];
}

export interface Application {
  id: string;
  applicationNumber: string;
  institutionId: string;
  institutionName: string;
  category: string;
  status: ApplicationStatus;
  band?: Band;
  missingItemsCount: number;
  openFindingsCount: {
    info: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  pendingSourcesCount: number;
  claimsNeedingConfirmationCount: number;
  submittedAt?: string;
  submittedAge?: string;
  updatedAt: string;
  sortKey?: string;
  sourceLabel?: string;
}

export interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  clauseRef: string;
  required: boolean;
  placeholder?: boolean;
  state: ChecklistState;
  docType: string;
  docId?: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt?: string;
  processingProgress?: number;
}

export interface LedgerEntry {
  id: string;
  applicationId: string;
  docId: string;
  checkType: string;
  status: VerificationStatus;
  source: {
    label: string;
    kind: SourceKind;
  };
  requestedAt: string;
  respondedAt?: string;
  requestSummary: string;
  responseSummary: string;
  earlierResults?: {
    timestamp: string;
    status: VerificationStatus;
    note?: string;
  }[];
  manual?: {
    state: 'CONFIRMED' | 'REJECTED';
    officerId: string;
    note: string;
    timestamp: string;
  };
}

export interface ValidityRecord {
  docId: string;
  documentName: string;
  validFrom: string;
  validUntil: string;
  approvalPeriod: {
    start: string;
    end: string;
  };
  state: ValidityState;
  daysRemaining: number;
}

export interface DeficiencyLetter {
  id: string;
  applicationId: string;
  findingIds: string[];
  content: string;
  status: 'DRAFT' | 'SENT';
  createdAt: string;
  sentAt?: string;
  recipient: string;
}

export interface AuditEvent {
  seq: number;
  ts: string;
  actor: {
    id: string;
    name: string;
    role: string;
  };
  action: string;
  entity: {
    type: string;
    id: string;
  };
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface BenchmarkRun {
  runId: string;
  timestamp: string;
  n: number;
  seed: number;
  faultRate: number;
  scanRatio: number;
  manifestHash: string;
  status: 'RUNNING' | 'COMPLETED';
  results?: {
    extractionAccuracy: number;
    validationAccuracy: number;
    cleanAppFalsePositiveRate: number;
    avgVerificationTimeSec: number;
    scanVsTextAccuracy: {
      scan: number;
      text: number;
    };
    alertTimelinessMin: number;
    perFault: {
      faultType: string;
      precision: number;
      recall: number;
      f1: number;
      tp: number;
      fp: number;
      fn: number;
    }[];
  };
}

export interface Alert {
  id: string;
  type: string;
  severity: Severity;
  message: string;
  applicationId: string;
  dueAt?: string;
  raisedAt: string;
  acknowledged: boolean;
}

export interface OfficerDashboardSummary {
  bandCounts: {
    RED: number;
    YELLOW: number;
    GREEN: number;
  };
  pendingSourceVerifications: number;
  oldestUnresolvedDays: number;
  avgTimePerStageDays: number;
}

export interface DemoSettings {
  enabled: boolean;
  decisionDateOffsetDays: number;
  forceSourceUnavailable: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
    };
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field?: string; message: string }[];
  };
  meta?: {
    requestId: string;
  };
}

export interface ClaimRecheckResult {
  rulesRerun: number;
  rulesTotal: number;
  closed: number;
  opened: number;
  changed: number;
}

// ==========================================
// Integration Extensions: Institutions, Triangle, Forensics & Risk
// ==========================================

export interface Institution {
  id: string;
  name: string;
  registrationId: string;
  address: string;
  state: string;
  latitude: number;
  longitude: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface TriangleNode {
  source: 'COLLEGE_CLAIM' | 'DOCUMENT_OCR' | 'AICTE_RECORDS';
  value: string;
}

export interface TriangleFinding {
  id: string;
  title: string;
  claimKey: string;
  nodes: [TriangleNode, TriangleNode, TriangleNode];
  status: VerificationStatus;
  explanation: string;
  handbookClause: string;
  evidencePage: string;
}

export interface PdfRevision {
  stream: number;
  savedAt: string;
  tool: string;
  note: string;
  suspicious: boolean;
}

export interface ElaFlaggedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface ElaResult {
  documentId: string;
  documentName: string;
  score: number;
  flaggedRegions: ElaFlaggedRegion[];
  isSimulated: boolean;
}

export interface BlueprintRoom {
  name: string;
  sqm: number;
}

export interface BlueprintResult {
  claimedSqm: number;
  detectedSqm: number;
  rooms: BlueprintRoom[];
  isSimulated: boolean;
}

export interface InfraPhoto {
  id: string;
  photoType: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  distanceFromCampus: number | null;
  geofenceStatus: 'PASS' | 'FAIL' | 'NO_GPS_DATA';
  imageHash: string | null;
  isStockImage: boolean;
}

export interface PerceptualMatch {
  photoId: string;
  hash64: string;
  matchedInstitution: string | null;
  hammingDistance: number | null;
  isStockImage: boolean;
}

export interface FacultyMatch {
  id: string;
  nameNormalized: string;
  identifierType: 'AADHAAR' | 'PAN';
  isGhostFlagged: boolean;
  matchInstitutionName: string | null;
  matchConfidence: number | null;
}

export interface ForensicsSuiteData {
  pdfRevisions: PdfRevision[];
  ela: ElaResult[];
  photos: InfraPhoto[];
  perceptual: PerceptualMatch[];
  faculty: FacultyMatch[];
  blueprint: BlueprintResult;
}

export interface PillarScores {
  documentCompleteness: number;
  anomalyFlags: number;
  sourceVerification: number;
  historicalCompliance: number;
  infrastructureEvidence: number;
}

export interface RiskDeduction {
  ruleId: string;
  pillar: string;
  points: number;
  explanation: string;
  handbookRef: string | null;
}

export interface RiskScoreBreakdown {
  applicationId: string;
  totalScore: number;
  riskLevel: Band;
  pillarScores: PillarScores;
  deductions: RiskDeduction[];
  rulesVersion: string;
}

export interface CheckRunStep {
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNAVAILABLE';
}

export interface CheckRun {
  runId: string;
  status: 'QUEUED' | 'RUNNING' | 'PARTIAL' | 'SUCCEEDED' | 'FAILED';
  steps: CheckRunStep[];
}

export type AppPermission =
  | 'CREATE_APPLICATION'
  | 'SUBMIT_APPLICATION'
  | 'UPLOAD_DOCUMENT'
  | 'INSPECT_DOCUMENT'
  | 'RUN_SCRUTINY_CHECKS'
  | 'DECIDE_MANUAL_REVIEW'
  | 'VIEW_ALL_APPLICATIONS'
  | 'VIEW_ALERTS_QUEUE'
  | 'UPDATE_ALERT'
  | 'VIEW_FORENSICS'
  | 'VIEW_SYSTEM_HEALTH'
  | 'VIEW_FULL_AUDIT'
  | 'MANAGE_USERS';


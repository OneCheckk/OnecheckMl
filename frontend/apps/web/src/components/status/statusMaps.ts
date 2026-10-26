/**
 * Centralised, explicit status mappings.
 *
 * Each concept has its own map. They are intentionally NOT shared, because
 * "Verified" in the verification ledger, "Verified" as an application lifecycle
 * stage and "Succeeded" for a check run mean different things.
 *
 * Underlying enum values are never changed; only the human label, tone and
 * icon are derived here. Unknown values fall back to a neutral "unknown" tone,
 * never to success.
 */

export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'review' | 'muted';

export type IconKey =
  | 'check'
  | 'x'
  | 'clock'
  | 'hourglass'
  | 'cloud-off'
  | 'eye'
  | 'minus'
  | 'help'
  | 'alert'
  | 'shield'
  | 'file'
  | 'send'
  | 'play'
  | 'loader'
  | 'ban'
  | 'info';

export interface StatusDescriptor {
  label: string;
  tone: Tone;
  icon: IconKey;
  description?: string;
}

const UNKNOWN = (value: string): StatusDescriptor => ({
  label: value ? value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'Unknown',
  tone: 'muted',
  icon: 'help',
  description: 'Status value not recognised by this interface.',
});

// 1. Finding / ledger / claim verification outcome (contracts VerificationStatus)
export const VERIFICATION_STATUS: Record<string, StatusDescriptor> = {
  VERIFIED: { label: 'Verified', tone: 'ok', icon: 'check', description: 'Values agree across the compared sources.' },
  MISMATCH_DETECTED: { label: 'Mismatch detected', tone: 'bad', icon: 'x', description: 'Compared sources disagree.' },
  EXPIRED: { label: 'Expired', tone: 'bad', icon: 'clock', description: 'Certificate is expired or lapses within the approval period.' },
  VERIFICATION_PENDING: { label: 'Verification pending', tone: 'info', icon: 'hourglass', description: 'Check queued or awaiting a response.' },
  SOURCE_UNAVAILABLE: { label: 'Source unavailable', tone: 'warn', icon: 'cloud-off', description: 'External source could not be reached; routed to officer review. Not a verification.' },
  MANUAL_REVIEW_REQUIRED: { label: 'Manual review required', tone: 'review', icon: 'eye', description: 'An authorised officer must decide.' },
  NOT_CHECKED: { label: 'Not checked', tone: 'muted', icon: 'minus', description: 'No check has been run for this item.' },
  BLOCKED_LOW_CONFIDENCE: { label: 'Needs confirmation', tone: 'warn', icon: 'help', description: 'Extraction confidence is low; a person must confirm the value.' },
};

// 2. Document verification status (backend Document.verificationStatus)
export const DOCUMENT_VERIFICATION_STATUS: Record<string, StatusDescriptor> = {
  PENDING: { label: 'Pending', tone: 'info', icon: 'hourglass' },
  VERIFIED_AT_SOURCE: { label: 'Verified at source', tone: 'ok', icon: 'check' },
  MISMATCH_DETECTED: { label: 'Mismatch detected', tone: 'bad', icon: 'x' },
  EXPIRED: { label: 'Expired', tone: 'bad', icon: 'clock' },
  UNAVAILABLE: { label: 'Source unavailable', tone: 'warn', icon: 'cloud-off' },
  MANUAL_REVIEW: { label: 'Manual review', tone: 'review', icon: 'eye' },
};

// 3. Document storage (upload) status — storage, not analysis
export const DOCUMENT_UPLOAD_STATUS: Record<string, StatusDescriptor> = {
  UPLOADING: { label: 'Uploading', tone: 'info', icon: 'loader' },
  STORED: { label: 'Stored', tone: 'muted', icon: 'file' },
  REJECTED: { label: 'Rejected by server', tone: 'bad', icon: 'x' },
  DELETED: { label: 'Deleted', tone: 'muted', icon: 'minus' },
};

// 4. Checklist item state (storage + analysis progress)
export const CHECKLIST_STATE: Record<string, StatusDescriptor> = {
  MISSING: { label: 'Not uploaded', tone: 'warn', icon: 'minus' },
  UPLOADED: { label: 'Uploaded', tone: 'muted', icon: 'file' },
  EXTRACTING: { label: 'Analysis in progress', tone: 'info', icon: 'loader' },
  DONE: { label: 'Analysed', tone: 'ok', icon: 'check' },
  FAILED: { label: 'Analysis failed', tone: 'bad', icon: 'x' },
};

// 5. Application lifecycle (union of backend + contract values)
export const APPLICATION_STATUS: Record<string, StatusDescriptor> = {
  DRAFT: { label: 'Draft', tone: 'muted', icon: 'file' },
  SUBMITTED: { label: 'Submitted', tone: 'info', icon: 'send' },
  PROCESSING: { label: 'Processing', tone: 'info', icon: 'loader' },
  READY_FOR_REVIEW: { label: 'Ready for review', tone: 'info', icon: 'eye' },
  UNDER_SCRUTINY: { label: 'Under scrutiny', tone: 'info', icon: 'eye' },
  CLARIFICATION_REQUESTED: { label: 'Clarification requested', tone: 'warn', icon: 'alert' },
  DEFICIENCY_RAISED: { label: 'Deficiency raised', tone: 'warn', icon: 'alert' },
  DEFICIENCY_LETTER_ISSUED: { label: 'Deficiency letter issued', tone: 'warn', icon: 'alert' },
  VERIFIED: { label: 'Scrutiny completed', tone: 'ok', icon: 'check', description: 'Checks completed; final decision may still be pending.' },
  DECIDED: { label: 'Decision recorded', tone: 'muted', icon: 'shield' },
  APPROVED: { label: 'Approved', tone: 'ok', icon: 'check' },
  REJECTED: { label: 'Rejected', tone: 'bad', icon: 'ban' },
};

// 6. Check-run status and step status
export const CHECK_RUN_STATUS: Record<string, StatusDescriptor> = {
  QUEUED: { label: 'Queued', tone: 'info', icon: 'hourglass' },
  RUNNING: { label: 'Running', tone: 'info', icon: 'loader' },
  PARTIAL: { label: 'Partially completed', tone: 'warn', icon: 'alert', description: 'Some steps could not complete.' },
  SUCCEEDED: { label: 'Completed', tone: 'ok', icon: 'check' },
  FAILED: { label: 'Failed', tone: 'bad', icon: 'x' },
};

export const CHECK_STEP_STATUS: Record<string, StatusDescriptor> = {
  PENDING: { label: 'Pending', tone: 'muted', icon: 'minus' },
  RUNNING: { label: 'Running', tone: 'info', icon: 'loader' },
  SUCCEEDED: { label: 'Done', tone: 'ok', icon: 'check' },
  FAILED: { label: 'Failed', tone: 'bad', icon: 'x' },
  UNAVAILABLE: { label: 'Service unavailable', tone: 'warn', icon: 'cloud-off' },
};

// 7. Alert workflow status
export const ALERT_STATUS: Record<string, StatusDescriptor> = {
  OPEN: { label: 'Open', tone: 'bad', icon: 'alert' },
  ACKNOWLEDGED: { label: 'Acknowledged', tone: 'info', icon: 'eye' },
  RESOLVED: { label: 'Resolved', tone: 'ok', icon: 'check' },
  FALSE_POSITIVE: { label: 'Marked false positive', tone: 'muted', icon: 'minus' },
};

// 8. Finding disposition state
export const FINDING_STATE: Record<string, StatusDescriptor> = {
  OPEN: { label: 'Open', tone: 'warn', icon: 'alert' },
  ACCEPTED: { label: 'Accepted by officer', tone: 'info', icon: 'check' },
  DISMISSED: { label: 'Dismissed', tone: 'muted', icon: 'minus' },
  CLARIFICATION_REQUESTED: { label: 'Clarification requested', tone: 'info', icon: 'send' },
  RESOLVED: { label: 'Resolved', tone: 'ok', icon: 'check' },
};

// 9. Severity
export const SEVERITY: Record<string, StatusDescriptor> = {
  CRITICAL: { label: 'Critical', tone: 'bad', icon: 'alert' },
  HIGH: { label: 'High', tone: 'bad', icon: 'alert' },
  MEDIUM: { label: 'Medium', tone: 'warn', icon: 'alert' },
  LOW: { label: 'Low', tone: 'muted', icon: 'info' },
  INFO: { label: 'Info', tone: 'muted', icon: 'info' },
};

// 10. Risk band (decision-support signal, not a decision)
export const RISK_BAND: Record<string, StatusDescriptor> = {
  RED: { label: 'High priority', tone: 'bad', icon: 'shield', description: 'Risk score below 50' },
  YELLOW: { label: 'Needs attention', tone: 'warn', icon: 'alert', description: 'Risk score 50–79' },
  GREEN: { label: 'Routine', tone: 'ok', icon: 'check', description: 'Risk score 80 or above' },
};

// 11. Validity window state
export const VALIDITY_STATE: Record<string, StatusDescriptor> = {
  VALID: { label: 'Valid through period', tone: 'ok', icon: 'check' },
  LAPSES_IN_PERIOD: { label: 'Lapses within approval period', tone: 'warn', icon: 'clock' },
  EXPIRED: { label: 'Expired', tone: 'bad', icon: 'clock' },
};

// 12. Geofence result
export const GEOFENCE_STATUS: Record<string, StatusDescriptor> = {
  PASS: { label: 'Within 500 m of campus', tone: 'ok', icon: 'check' },
  WITHIN_CAMPUS: { label: 'Within campus radius', tone: 'ok', icon: 'check' },
  FAIL: { label: 'Outside campus radius', tone: 'bad', icon: 'x' },
  OUTSIDE_CAMPUS: { label: 'Outside campus radius', tone: 'bad', icon: 'x' },
  NO_GPS_DATA: { label: 'No GPS metadata', tone: 'warn', icon: 'help' },
};

export type StatusDomain =
  | 'verification'
  | 'document'
  | 'upload'
  | 'checklist'
  | 'application'
  | 'checkRun'
  | 'checkStep'
  | 'alert'
  | 'finding'
  | 'severity'
  | 'band'
  | 'validity'
  | 'geofence';

const DOMAINS: Record<StatusDomain, Record<string, StatusDescriptor>> = {
  verification: VERIFICATION_STATUS,
  document: DOCUMENT_VERIFICATION_STATUS,
  upload: DOCUMENT_UPLOAD_STATUS,
  checklist: CHECKLIST_STATE,
  application: APPLICATION_STATUS,
  checkRun: CHECK_RUN_STATUS,
  checkStep: CHECK_STEP_STATUS,
  alert: ALERT_STATUS,
  finding: FINDING_STATE,
  severity: SEVERITY,
  band: RISK_BAND,
  validity: VALIDITY_STATE,
  geofence: GEOFENCE_STATUS,
};

export function describeStatus(domain: StatusDomain, value: string | null | undefined): StatusDescriptor {
  if (value === null || value === undefined || value === '') {
    return { label: 'Not available', tone: 'muted', icon: 'minus' };
  }
  return DOMAINS[domain][value] ?? UNKNOWN(String(value));
}

/** Tailwind classes per tone (text / background / border). */
export const TONE_CLASSES: Record<Tone, string> = {
  ok: 'text-ok bg-ok-bg border-ok-line',
  bad: 'text-bad bg-bad-bg border-bad-line',
  warn: 'text-warn bg-warn-bg border-warn-line',
  info: 'text-info bg-info-bg border-info-line',
  review: 'text-review bg-review-bg border-review-line',
  muted: 'text-muted bg-muted-bg border-muted-line',
};

export const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-ok',
  bad: 'text-bad',
  warn: 'text-warn',
  info: 'text-info',
  review: 'text-review',
  muted: 'text-muted',
};

/** Human label for enum-like codes (e.g. EOA_INTAKE_INCREASE → "EOA intake increase"). */
export function humanize(code: string | undefined | null): string {
  if (!code) return '';
  const s = code.replace(/_/g, ' ').toLowerCase();
  return s
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\beoa\b/gi, 'EoA')
    .replace(/\bnoc\b/gi, 'NOC')
    .replace(/\bter\b/gi, 'TER')
    .replace(/\bpdf\b/gi, 'PDF')
    .replace(/\bela\b/gi, 'ELA')
    .replace(/\bocr\b/gi, 'OCR')
    .replace(/\baicte\b/gi, 'AICTE');
}

/** Labels for backend application categories (from /api/categories). */
export const CATEGORY_LABELS: Record<string, string> = {
  EOA_CONTINUATION: 'Extension of Approval — Continuation',
  EOA_INTAKE_INCREASE: 'Extension of Approval — Intake increase',
  EOA_NEW_COURSE: 'Extension of Approval — New course',
  ENGINEERING_UNDERGRADUATE: 'Engineering & Technology (UG)',
  MANAGEMENT_POSTGRADUATE: 'Management Studies (PG)',
  PHARMACY_DIPLOMA: 'Pharmacy (Diploma / B.Pharm)',
};

export const categoryLabel = (code?: string) => (code ? CATEGORY_LABELS[code] ?? humanize(code) : '—');

/** Role labels (display only; authorisation never reads these). */
export const ROLE_LABELS: Record<string, string> = {
  INSTITUTION: 'Institution user',
  INSTITUTION_USER: 'Institution user',
  SCRUTINY_OFFICER: 'Scrutiny officer',
  OFFICER: 'Scrutiny officer',
  REGIONAL_DIRECTOR: 'Regional director',
  ADMIN: 'Administrator',
  AUDITOR: 'Auditor',
  PUBLIC: 'Public',
};

export const roleLabel = (role?: string) => (role ? ROLE_LABELS[role] ?? humanize(role) : '');

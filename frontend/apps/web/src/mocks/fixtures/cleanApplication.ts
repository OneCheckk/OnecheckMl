import type { Application, Finding, Claim, ChecklistItem, LedgerEntry, ValidityRecord } from '@contracts';

export const cleanApplication: Application = {
  id: 'app-clean-200',
  applicationNumber: 'AICTE-2026-WRO-4102',
  institutionId: 'inst-002',
  institutionName: 'Sardar Patel College of Engineering & Research',
  category: 'MANAGEMENT_POSTGRADUATE',
  status: 'READY_FOR_REVIEW',
  band: 'GREEN',
  missingItemsCount: 0,
  openFindingsCount: {
    info: 1,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  },
  pendingSourcesCount: 0,
  claimsNeedingConfirmationCount: 0,
  submittedAt: '2026-10-23T11:00:00Z',
  submittedAge: '1 day ago',
  updatedAt: '2026-10-24T10:00:00Z',
  sortKey: 'GREEN_0',
  sourceLabel: 'DEMO ADAPTER - simulated source',
};

export const cleanFindings: Finding[] = [
  {
    findingId: 'F-CLN-01',
    applicationId: 'app-clean-200',
    ruleId: 'CURRICULUM-CREDITS-001',
    ruleVersion: '1',
    rulepackVersion: '2026.1-demo',
    clauseRef: 'APH-2026-CL-8.3',
    status: 'VERIFIED',
    severity: 'INFO',
    state: 'OPEN',
    title: 'Elective credit allocation complies with AICTE model curriculum',
    message: 'The submitted syllabus reflects 102 total credits, exceeding the minimum baseline of 96 credits.',
    claimIds: ['C-CLN-10'],
    proof: {
      statement: 'total_curriculum_credits (102) >= mandatory_min (96)',
      evidence: [
        {
          label: 'Academic Brochure, p.6',
          value: 102,
          unit: 'credits',
          confidence: 0.99,
          source: {
            docId: 'D1',
            page: 1,
            bbox: [0.1, 0.4, 0.8, 0.5],
            snippet: 'Total Credits across 4 semesters: 102',
            docType: 'CURRICULUM_OUTLINE',
          },
        },
      ],
    },
    createdAt: '2026-10-24T10:00:00Z',
  },
];

export const cleanClaims: Claim[] = [
  {
    claimId: 'C-CLN-10',
    applicationId: 'app-clean-200',
    docId: 'D1',
    predicate: 'total_curriculum_credits',
    predicateLabel: 'Total Curriculum Credits',
    value: 102,
    unit: 'credits',
    confidence: 0.99,
    status: 'VERIFIED',
    source: {
      docId: 'D1',
      page: 1,
      bbox: [0.1, 0.4, 0.8, 0.5],
      snippet: 'Total Credits across 4 semesters: 102',
    },
  },
];

export const cleanChecklist: ChecklistItem[] = [
  {
    id: 'chk-c1',
    category: 'MANAGEMENT_POSTGRADUATE',
    label: 'Mandatory Disclosure Document',
    clauseRef: 'APH-2026-APP-1',
    required: true,
    state: 'DONE',
    docType: 'MANDATORY_DISCLOSURE',
    docId: 'D1',
    fileName: 'Sardar_Patel_Disclosure_2026.pdf',
    uploadedAt: '2026-10-23T10:15:00Z',
  },
  {
    id: 'chk-c2',
    category: 'MANAGEMENT_POSTGRADUATE',
    label: 'AICTE Fee Remittance Proof',
    clauseRef: 'APH-2026-APP-4',
    required: true,
    state: 'DONE',
    docType: 'PAYMENT_RECEIPT',
    docId: 'D2',
    fileName: 'Payment_Advice_Verified.pdf',
    uploadedAt: '2026-10-23T10:20:00Z',
  },
];

export const cleanLedger: LedgerEntry[] = [
  {
    id: 'led-c1',
    applicationId: 'app-clean-200',
    docId: 'D1',
    checkType: 'AICTE_CENTRAL_REGISTRY',
    status: 'VERIFIED',
    source: {
      label: 'DEMO ADAPTER - simulated source',
      kind: 'SYNTHETIC_DEMO',
    },
    requestedAt: '2026-10-23T11:01:00Z',
    respondedAt: '2026-10-23T11:01:02Z',
    requestSummary: 'Verified affiliation with University of Mumbai.',
    responseSummary: 'Active autonomous accreditation confirmed.',
  },
];

export const cleanValidity: ValidityRecord[] = [
  {
    docId: 'D1',
    documentName: 'University Affiliation Certificate',
    validFrom: '2024-06-01',
    validUntil: '2029-05-31',
    approvalPeriod: { start: '2026-07-01', end: '2027-06-30' },
    state: 'VALID',
    daysRemaining: 948,
  },
];

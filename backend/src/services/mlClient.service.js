/**
 * OneCheck Resilient Typed ML Service Client
 * Adheres strictly to Section 0.8 & Part 2 contract.
 * Uses HTTP requests to FastAPI ML service with deterministic fallback fixtures for testing and demo modes.
 */

const env = require('../config/env');
const logger = require('../config/logger');

class MlClient {
  constructor() {
    this.baseUrl = env.ML_BASE_URL;
    this.timeoutMs = env.VERIFICATION_TIMEOUT_MS || 30000;
    this.isMock = env.MOCK_VERIFICATION_SERVICE;
  }

  async _post(endpoint, payload, requestId = null) {
    if (this.isMock) {
      return this._mockHandler(endpoint, payload);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (requestId) {
        headers['X-Request-Id'] = requestId;
      }

      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ML service HTTP ${res.status}: ${text}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError';
      logger.warn(`ML service call failed [${endpoint}]: ${err.message}`, { isTimeout });
      // In development or test, fall back to mock fixtures if external ML container is not up
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Falling back to deterministic ML fixture for ${endpoint}`);
        return this._mockHandler(endpoint, payload);
      }
      throw err;
    }
  }

  async _get(endpoint, requestId = null) {
    if (this.isMock) {
      return this._mockHandler(endpoint, {});
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers = {};
      if (requestId) headers['X-Request-Id'] = requestId;

      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timer);
      if (!res.ok) throw new Error(`ML service HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (process.env.NODE_ENV !== 'production') {
        return this._mockHandler(endpoint, {});
      }
      throw err;
    }
  }

  // Contract Methods

  async health(requestId = null) {
    return this._get('/health', requestId);
  }

  async analyzeDocument({ docId, filePath, mime, hintDocType, site, originalName }, requestId = null) {
    return this._post('/v1/document/analyze', { docId, filePath, mime, hintDocType, site, originalName }, requestId);
  }

  async compareForensics({ docId, textMinhash, imagePhash, candidates, thresholds }, requestId = null) {
    return this._post('/v1/forensics/compare', { docId, textMinhash, imagePhash, candidates, thresholds }, requestId);
  }

  async registerRulepack({ version, yaml }, requestId = null) {
    return this._post('/v1/rulepacks/register', { version, yaml }, requestId);
  }

  async listRulepacks(requestId = null) {
    return this._get('/v1/rulepacks', requestId);
  }

  async getRulesIndex(rulepackVersion, requestId = null) {
    return this._get(`/v1/rules/index?rulepackVersion=${encodeURIComponent(rulepackVersion)}`, requestId);
  }

  async reconcile(payload, requestId = null) {
    return this._post('/v1/reconcile', payload, requestId);
  }

  async generateBenchmark(payload, requestId = null) {
    return this._post('/v1/benchmark/generate', payload, requestId);
  }

  async scoreBenchmark(payload, requestId = null) {
    return this._post('/v1/benchmark/score', payload, requestId);
  }

  // Deterministic Mock Fixtures adhering to Section 0.8 & Part 4 planted-fault demo case
  _mockHandler(endpoint, payload) {
    if (endpoint === '/health') {
      return {
        status: 'UP',
        version: '1.0.0',
        tesseract: ['eng', 'hin'],
        classifier: 'keywords'
      };
    }

    if (endpoint === '/v1/document/analyze') {
      const docType = payload.hintDocType || 'SELF_DISCLOSURE_FORM';
      return this._mockAnalyzeResponse(payload.docId, docType, payload.originalName || payload.filePath);
    }

    if (endpoint === '/v1/forensics/compare') {
      return {
        docId: payload.docId,
        signals: []
      };
    }

    if (endpoint.startsWith('/v1/rules/index')) {
      return {
        predicates: {
          lab_area_sqm_total: ['AREA-CONSIST-001'],
          intake_requested: ['INTAKE-CONT-002', 'INTAKE-GROWTH-003', 'FSR-004'],
          faculty_count_listed: ['FSR-004', 'FACULTY-COUNT-005'],
          faculty_count_declared: ['FACULTY-COUNT-005'],
          ter_payment_status_claimed: ['TER-STATUS-006'],
          deficiency_declared_cleared: ['DEFICIENCY-007'],
          noc_valid_until: ['NOC-VALIDITY-008', 'NOC-DATES-012'],
          noc_issue_date: ['NOC-DATES-012'],
          accreditation_valid_until: ['ACCRED-VALIDITY-009'],
          faculty_experience_years_claimed: ['FACULTY-TIMELINE-010'],
          institution_id: ['ID-CONSIST-011'],
          institution_name: ['ID-CONSIST-011']
        },
        dateDependent: ['NOC-VALIDITY-008', 'ACCRED-VALIDITY-009']
      };
    }

    if (endpoint === '/v1/rulepacks/register') {
      return {
        success: true,
        version: payload.version,
        sha256: 'mock_rulepack_sha256_hash',
        rulesCount: 12
      };
    }

    if (endpoint === '/v1/rulepacks') {
      return [
        { version: '2026.1-demo', sha256: 'mock_rulepack_sha256_hash', active: true }
      ];
    }

    if (endpoint === '/v1/reconcile') {
      return this._mockReconcileResponse(payload);
    }

    if (endpoint === '/v1/benchmark/generate') {
      return {
        runId: 'bench_run_' + Date.now(),
        seed: payload.seed || 42,
        manifestHash: 'synthetic_manifest_hash_seed_' + (payload.seed || 42),
        appsCount: payload.n || 2
      };
    }

    if (endpoint === '/v1/benchmark/score') {
      return {
        extractionAccuracy: { overall: 0.96, textLayer: 0.99, scan: 0.93 },
        validationAccuracy: 0.98,
        cleanAppFalsePositiveRate: 0.0,
        averageVerificationTimeMs: 1420,
        alertTimelinessSeconds: { median: 1.2, p95: 3.5 },
        perFault: [
          { faultId: 'F1', ruleId: 'AREA-CONSIST-001', precision: 1.0, recall: 1.0, f1: 1.0 },
          { faultId: 'F2', ruleId: 'INTAKE-CONT-002', precision: 1.0, recall: 1.0, f1: 1.0 },
          { faultId: 'F3', ruleId: 'FSR-004', precision: 1.0, recall: 1.0, f1: 1.0 },
          { faultId: 'F4', ruleId: 'NOC-VALIDITY-008', precision: 1.0, recall: 1.0, f1: 1.0 },
          { faultId: 'F6', ruleId: 'TER-STATUS-006', precision: 1.0, recall: 1.0, f1: 1.0 }
        ]
      };
    }

    return { success: true };
  }

  _mockAnalyzeResponse(docId, docType, filePath = '') {
    const defaultClaims = [];
    let forensics = [];
    let warnings = [];
    const isClean = typeof filePath === 'string' && filePath.toLowerCase().includes('clean');

    if (docType === 'SELF_DISCLOSURE_FORM') {
      const intake = isClean ? 120 : 180;
      defaultClaims.push(
        { subject: 'institution', predicate: 'institution_name', value: isClean ? 'Bharti Institute of Science & Research (Synthetic)' : 'Apex Institute of Technology (Synthetic)', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.99, rawText: isClean ? 'Bharti Institute of Science & Research' : 'Apex Institute of Technology' },
        { subject: 'institution', predicate: 'institution_id', value: isClean ? 'AICTE-MAH-2026-02' : 'AICTE-DEL-2026-01', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.98, rawText: isClean ? 'AICTE-MAH-2026-02' : 'AICTE-DEL-2026-01' },
        { subject: 'institution', predicate: 'lab_area_sqm_total', value: 640, unit: 'sqm', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.97, rawText: '640 sq m' },
        { subject: 'institution', predicate: 'intake_requested', value: intake, origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.95, rawText: `${intake} seats` },
        { subject: 'institution', predicate: 'faculty_count_declared', value: 6, origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.96, rawText: '6 faculty members' },
        { subject: 'institution', predicate: 'ter_payment_status_claimed', value: 'PAID', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.98, rawText: 'Payment Confirmed: PAID' },
        { subject: 'institution', predicate: 'deficiency_declared_cleared', value: true, origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.94, rawText: 'All previous deficiencies cleared: Yes' }
      );
    } else if (docType === 'BUILDING_PLAN') {
      const planArea = isClean ? 640 : 410;
      if (!isClean) {
        warnings = ['PDF incremental save detected', 'Font anomaly detected'];
        forensics = [
          { signal: 'INCREMENTAL_SAVE_DETECTED', details: 'PDF contains incremental update sections' },
          { signal: 'FONT_ANOMALY', details: 'Non-embedded glyphs in text layer' }
        ];
      }
      defaultClaims.push(
        { subject: 'institution', predicate: 'institution_name', value: isClean ? 'Bharti Institute of Science & Research (Synthetic)' : 'Apex Institute of Technology (Synthetic)', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.98 },
        { subject: 'institution', predicate: 'institution_id', value: isClean ? 'AICTE-MAH-2026-02' : 'AICTE-DEL-2026-01', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.97 },
        { subject: 'institution', predicate: 'lab_area_sqm_total', value: planArea, unit: 'sqm', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.91, rawText: `Laboratories (total): ${planArea} sqm` },
        { subject: 'institution', predicate: 'built_up_area_sqm', value: 4500, unit: 'sqm', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.95, rawText: '4,500 sq m' }
      );
    } else if (docType === 'FACULTY_LIST') {
      defaultClaims.push(
        { subject: 'institution', predicate: 'institution_id', value: isClean ? 'AICTE-MAH-2026-02' : 'AICTE-DEL-2026-01', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.98 },
        { subject: 'institution', predicate: 'faculty_count_listed', value: 6, origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.98, rawText: 'Total Listed Faculty: 6' }
      );
    } else if (docType === 'FIRE_NOC') {
      const nocValid = isClean ? '2028-12-31' : '2026-10-31';
      defaultClaims.push(
        { subject: 'institution', predicate: 'institution_name', value: isClean ? 'Bharti Institute of Science & Research (Synthetic)' : 'Apex Institute of Technology (Synthetic)', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.97 },
        { subject: 'institution', predicate: 'noc_certificate_no', value: isClean ? 'NOC-CLEAN-2026-1234' : 'NOC-UP-2024-9988', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.99, rawText: isClean ? 'NOC No. NOC-CLEAN-2026-1234' : 'NOC No. NOC-UP-2024-9988' },
        { subject: 'institution', predicate: 'noc_issue_date', value: '2024-01-15', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.96, rawText: '15/01/2024' },
        { subject: 'institution', predicate: 'noc_valid_until', value: nocValid, origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.95, rawText: nocValid }
      );
    } else if (docType === 'TER_PAYMENT_RECEIPT') {
      defaultClaims.push(
        { subject: 'institution', predicate: 'ter_payment_status_claimed', value: 'PAID', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.99, rawText: 'TER Status: PAID' }
      );
    } else if (docType === 'ACCREDITATION_CERT') {
      defaultClaims.push(
        { subject: 'institution', predicate: 'accreditation_valid_until', value: '2027-12-31', origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.97, rawText: 'Valid Upto: 31-12-2027' }
      );
    } else if (docType === 'FACULTY_CV') {
      defaultClaims.push(
        { subject: 'faculty:dr-ramesh-sharma', predicate: 'faculty_degree_year', value: 2018, origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.95, rawText: 'Ph.D. completed in 2018' },
        { subject: 'faculty:dr-ramesh-sharma', predicate: 'faculty_experience_years_claimed', value: 15, origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.93, rawText: '15 years teaching experience' },
        { subject: 'faculty:dr-ramesh-sharma', predicate: 'faculty_as_of_year', value: 2026, origin: 'DOCUMENT', method: 'TEXT_LAYER', confidence: 0.99, rawText: 'As on 2026' }
      );
    }

    return {
      docId,
      docType,
      typeConfidence: 0.98,
      pageCount: 1,
      method: 'TEXT_LAYER',
      claims: defaultClaims.map((c) => ({
        ...c,
        source: {
          docId,
          page: 1,
          bbox: [0.1, 0.2, 0.5, 0.3],
          snippet: c.rawText || `${c.predicate}: ${c.value}`,
          docType
        }
      })),
      forensics,
      fingerprints: {
        sha256: 'mock_sha256_' + docId,
        textMinhash: [12, 34, 56, 78],
        imagePhash: 'a1b2c3d4e5f6'
      },
      warnings,
      timings: { totalMs: 145 }
    };
  }

  _mockReconcileResponse(payload) {
    const claims = payload.claims || [];
    const findings = [];
    const trace = [];

    // Rule 1: AREA-CONSIST-001 (Form vs Plan lab area)
    const formAreaClaim = claims.find((c) => c.predicate === 'lab_area_sqm_total' && c.source?.docType === 'SELF_DISCLOSURE_FORM');
    const planAreaClaim = claims.find((c) => c.predicate === 'lab_area_sqm_total' && c.source?.docType === 'BUILDING_PLAN');

    if (formAreaClaim && planAreaClaim) {
      const formVal = Number(formAreaClaim.value);
      const planVal = Number(planAreaClaim.value);
      const diffPct = Math.round(Math.abs(formVal - planVal) / planVal * 100);

      if (diffPct > 2) {
        findings.push({
          ruleId: 'AREA-CONSIST-001',
          ruleVersion: '1',
          rulepackVersion: '2026.1-demo',
          clauseRef: 'HANDBOOK-REF-TBD',
          placeholder: true,
          status: 'MISMATCH_DETECTED',
          severity: 'HIGH',
          title: 'Laboratory area differs between application form and building plan',
          message: `Laboratory area is ${formVal} sqm in the form but ${planVal} sqm in the plan (difference ${diffPct}%).`,
          claimIds: [formAreaClaim.claimId, planAreaClaim.claimId].filter(Boolean),
          proof: {
            statement: 'lab_area_sqm_total differs between documents beyond the 2% tolerance',
            evidence: [
              { label: 'Self-disclosure form, p.1', value: formVal, unit: 'sqm', confidence: formAreaClaim.confidence, source: formAreaClaim.source },
              { label: 'Building plan, p.1', value: planVal, unit: 'sqm', confidence: planAreaClaim.confidence, source: planAreaClaim.source }
            ],
            computation: { formula: '|form - plan| / plan * 100', inputs: { form: formVal, plan: planVal }, result: diffPct }
          }
        });
        trace.push({ ruleId: 'AREA-CONSIST-001', outcome: 'FAIL', ms: 12, summary: 'Area difference exceeds 2%', inputs: { form: formVal, plan: planVal } });
      } else {
        trace.push({ ruleId: 'AREA-CONSIST-001', outcome: 'PASS', ms: 8, summary: 'Area within tolerance', inputs: { form: formVal, plan: planVal } });
      }
    }

    // Rule 2: FSR-004 (Intake over faculty)
    const intakeClaim = claims.find((c) => c.predicate === 'intake_requested');
    const facultyClaim = claims.find((c) => c.predicate === 'faculty_count_listed');

    if (intakeClaim && facultyClaim) {
      const intake = Number(intakeClaim.value);
      const faculty = Number(facultyClaim.value);
      const ratio = faculty > 0 ? intake / faculty : 0;

      if (ratio > 20) {
        findings.push({
          ruleId: 'FSR-004',
          ruleVersion: '1',
          rulepackVersion: '2026.1-demo',
          clauseRef: 'HANDBOOK-REF-TBD',
          placeholder: true,
          status: 'MISMATCH_DETECTED',
          severity: 'HIGH',
          title: 'Declared intake is not supported by the listed faculty',
          message: `Requested intake ${intake} over ${faculty} listed faculty gives ${ratio} students per faculty; the configured maximum is 20.`,
          claimIds: [intakeClaim.claimId, facultyClaim.claimId].filter(Boolean),
          proof: {
            statement: 'Requested intake exceeds faculty student ratio limit',
            evidence: [
              { label: 'Requested Intake', value: intake, confidence: intakeClaim.confidence, source: intakeClaim.source },
              { label: 'Listed Faculty', value: faculty, confidence: facultyClaim.confidence, source: facultyClaim.source }
            ],
            computation: { formula: 'intake / faculty', inputs: { intake, faculty }, result: ratio }
          }
        });
        trace.push({ ruleId: 'FSR-004', outcome: 'FAIL', ms: 14, summary: `Ratio ${ratio} > 20`, inputs: { intake, faculty } });
      } else {
        trace.push({ ruleId: 'FSR-004', outcome: 'PASS', ms: 6, summary: 'Ratio compliant', inputs: { intake, faculty } });
      }
    }

    // Rule 3: NOC-VALIDITY-008 (Fire NOC lapses within approval period)
    const nocClaim = claims.find((c) => c.predicate === 'noc_valid_until');
    if (nocClaim) {
      const validUntil = new Date(nocClaim.value);
      const decisionDate = new Date(payload.decisionDate || '2026-06-30');
      const approvalEnd = new Date(payload.approvalPeriod?.end || '2027-06-30');

      if (validUntil < decisionDate) {
        findings.push({
          ruleId: 'NOC-VALIDITY-008',
          ruleVersion: '1',
          rulepackVersion: '2026.1-demo',
          clauseRef: 'HANDBOOK-REF-TBD',
          placeholder: false,
          status: 'EXPIRED',
          severity: 'HIGH',
          title: 'Fire Safety NOC has expired',
          message: `Fire Safety NOC expired on ${nocClaim.value}, prior to the decision date.`,
          claimIds: [nocClaim.claimId].filter(Boolean),
          proof: {
            statement: 'NOC expired prior to decision date',
            evidence: [{ label: 'Fire Safety NOC Expiry', value: nocClaim.value, confidence: nocClaim.confidence, source: nocClaim.source }]
          }
        });
        trace.push({ ruleId: 'NOC-VALIDITY-008', outcome: 'FAIL', ms: 9, summary: 'Expired', inputs: { validUntil: nocClaim.value } });
      } else if (validUntil < approvalEnd) {
        findings.push({
          ruleId: 'NOC-VALIDITY-008',
          ruleVersion: '1',
          rulepackVersion: '2026.1-demo',
          clauseRef: 'HANDBOOK-REF-TBD',
          placeholder: false,
          status: 'MANUAL_REVIEW_REQUIRED',
          severity: 'MEDIUM',
          title: 'Fire Safety NOC lapses before approval period ends',
          message: `Fire Safety NOC is valid today but lapses on ${nocClaim.value}, which is before the approval period end date (${payload.approvalPeriod?.end || '2027-06-30'}).`,
          claimIds: [nocClaim.claimId].filter(Boolean),
          proof: {
            statement: 'NOC valid today but lapses during regulatory approval period',
            evidence: [{ label: 'Fire Safety NOC Expiry', value: nocClaim.value, confidence: nocClaim.confidence, source: nocClaim.source }]
          },
          alertAt: new Date(validUntil.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        });
        trace.push({ ruleId: 'NOC-VALIDITY-008', outcome: 'FAIL', ms: 10, summary: 'Lapses in period', inputs: { validUntil: nocClaim.value } });
      } else {
        trace.push({ ruleId: 'NOC-VALIDITY-008', outcome: 'PASS', ms: 7, summary: 'Valid throughout approval period', inputs: { validUntil: nocClaim.value } });
      }
    }

    // Rule 4: TER-STATUS-006 (Application says PAID, record says PENDING)
    const terClaim = claims.find((c) => c.predicate === 'ter_payment_status_claimed');
    const terRecord = payload.records?.ter?.status;

    if (terClaim && terRecord) {
      if (terClaim.value === 'PAID' && terRecord === 'PENDING') {
        findings.push({
          ruleId: 'TER-STATUS-006',
          ruleVersion: '1',
          rulepackVersion: '2026.1-demo',
          clauseRef: 'HANDBOOK-REF-TBD',
          placeholder: false,
          status: 'MISMATCH_DETECTED',
          severity: 'HIGH',
          title: 'Application claims TER paid but official record says pending',
          message: 'Application form claims TER fee status is PAID, but official AICTE regulatory record indicates PENDING.',
          claimIds: [terClaim.claimId].filter(Boolean),
          proof: {
            statement: 'TER payment claimed paid but official record shows pending',
            evidence: [
              { label: 'Application Form Claim', value: 'PAID', confidence: terClaim.confidence, source: terClaim.source },
              { label: 'AICTE Record', value: 'PENDING', confidence: 1.0, recordRef: payload.recordsSource }
            ]
          }
        });
        trace.push({ ruleId: 'TER-STATUS-006', outcome: 'FAIL', ms: 11, summary: 'TER mismatch', inputs: { claimed: 'PAID', record: 'PENDING' } });
      } else {
        trace.push({ ruleId: 'TER-STATUS-006', outcome: 'PASS', ms: 6, summary: 'TER status matched', inputs: { claimed: terClaim.value, record: terRecord } });
      }
    }

    // Validity timeline entries
    const validity = [];
    if (nocClaim) {
      const validDate = new Date(nocClaim.value);
      const approvalEnd = new Date(payload.approvalPeriod?.end || '2027-06-30');
      const lapsesInPeriod = validDate < approvalEnd;

      validity.push({
        docType: 'FIRE_NOC',
        claimId: nocClaim.claimId,
        label: 'Fire Safety NOC',
        validUntil: nocClaim.value,
        state: lapsesInPeriod ? 'LAPSES_IN_PERIOD' : 'VALID',
        daysRemaining: lapsesInPeriod ? 120 : 730,
        alertAt: lapsesInPeriod ? new Date('2026-08-01T00:00:00Z').toISOString() : null
      });
    }

    return {
      rulepackVersion: '2026.1-demo',
      rulepackSha256: 'mock_reconcile_rulepack_sha',
      rulesRun: trace.map((t) => t.ruleId),
      findings,
      trace,
      validity
    };
  }
}

const mlClient = new MlClient();

module.exports = mlClient;

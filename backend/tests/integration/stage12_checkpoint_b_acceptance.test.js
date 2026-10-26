const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const {
  User,
  Institution,
  Application,
  Document,
  Claim,
  Finding,
  AicteRecord,
  Letter,
  AuditEvent
} = require('../../src/models');
const { seedDatabase } = require('../../src/seed');
const { processNextJob } = require('../../src/services/jobRunner.service');
const { verifyAuditChain } = require('../../src/services/auditChain.service');

let mongoServer;
let officerToken;
let directorToken;
let apexUserToken;
let cleanUserToken;
let apexInstId;
let cleanInstId;
let faultedAppId;
let cleanAppId;

// Helper to generate distinct valid PDF buffers
const makePdf = (label) =>
  Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Title (${label}) /Producer (OneCheck Compliance Engine) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
  );

// Helper to exhaustively drain background job queue
async function drainQueue(maxIterations = 50) {
  let count = 0;
  while (count < maxIterations) {
    const job = await processNextJob();
    if (!job) break;
    count++;
  }
  return count;
}

// Increase timeout for remote MongoDB Atlas roundtrips
jest.setTimeout(120000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seeded = await seedDatabase(uri);
  apexInstId = seeded.institution._id;

  // 1. Login Scrutiny Officer
  const resOff = await request(app).post('/api/auth/login').send({
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = resOff.body.data.token;

  // 2. Login Regional Director
  const resDir = await request(app).post('/api/auth/login').send({
    email: 'director.regional@onecheck.gov.in',
    password: 'Director@123456'
  });
  directorToken = resDir.body.data.token;

  // 3. Login Apex Institute User (Faulted demo institution)
  const resApex = await request(app).post('/api/auth/login').send({
    email: 'director@apex-tech.edu.in',
    password: 'Institution@123456'
  });
  apexUserToken = resApex.body.data.token;

  // 4. Setup Clean Companion Institution & User (Bharti Institute)
  let cleanInst = await Institution.findOne({ registrationId: 'AICTE-MAH-2026-02' });
  cleanInstId = cleanInst._id;

  const cleanUser = await User.create({
    name: 'Dr. Suresh Patil',
    email: 'director@bharti-science.edu.in',
    passwordHash: await User.hashPassword('Institution@123456'),
    role: 'INSTITUTION_USER',
    institution: cleanInst._id,
    institutionId: cleanInst._id,
    isActive: true
  });

  const resClean = await request(app).post('/api/auth/login').send({
    email: 'director@bharti-science.edu.in',
    password: 'Institution@123456'
  });
  cleanUserToken = resClean.body.data.token;

  // 5. Seed clean AICTE ground-truth record for Bharti Institute
  await AicteRecord.findOneAndUpdate(
    { institutionId: 'AICTE-MAH-2026-02' },
    {
      institutionId: 'AICTE-MAH-2026-02',
      sourceLabel: 'DEMO ADAPTER - simulated AICTE record',
      bundle: {
        institutionId: 'AICTE-MAH-2026-02',
        institutionName: 'Bharti Institute of Science & Research (Synthetic)',
        prevEoa: {
          academicYear: '2025-2026',
          courses: [{ name: 'Computer Science and Engineering', level: 'UG', approvedIntake: 120 }]
        },
        ter: {
          status: 'PAID'
        },
        deficiencies: [],
        approvedIntake: { total: 120, courses: [] },
        faculty: []
      }
    },
    { upsert: true, new: true }
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Stage 12 — Checkpoint B Full Planted-Fault Acceptance & Hardening', () => {
  let buildingPlanDocId;

  // --------------------------------------------------------------------------
  // PART 1: Planted-Fault Application Setup, Upload & Forensics Analysis
  // --------------------------------------------------------------------------
  test('Step 1: Create draft application and upload all 6 required compliance documents for Apex Institute', async () => {
    // Create Application
    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${apexUserToken}`)
      .send({
        category: 'EOA_INTAKE_INCREASE',
        academicYear: '2026-2027'
      });

    expect(appRes.status).toBe(201);
    expect(appRes.body.success).toBe(true);
    faultedAppId = appRes.body.data.application._id;

    // Upload 1: SELF_DISCLOSURE_FORM
    const doc1 = await request(app)
      .post(`/api/applications/${faultedAppId}/documents`)
      .set('Authorization', `Bearer ${apexUserToken}`)
      .field('docTypeHint', 'SELF_DISCLOSURE_FORM')
      .attach('file', makePdf('Self Disclosure Form 2026'), {
        filename: 'self_disclosure_form.pdf',
        contentType: 'application/pdf'
      });
    expect(doc1.status).toBe(201);

    // Upload 2: BUILDING_PLAN (contains planted area discrepancy & forensics signals)
    const doc2 = await request(app)
      .post(`/api/applications/${faultedAppId}/documents`)
      .set('Authorization', `Bearer ${apexUserToken}`)
      .field('docTypeHint', 'BUILDING_PLAN')
      .attach('file', makePdf('Building Plan Architect Certificate'), {
        filename: 'building_plan.pdf',
        contentType: 'application/pdf'
      });
    expect(doc2.status).toBe(201);
    buildingPlanDocId = doc2.body.data._id;

    // Upload 3: FACULTY_LIST (6 faculty members for 180 intake -> breach 30:1 > 20:1)
    const doc3 = await request(app)
      .post(`/api/applications/${faultedAppId}/documents`)
      .set('Authorization', `Bearer ${apexUserToken}`)
      .field('docTypeHint', 'FACULTY_LIST')
      .attach('file', makePdf('Faculty Cadre List'), {
        filename: 'faculty_list.pdf',
        contentType: 'application/pdf'
      });
    expect(doc3.status).toBe(201);

    // Upload 4: FIRE_NOC (valid until 2026-10-31 -> lapses inside approval period ending 2027-06-30)
    const doc4 = await request(app)
      .post(`/api/applications/${faultedAppId}/documents`)
      .set('Authorization', `Bearer ${apexUserToken}`)
      .field('docTypeHint', 'FIRE_NOC')
      .attach('file', makePdf('Fire Safety Certificate NOC'), {
        filename: 'fire_noc.pdf',
        contentType: 'application/pdf'
      });
    expect(doc4.status).toBe(201);

    // Upload 5: TER_PAYMENT_RECEIPT (claims PAID, while official record says PENDING)
    const doc5 = await request(app)
      .post(`/api/applications/${faultedAppId}/documents`)
      .set('Authorization', `Bearer ${apexUserToken}`)
      .field('docTypeHint', 'TER_PAYMENT_RECEIPT')
      .attach('file', makePdf('TER Payment Challan'), {
        filename: 'ter_payment_receipt.pdf',
        contentType: 'application/pdf'
      });
    expect(doc5.status).toBe(201);

    // Upload 6: ACCREDITATION_CERT (required for EOA_INTAKE_INCREASE)
    const doc6 = await request(app)
      .post(`/api/applications/${faultedAppId}/documents`)
      .set('Authorization', `Bearer ${apexUserToken}`)
      .field('docTypeHint', 'ACCREDITATION_CERT')
      .attach('file', makePdf('NBA Accreditation Certificate'), {
        filename: 'accreditation_cert.pdf',
        contentType: 'application/pdf'
      });
    expect(doc6.status).toBe(201);

    // Drain queue to process all ANALYZE_DOC jobs
    const jobsProcessed = await drainQueue();
    expect(jobsProcessed).toBeGreaterThanOrEqual(6);
  });

  test('Step 2: Verify Forensics signals on building plan (Planted Finding 5)', async () => {
    const doc = await Document.findById(buildingPlanDocId);
    expect(doc).not.toBeNull();
    expect(doc.analysis).toBeDefined();
    expect(doc.analysis.status).toBe('DONE');

    // Section 0.8: verify incremental save / font anomaly warnings are captured
    expect(doc.analysis.warnings).toContain('PDF incremental save detected');
    expect(doc.analysis.warnings).toContain('Font anomaly detected');
    expect(doc.analysis.forensics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signal: 'INCREMENTAL_SAVE_DETECTED' }),
        expect.objectContaining({ signal: 'FONT_ANOMALY' })
      ])
    );
  });

  // --------------------------------------------------------------------------
  // PART 2: Submission, Reconciliation & 5 Planted Findings Verification
  // --------------------------------------------------------------------------
  test('Step 3: Submit application, execute reconciliation, and verify all 5 planted findings & RED band', async () => {
    // 1. Submit application (passes checklist validation because all 6 required docs uploaded)
    const submitRes = await request(app)
      .post(`/api/applications/${faultedAppId}/submit`)
      .set('Authorization', `Bearer ${apexUserToken}`);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.application.status).toBe('SUBMITTED');

    // 2. Process RECONCILE_APP background job
    await drainQueue();

    // 3. Alternatively trigger reconciliation endpoint to ensure idempotent re-computation
    const reconRes = await request(app)
      .post(`/api/applications/${faultedAppId}/reconcile`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(reconRes.status).toBe(200);
    expect(reconRes.body.success).toBe(true);

    // 4. Fetch findings
    const findingsRes = await request(app)
      .get(`/api/applications/${faultedAppId}/findings`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(findingsRes.status).toBe(200);
    const findings = findingsRes.body.data;

    // Verify Planted Finding 1: AREA-CONSIST-001 (640 sqm vs 410 sqm)
    const areaFinding = findings.find((f) => f.ruleId === 'AREA-CONSIST-001');
    expect(areaFinding).toBeDefined();
    expect(areaFinding.severity).toBe('HIGH');
    expect(areaFinding.status).toBe('MISMATCH_DETECTED');
    expect(areaFinding.message).toMatch(/640.*410/);

    // Verify Planted Finding 2: FSR-004 (180 seats / 6 faculty = 30:1 > 20:1)
    const fsrFinding = findings.find((f) => f.ruleId === 'FSR-004');
    expect(fsrFinding).toBeDefined();
    expect(fsrFinding.severity).toBe('HIGH');
    expect(fsrFinding.status).toBe('MISMATCH_DETECTED');
    expect(fsrFinding.message).toMatch(/180.*6.*30/);

    // Verify Planted Finding 3: NOC-VALIDITY-008 (lapses 2026-10-31 before 2027-06-30)
    const nocFinding = findings.find((f) => f.ruleId === 'NOC-VALIDITY-008');
    expect(nocFinding).toBeDefined();
    expect(nocFinding.severity).toBe('MEDIUM');
    expect(nocFinding.status).toBe('MANUAL_REVIEW_REQUIRED');
    expect(nocFinding.message).toMatch(/2026-10-31/);

    // Verify Planted Finding 4: TER-STATUS-006 (Form claims PAID, official record says PENDING)
    const terFinding = findings.find((f) => f.ruleId === 'TER-STATUS-006');
    expect(terFinding).toBeDefined();
    expect(terFinding.severity).toBe('HIGH');
    expect(terFinding.status).toBe('MISMATCH_DETECTED');
    expect(terFinding.message).toMatch(/PAID.*PENDING/);

    // Verify Deterministic Summary Band
    const summary = reconRes.body.data.summary;
    expect(summary.band).toBe('RED');
    expect(summary.openFindingsCount).toBeGreaterThanOrEqual(4);
    expect(summary.countsBySeverity.HIGH).toBeGreaterThanOrEqual(3);
    expect(summary.countsBySeverity.MEDIUM).toBeGreaterThanOrEqual(1);
    expect(summary.countsBySeverity.CRITICAL).toBe(0);
    // Queue sortKey begins with rank '2_' (HIGH severity)
    expect(summary.sortKey).toMatch(/^2_/);
  });

  // --------------------------------------------------------------------------
  // PART 3: Decision Guard & Deficiency Letter Workflow
  // --------------------------------------------------------------------------
  test('Step 4: Decision Guard strictly blocks approval while open HIGH findings exist', async () => {
    // Attempt approval while 3 open HIGH findings exist
    const decisionRes = await request(app)
      .post(`/api/applications/${faultedAppId}/decision`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        outcome: 'APPROVE',
        reason: 'Attempting premature approval without resolving discrepancies'
      });

    expect(decisionRes.status).toBe(400);
    expect(decisionRes.body.success).toBe(false);
    expect(decisionRes.body.error.message).toMatch(/Decision blocked: Cannot approve or recommend approval/);
  });

  test('Step 5: Scrutiny Officer generates and dispatches official Handlebars Deficiency Letter', async () => {
    // 1. Generate Draft Letter
    const genRes = await request(app)
      .post(`/api/applications/${faultedAppId}/letters`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});

    expect(genRes.status).toBe(201);
    expect(genRes.body.success).toBe(true);
    const letter = genRes.body.data;
    expect(letter.status).toBe('DRAFT');
    expect(letter.body).toContain('REGULATORY COMPLIANCE & DEFICIENCY NOTICE');
    expect(letter.body).toContain('Apex Institute of Technology');
    expect(letter.body).toContain('AREA-CONSIST-001');
    expect(letter.body).toContain('FSR-004');
    expect(letter.body).toContain('TER-STATUS-006');

    // 2. Dispatch Letter to Institution
    const sendRes = await request(app)
      .post(`/api/letters/${letter._id}/send`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data.status).toBe('SENT');

    // Application status transitions to DEFICIENCY_RAISED
    const appDoc = await Application.findById(faultedAppId);
    expect(appDoc.status).toBe('DEFICIENCY_RAISED');
  });

  test('Step 6: Officer dispositions finding, and subsequent reconciliation preserves disposition via claimsKey', async () => {
    const findingsRes = await request(app)
      .get(`/api/applications/${faultedAppId}/findings`)
      .set('Authorization', `Bearer ${officerToken}`);

    const findings = findingsRes.body.data;
    const areaFinding = findings.find((f) => f.ruleId === 'AREA-CONSIST-001');

    // Officer sets disposition: ACCEPTED with mandatory reason >= 10 chars
    const dispRes = await request(app)
      .post(`/api/findings/${areaFinding._id}/disposition`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        state: 'ACCEPTED',
        reason: 'Institution formal representation acknowledged and scheduled for physical inspection'
      });

    expect(dispRes.status).toBe(200);
    expect(dispRes.body.data.disposition.state).toBe('ACCEPTED');

    // Re-run full reconciliation pipeline
    await request(app)
      .post(`/api/applications/${faultedAppId}/reconcile`)
      .set('Authorization', `Bearer ${officerToken}`);

    // Verify finding disposition state was NOT overwritten by automated re-run
    const updatedFinding = await Finding.findById(areaFinding._id);
    expect(updatedFinding.disposition.state).toBe('ACCEPTED');
    expect(updatedFinding.disposition.reason).toContain('physical inspection');
  });

  // --------------------------------------------------------------------------
  // PART 4: Clean Companion Application Lifecycle
  // --------------------------------------------------------------------------
  test('Step 7: Clean companion application uploads clean documents, achieves GREEN band, and gets approved', async () => {
    // 1. Create clean application for Bharti Institute
    const appRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${cleanUserToken}`)
      .send({
        category: 'EOA_INTAKE_INCREASE',
        academicYear: '2026-2027'
      });

    expect(appRes.status).toBe(201);
    cleanAppId = appRes.body.data.application._id;

    // 2. Upload clean compliance documents (filename includes 'clean')
    const cleanDocs = [
      { hint: 'SELF_DISCLOSURE_FORM', filename: 'clean_self_disclosure.pdf' },
      { hint: 'BUILDING_PLAN', filename: 'clean_building_plan.pdf' },
      { hint: 'FACULTY_LIST', filename: 'clean_faculty_list.pdf' },
      { hint: 'FIRE_NOC', filename: 'clean_fire_noc.pdf' },
      { hint: 'TER_PAYMENT_RECEIPT', filename: 'clean_ter_receipt.pdf' },
      { hint: 'ACCREDITATION_CERT', filename: 'clean_accreditation.pdf' }
    ];

    for (const d of cleanDocs) {
      const upRes = await request(app)
        .post(`/api/applications/${cleanAppId}/documents`)
        .set('Authorization', `Bearer ${cleanUserToken}`)
        .field('docTypeHint', d.hint)
        .attach('file', makePdf(`Clean ${d.hint}`), {
          filename: d.filename,
          contentType: 'application/pdf'
        });
      expect(upRes.status).toBe(201);
    }

    // Drain queue to process all clean ANALYZE_DOC jobs
    await drainQueue();

    // Verify clean building plan has 0 forensics warnings
    const planDoc = await Document.findOne({ application: cleanAppId, documentType: 'BUILDING_PLAN' });
    expect(planDoc).not.toBeNull();
    expect(planDoc.analysis.warnings).toHaveLength(0);
    expect(planDoc.analysis.forensics).toHaveLength(0);

    // 3. Submit clean application
    const submitRes = await request(app)
      .post(`/api/applications/${cleanAppId}/submit`)
      .set('Authorization', `Bearer ${cleanUserToken}`);
    expect(submitRes.status).toBe(200);

    // 4. Run reconciliation
    const reconRes = await request(app)
      .post(`/api/applications/${cleanAppId}/reconcile`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(reconRes.status).toBe(200);

    // 5. Verify Deterministic Summary Band is GREEN
    const summary = reconRes.body.data.summary;
    expect(summary.band).toBe('GREEN');
    expect(summary.openFindingsCount).toBe(0);
    expect(summary.countsBySeverity.HIGH).toBe(0);
    expect(summary.countsBySeverity.CRITICAL).toBe(0);

    // 6. Regional Director approves the clean application (allowed by Decision Guard!)
    const decisionRes = await request(app)
      .post(`/api/applications/${cleanAppId}/decision`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        outcome: 'APPROVE',
        reason: 'All regulatory standards, building norms, and faculty cadre requirements fully met.'
      });

    expect(decisionRes.status).toBe(200);
    expect(['VERIFIED', 'APPROVED']).toContain(decisionRes.body.data.status);
  });

  // --------------------------------------------------------------------------
  // PART 5: Cryptographic Audit Hash Chain Integrity Verification
  // --------------------------------------------------------------------------
  test('Step 8: Cryptographic audit hash chain verifies with zero broken links across all events', async () => {
    // Allow any in-flight background audit chain queue events to complete write
    await new Promise((r) => setTimeout(r, 300));

    const chainResult = await verifyAuditChain();
    expect(chainResult.verified).toBe(true);
    expect(chainResult.brokenSeq).toBeUndefined();
    expect(chainResult.totalEvents).toBeGreaterThan(10);
  });
});

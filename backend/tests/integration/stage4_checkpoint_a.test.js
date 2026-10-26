const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Document, Job, Claim, Finding, Alert } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');
const { processNextJob } = require('../../src/services/jobRunner.service');

let mongoServer;
let instUserToken;
let otherInstToken;
let officerToken;
let institutionId;
let applicationId;

const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Regulatory Certificate) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seeded = await seedDatabase(uri);
  institutionId = seeded.institution._id;

  // Login as primary institution user
  const res1 = await request(app).post('/api/auth/login').send({
    email: 'director@apex-tech.edu.in',
    password: 'Institution@123456'
  });
  instUserToken = res1.body.data.token;

  // Create outsider institution and user
  const otherInst = await Institution.create({
    name: 'Outsider Institute (Synthetic)',
    aicteId: 'AICTE-OUTSIDER-99',
    registrationId: 'AICTE-OUTSIDER-99',
    state: 'Delhi',
    createdBy: seeded.admin._id
  });

  const otherUser = await User.create({
    name: 'Outsider Director',
    email: 'director.other@outsider.edu.in',
    passwordHash: await User.hashPassword('Password@123456'),
    role: 'INSTITUTION_USER',
    institution: otherInst._id,
    institutionId: otherInst._id
  });

  const res2 = await request(app).post('/api/auth/login').send({
    email: 'director.other@outsider.edu.in',
    password: 'Password@123456'
  });
  otherInstToken = res2.body.data.token;

  // Officer login
  const res3 = await request(app).post('/api/auth/login').send({
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = res3.body.data.token;

  // Create DRAFT application
  const appRes = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${instUserToken}`)
    .send({ category: 'EOA_INTAKE_INCREASE', academicYear: '2026-2027' });

  applicationId = appRes.body.data.application._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Stage 4 — ML Client, Job Runner, ANALYZE_DOC & Claims API (Checkpoint A)', () => {
  let uploadedDocId;

  test('Step 1: Upload document queues ANALYZE_DOC background job', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'BUILDING_PLAN')
      .attach('file', validPdf, { filename: 'building_plan.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    uploadedDocId = res.body.data._id;

    // Check Job is queued
    const job = await Job.findOne({ 'payload.docId': uploadedDocId.toString() });
    expect(job).not.toBeNull();
    expect(job.type).toBe('ANALYZE_DOC');
    expect(job.status).toBe('QUEUED');
  });

  test('Step 2: Job runner processes ANALYZE_DOC and extracts claims to MongoDB', async () => {
    // Process next queued job
    const processedJob = await processNextJob();
    expect(processedJob).not.toBeNull();
    expect(processedJob.type).toBe('ANALYZE_DOC');
    expect(processedJob.status).toBe('DONE');

    // Document status should be updated to DONE
    const updatedDoc = await Document.findById(uploadedDocId);
    expect(updatedDoc.analysis.status).toBe('DONE');
    expect(updatedDoc.analysis.method).toBe('TEXT_LAYER');
    expect(updatedDoc.fingerprints.sha256).toBeDefined();

    // Verify Claims persisted into MongoDB
    const claims = await Claim.find({ applicationId });
    expect(claims.length).toBeGreaterThan(0);

    const labAreaClaim = claims.find((c) => c.predicate === 'lab_area_sqm_total');
    expect(labAreaClaim).toBeDefined();
    expect(labAreaClaim.value).toBe(410);
    expect(labAreaClaim.unit).toBe('sqm');
    expect(labAreaClaim.status).toBe('EXTRACTED');
    expect(labAreaClaim.confidence).toBeGreaterThanOrEqual(0.80);
  });

  test('Step 3: GET /api/applications/:id/claims returns claims with scoping and filters', async () => {
    // 1. Institution owner gets claims
    const res = await request(app)
      .get(`/api/applications/${applicationId}/claims`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    // 2. Filter by predicate
    const filteredRes = await request(app)
      .get(`/api/applications/${applicationId}/claims?predicate=lab_area_sqm_total`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.data.every((c) => c.predicate === 'lab_area_sqm_total')).toBe(true);

    // 3. Outsider institution is denied access (403)
    const outsiderRes = await request(app)
      .get(`/api/applications/${applicationId}/claims`)
      .set('Authorization', `Bearer ${otherInstToken}`);

    expect(outsiderRes.status).toBe(403);

    // 4. Scrutiny officer can view claims
    const officerRes = await request(app)
      .get(`/api/applications/${applicationId}/claims`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(officerRes.status).toBe(200);
  });

  test('Step 4: Confidence gating flags low-confidence claims as NEEDS_CONFIRMATION and allows confirmation', async () => {
    // Create a mock claim with confidence < 0.80
    const lowConfClaim = await Claim.create({
      claimId: `claim_${uploadedDocId}_low_conf_test`,
      applicationId,
      subject: 'institution',
      predicate: 'sports_area_sqm',
      value: 1200,
      unit: 'sqm',
      origin: 'DOCUMENT',
      source: { docId: uploadedDocId.toString(), page: 1, snippet: 'Sports area 1200' },
      method: 'OCR',
      confidence: 0.65, // < 0.80
      status: 'NEEDS_CONFIRMATION'
    });

    expect(lowConfClaim.status).toBe('NEEDS_CONFIRMATION');

    // Confirm the claim via POST /api/claims/:claimId/confirm
    const confirmRes = await request(app)
      .post(`/api/claims/${lowConfClaim.claimId}/confirm`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.status).toBe('CONFIRMED');

    // Outsider cannot confirm claim
    const outsiderConfirm = await request(app)
      .post(`/api/claims/${lowConfClaim.claimId}/confirm`)
      .set('Authorization', `Bearer ${otherInstToken}`);

    expect(outsiderConfirm.status).toBe(403);
  });

  test('Step 5: Job runner handles retries and terminal failure triggers finding & alert', async () => {
    // Create a failing job that exceeds maxAttempts
    const failDoc = await Document.create({
      application: applicationId,
      applicationId,
      documentType: 'FIRE_NOC',
      docType: 'FIRE_NOC',
      originalName: 'failing_file.pdf',
      mime: 'application/pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      fileSize: 100,
      sha256: 'failing_sha256_mock',
      sha256FileHash: 'failing_sha256_mock',
      storagePath: 'originals/fake_fail.pdf',
      storageKey: 'originals/fake_fail.pdf',
      version: 1,
      pageCount: 1,
      uploadedBy: new mongoose.Types.ObjectId()
    });

    const failingJob = await Job.create({
      type: 'ANALYZE_DOC',
      payload: {
        docId: failDoc._id.toString(),
        applicationId: applicationId.toString(),
        filePath: 'non_existent_file_path.pdf'
      },
      status: 'QUEUED',
      attempts: 2, // 3rd attempt will be terminal
      maxAttempts: 3,
      idempotencyKey: `fail_test_${Date.now()}`
    });

    // Mock mlClient to throw an error for this doc
    const mlClient = require('../../src/services/mlClient.service');
    const origAnalyze = mlClient.analyzeDocument;
    mlClient.analyzeDocument = jest.fn().mockRejectedValue(new Error('OCR engine crash simulated'));

    try {
      const resultJob = await processNextJob();
      expect(resultJob._id.toString()).toBe(failingJob._id.toString());
      expect(resultJob.status).toBe('FAILED');
      expect(resultJob.attempts).toBe(3);

      // Verify Document analysis status marked FAILED
      const failedDocRecord = await Document.findById(failDoc._id);
      expect(failedDocRecord.analysis.status).toBe('FAILED');
      expect(failedDocRecord.analysis.error).toContain('OCR engine crash simulated');

      // Verify MANUAL_REVIEW_REQUIRED finding was created
      const finding = await Finding.findOne({
        applicationId,
        ruleId: 'ANALYSIS-FAILED-000'
      });
      expect(finding).not.toBeNull();
      expect(finding.status).toBe('MANUAL_REVIEW_REQUIRED');
      expect(finding.severity).toBe('HIGH');

      // Verify Alert was created
      const alert = await Alert.findOne({
        application: applicationId,
        type: 'ANALYSIS_FAILED'
      });
      expect(alert).not.toBeNull();
      expect(alert.severity).toBe('HIGH');
    } finally {
      mlClient.analyzeDocument = origAnalyze;
    }
  });
});

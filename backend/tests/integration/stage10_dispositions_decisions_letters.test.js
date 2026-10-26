const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Finding, Claim, Letter, AuditLog } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');

let mongoServer;
let officerToken;
let directorToken;
let instUserToken;
let applicationId;
let highFindingId;
let claimId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seeded = await seedDatabase(uri);

  // Login Scrutiny Officer
  const resOff = await request(app).post('/api/auth/login').send({
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = resOff.body.data.token;

  // Login Regional Director
  const resDir = await request(app).post('/api/auth/login').send({
    email: 'director.regional@onecheck.gov.in',
    password: 'Director@123456'
  });
  directorToken = resDir.body.data.token;

  // Login Institution user
  const resInst = await request(app).post('/api/auth/login').send({
    email: 'director@apex-tech.edu.in',
    password: 'Institution@123456'
  });
  instUserToken = resInst.body.data.token;

  // Create Application
  const appRes = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${instUserToken}`)
    .send({ category: 'EOA_CONTINUATION', academicYear: '2026-2027' });

  applicationId = appRes.body.data.application._id;

  // Create test claim
  claimId = `claim_test_${Date.now()}`;
  await Claim.create({
    claimId,
    applicationId,
    subject: 'institution',
    predicate: 'lab_area_sqm_total',
    value: 410,
    unit: 'sqm',
    origin: 'DOCUMENT',
    method: 'TEXT_LAYER',
    confidence: 0.95,
    status: 'EXTRACTED'
  });

  // Create HIGH severity finding
  const finding = await Finding.create({
    findingId: `finding_test_high_${Date.now()}`,
    applicationId,
    ruleId: 'AREA-CONSIST-001',
    ruleVersion: '1',
    rulepackVersion: '2026.1-demo',
    clauseRef: 'AICTE-APH-CH2-05',
    status: 'MISMATCH_DETECTED',
    severity: 'HIGH',
    title: 'Laboratory area differs between documents',
    message: 'Form declares 640 sqm while building plan measures 410 sqm.',
    claimIds: [claimId],
    disposition: { state: 'OPEN' }
  });

  highFindingId = finding._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Stage 10 — Partial Re-verification, Dispositions, Decision Guard & Letters', () => {
  test('Step 1: PATCH /api/claims/:claimId executes partial re-verification using rules index', async () => {
    const res = await request(app)
      .patch(`/api/claims/${claimId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        newValue: 640,
        reason: 'Officer verified revised architect certificate confirming 640 sqm'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.value).toBe(640);
    expect(res.body.data.status).toBe('CORRECTED');
    expect(res.body.partialReverify).toBeDefined();
    expect(res.body.partialReverify.rulesRerun).toContain('AREA-CONSIST-001');
  });

  test('Step 2: POST /api/findings/:id/disposition enforces reason requirement', async () => {
    // 1. Rejects DISMISSED without 10-char reason
    const rejectRes = await request(app)
      .post(`/api/findings/${highFindingId}/disposition`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ state: 'DISMISSED', reason: 'Short' });

    expect(rejectRes.status).toBe(400);

    // 2. Succeeds with valid reason
    const successRes = await request(app)
      .post(`/api/findings/${highFindingId}/disposition`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        state: 'DISMISSED',
        reason: 'Architect certificate verified on official portal confirms actual area.'
      });

    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
    expect(successRes.body.data.disposition.state).toBe('DISMISSED');
  });

  test('Step 3: Decision Guard blocks approval while open HIGH findings exist and checks role', async () => {
    // 1. Re-open a HIGH finding to test blocking guard
    await Finding.findByIdAndUpdate(highFindingId, {
      'disposition.state': 'OPEN',
      state: 'OPEN'
    });

    // 2. Officer tries to RECOMMEND_APPROVAL while HIGH finding is OPEN -> Blocked!
    const blockRes = await request(app)
      .post(`/api/applications/${applicationId}/decision`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ outcome: 'RECOMMEND_APPROVAL', reason: 'Attempting to approve' });

    expect(blockRes.status).toBe(400);
    expect(blockRes.body.error.message).toContain('Decision blocked');

    // 3. Officer tries to final APPROVE directly -> Forbidden (Requires Director)!
    const roleBlockRes = await request(app)
      .post(`/api/applications/${applicationId}/decision`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ outcome: 'APPROVE', reason: 'Officer final approve' });

    expect(roleBlockRes.status).toBe(403);

    // 4. Dismiss the finding again
    await Finding.findByIdAndUpdate(highFindingId, {
      'disposition.state': 'DISMISSED',
      state: 'DISMISSED'
    });

    // 5. Regional Director approves application -> Succeeds!
    const approveRes = await request(app)
      .post(`/api/applications/${applicationId}/decision`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ outcome: 'APPROVE', reason: 'All findings verified and resolved.' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.decision.outcome).toBe('APPROVE');
    expect(approveRes.body.data.status).toBe('VERIFIED');
  });

  test('Step 4: Deficiency Letter generation, drafting, and dispatch', async () => {
    // 1. Generate deficiency letter
    const createLetterRes = await request(app)
      .post(`/api/applications/${applicationId}/letters`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ findingIds: [highFindingId.toString()] });

    expect(createLetterRes.status).toBe(201);
    expect(createLetterRes.body.success).toBe(true);
    expect(createLetterRes.body.data.status).toBe('DRAFT');
    expect(createLetterRes.body.data.body).toContain('All India Council for Technical Education');
    const letterId = createLetterRes.body.data._id;

    // 2. List letters for application
    const listRes = await request(app)
      .get(`/api/applications/${applicationId}/letters`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    // 3. Dispatch letter -> marks SENT and transitions application to DEFICIENCY_RAISED
    const sendRes = await request(app)
      .post(`/api/letters/${letterId}/send`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.success).toBe(true);
    expect(sendRes.body.data.status).toBe('SENT');

    const appDoc = await Application.findById(applicationId);
    expect(appDoc.status).toBe('DEFICIENCY_RAISED');
  });
});

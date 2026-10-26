const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Document, Job, Claim, Finding, RecordSnapshot } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');
const { processNextJob } = require('../../src/services/jobRunner.service');

let mongoServer;
let instUserToken;
let otherInstToken;
let officerToken;
let institutionId;
let applicationId;

const formPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Self Disclosure Form) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
const planPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Approved Building Plan) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

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

  // Outsider user
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

describe('Stage 6 — Reconciliation, Record Snapshots, Findings & Deterministic Summary', () => {
  test('Step 1: Upload documents and execute extraction jobs', async () => {
    // 1. Upload Self-Disclosure Form (claims 640 sqm)
    await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'SELF_DISCLOSURE_FORM')
      .attach('file', formPdf, { filename: 'self_disclosure.pdf', contentType: 'application/pdf' });

    await processNextJob();

    // 2. Upload Building Plan (claims 410 sqm)
    await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'BUILDING_PLAN')
      .attach('file', planPdf, { filename: 'building_plan.pdf', contentType: 'application/pdf' });

    await processNextJob();

    // Verify claims are present
    const claims = await Claim.find({ applicationId });
    expect(claims.length).toBeGreaterThan(0);
  });

  test('Step 2: POST /api/applications/:id/reconcile runs rule evaluation and generates findings', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/reconcile`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rulepackVersion).toBe('2026.1-demo');
    expect(res.body.data.findings.length).toBeGreaterThan(0);

    // Verify RecordSnapshot was persisted
    const snapshots = await RecordSnapshot.find({ applicationId });
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[0].sha256).toBeDefined();
    expect(snapshots[0].source.label).toContain('DEMO ADAPTER');

    // Verify Area mismatch finding AREA-CONSIST-001 was generated
    const areaFinding = res.body.data.findings.find((f) => f.ruleId === 'AREA-CONSIST-001');
    expect(areaFinding).toBeDefined();
    expect(areaFinding.severity).toBe('HIGH');
    expect(areaFinding.status).toBe('MISMATCH_DETECTED');
    expect(areaFinding.claimsKey).toBeDefined();

    // Verify deterministic display band is RED due to HIGH severity finding
    expect(res.body.data.summary.band).toBe('RED');
    expect(res.body.data.summary.openFindingsCount).toBeGreaterThan(0);
    expect(res.body.data.summary.countsBySeverity.HIGH).toBeGreaterThan(0);
  });

  test('Step 3: GET /api/applications/:id/findings returns findings with scoping and filters', async () => {
    // 1. Institution owner views findings
    const res = await request(app)
      .get(`/api/applications/${applicationId}/findings`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // 2. Filter by severity=HIGH
    const highRes = await request(app)
      .get(`/api/applications/${applicationId}/findings?severity=HIGH`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(highRes.status).toBe(200);
    expect(highRes.body.data.every((f) => f.severity === 'HIGH')).toBe(true);

    // 3. Outsider institution is denied (403)
    const outsiderRes = await request(app)
      .get(`/api/applications/${applicationId}/findings`)
      .set('Authorization', `Bearer ${otherInstToken}`);

    expect(outsiderRes.status).toBe(403);

    // 4. Officer can view findings
    const officerRes = await request(app)
      .get(`/api/applications/${applicationId}/findings`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(officerRes.status).toBe(200);
  });

  test('Step 4: Re-running reconciliation preserves existing officer disposition', async () => {
    // Manually set an officer disposition on the area finding
    const areaFinding = await Finding.findOne({ applicationId, ruleId: 'AREA-CONSIST-001' });
    expect(areaFinding).not.toBeNull();

    areaFinding.disposition = {
      state: 'DISMISSED',
      dispositionedBy: new mongoose.Types.ObjectId(),
      dispositionedAt: new Date(),
      reason: 'Physical site inspection verified actual area is 640 sqm'
    };
    areaFinding.state = 'DISMISSED';
    await areaFinding.save();

    // Re-run reconciliation
    await request(app)
      .post(`/api/applications/${applicationId}/reconcile`)
      .set('Authorization', `Bearer ${instUserToken}`);

    // Verify disposition was preserved and NOT reset to OPEN
    const reloadedFinding = await Finding.findById(areaFinding._id);
    expect(reloadedFinding.disposition.state).toBe('DISMISSED');
    expect(reloadedFinding.disposition.reason).toContain('Physical site inspection');
  });
});

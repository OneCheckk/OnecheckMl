const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Document, Job, Checklist } = require('../../src/models');
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

  // Create DRAFT application for EOA_INTAKE_INCREASE
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

describe('Stage 5 — Checklist Resolution, Completeness, Submit & Self-Check', () => {
  test('Step 1: GET /api/applications/:id/checklist returns regulatory checklist with MISSING items', async () => {
    const res = await request(app)
      .get(`/api/applications/${applicationId}/checklist`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category).toBe('EOA_INTAKE_INCREASE');
    expect(res.body.data.isComplete).toBe(false);
    expect(res.body.data.missingRequiredCount).toBeGreaterThan(0);
    expect(res.body.data.items.every((i) => i.status === 'MISSING')).toBe(true);
  });

  test('Step 2: Outsider institution is forbidden from viewing checklist', async () => {
    const res = await request(app)
      .get(`/api/applications/${applicationId}/checklist`)
      .set('Authorization', `Bearer ${otherInstToken}`);

    expect(res.status).toBe(403);
  });

  test('Step 3: POST /api/applications/:id/submit blocks submission when checklist is incomplete', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/submit`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  test('Step 4: Uploading a document updates item status from MISSING to EXTRACTING/DONE', async () => {
    // Upload Fire NOC
    const uploadRes = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'FIRE_NOC')
      .attach('file', validPdf, { filename: 'fire_noc.pdf', contentType: 'application/pdf' });

    expect(uploadRes.status).toBe(201);

    // Checklist should now show item CHK-02 as EXTRACTING
    const chkRes1 = await request(app)
      .get(`/api/applications/${applicationId}/checklist`)
      .set('Authorization', `Bearer ${instUserToken}`);

    const fireItem1 = chkRes1.body.data.items.find((i) => i.docTypes.includes('FIRE_NOC'));
    expect(fireItem1.status).toBe('EXTRACTING');
    expect(fireItem1.document).not.toBeNull();

    // Process background analysis job
    await processNextJob();

    // Checklist should now show item CHK-02 as DONE
    const chkRes2 = await request(app)
      .get(`/api/applications/${applicationId}/checklist`)
      .set('Authorization', `Bearer ${instUserToken}`);

    const fireItem2 = chkRes2.body.data.items.find((i) => i.docTypes.includes('FIRE_NOC'));
    expect(fireItem2.status).toBe('DONE');
  });

  test('Step 5: POST /api/applications/:id/self-check runs pipeline and leaves application in DRAFT', async () => {
    // Upload Building Plan
    await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'BUILDING_PLAN')
      .attach('file', validPdf, { filename: 'building_plan.pdf', contentType: 'application/pdf' });

    // Trigger self-check
    const selfCheckRes = await request(app)
      .post(`/api/applications/${applicationId}/self-check`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(selfCheckRes.status).toBe(200);
    expect(selfCheckRes.body.success).toBe(true);
    expect(selfCheckRes.body.data.mode).toBe('SELF_CHECK');
    expect(selfCheckRes.body.data.status).toBe('DRAFT');

    // Verify application in DB is still DRAFT
    const appDoc = await Application.findById(applicationId);
    expect(appDoc.status).toBe('DRAFT');
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Document, CheckRun, RiskScore } = require('../../src/models');
const verificationClient = require('../../src/services/verificationClient.service');

let mongoServer;
let adminToken;
let officerToken;
let instUserToken1;
let instUserToken2;
let submittedAppId;
let draftAppId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Create Users
  const adminPassword = await User.hashPassword('Admin@123456');
  await User.create({
    name: 'Admin User',
    email: 'admin-run@onecheck.gov.in',
    passwordHash: adminPassword,
    role: 'ADMIN',
    isActive: true
  });

  const officerPassword = await User.hashPassword('Officer@123456');
  await User.create({
    name: 'Officer User',
    email: 'officer-run@onecheck.gov.in',
    passwordHash: officerPassword,
    role: 'OFFICER',
    isActive: true
  });

  const instPassword = await User.hashPassword('Inst@123456');
  const instUser1 = await User.create({
    name: 'Director 1',
    email: 'director1-run@college.edu',
    passwordHash: instPassword,
    role: 'INSTITUTION_USER',
    isActive: true
  });

  const instUser2 = await User.create({
    name: 'Director 2',
    email: 'director2-run@college.edu',
    passwordHash: instPassword,
    role: 'INSTITUTION_USER',
    isActive: true
  });

  // Create Institutions
  const institution1 = await Institution.create({
    name: 'Tech Campus 1',
    registrationId: 'TC1-RUN',
    address: 'Noida Sector 62',
    state: 'Uttar Pradesh',
    latitude: 28.628,
    longitude: 77.3649,
    createdBy: instUser1._id
  });
  instUser1.institution = institution1._id;
  await instUser1.save();

  const institution2 = await Institution.create({
    name: 'Tech Campus 2',
    registrationId: 'TC2-RUN',
    address: 'Mumbai Campus',
    state: 'Maharashtra',
    latitude: 19.05,
    longitude: 72.82,
    createdBy: instUser2._id
  });
  instUser2.institution = institution2._id;
  await instUser2.save();

  // Create Submitted Application
  const subApp = await Application.create({
    applicationNumber: 'APP-2026-888001',
    institution: institution1._id,
    category: 'NEW_INSTITUTION',
    academicYear: '2026-2027',
    status: 'SUBMITTED',
    totalDocuments: 1
  });
  submittedAppId = subApp._id;

  // Create Draft Application
  const draftApp = await Application.create({
    applicationNumber: 'APP-2026-888002',
    institution: institution1._id,
    category: 'NEW_INSTITUTION',
    academicYear: '2026-2027',
    status: 'DRAFT'
  });
  draftAppId = draftApp._id;

  // Create document for submitted app
  await Document.create({
    application: submittedAppId,
    documentType: 'LAND_DOC',
    originalName: 'land_doc.pdf',
    storageKey: 'doc_mock_123.pdf',
    fileSize: 10240,
    mimeType: 'application/pdf',
    sha256FileHash: 'hash12345',
    uploadedBy: instUser1._id,
    uploadStatus: 'STORED'
  });

  // Obtain tokens
  const resAdmin = await request(app).post('/api/auth/login').send({
    email: 'admin-run@onecheck.gov.in',
    password: 'Admin@123456'
  });
  adminToken = resAdmin.body.data.token;

  const resOfficer = await request(app).post('/api/auth/login').send({
    email: 'officer-run@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = resOfficer.body.data.token;

  const resInst1 = await request(app).post('/api/auth/login').send({
    email: 'director1-run@college.edu',
    password: 'Inst@123456'
  });
  instUserToken1 = resInst1.body.data.token;

  const resInst2 = await request(app).post('/api/auth/login').send({
    email: 'director2-run@college.edu',
    password: 'Inst@123456'
  });
  instUserToken2 = resInst2.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 5 — CheckRun Orchestration & Verification Adapter Tests', () => {
  let createdRunId;

  describe('POST /api/applications/:id/run-checks', () => {
    test('denies check run creation to institution users (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/applications/${submittedAppId}/run-checks`)
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('rejects running checks on unsubmitted DRAFT applications (400)', async () => {
      const res = await request(app)
        .post(`/api/applications/${draftAppId}/run-checks`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('DRAFT');
    });

    test('creates CheckRun and returns HTTP 202 Accepted immediately with runId', async () => {
      const res = await request(app)
        .post(`/api/applications/${submittedAppId}/run-checks`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.runId).toBeDefined();
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.steps).toHaveLength(6);
      createdRunId = res.body.data.runId;
    });
  });

  describe('GET /api/applications/:id/runs/:runId progress polling', () => {
    test('allows officer to retrieve run progress and step states', async () => {
      // Small pause to allow background execution to progress
      await new Promise((resolve) => setTimeout(resolve, 600));

      const res = await request(app)
        .get(`/api/applications/${submittedAppId}/runs/${createdRunId}`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.run.runId).toBe(createdRunId);
      expect(['RUNNING', 'SUCCEEDED', 'PARTIAL']).toContain(res.body.data.run.status);
      expect(res.body.data.run.steps).toHaveLength(6);

      // Verify step structure
      const ocrStep = res.body.data.run.steps.find((s) => s.name === 'DOCUMENT_OCR');
      expect(ocrStep).toBeDefined();
      expect(['PENDING', 'RUNNING', 'SUCCEEDED']).toContain(ocrStep.status);
    });

    test('institution owner can view their own application check run', async () => {
      const res = await request(app)
        .get(`/api/applications/${submittedAppId}/runs/${createdRunId}`)
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.run.runId).toBe(createdRunId);
    });

    test('blocks outsider institution user from viewing check run (403)', async () => {
      const res = await request(app)
        .get(`/api/applications/${submittedAppId}/runs/${createdRunId}`)
        .set('Authorization', `Bearer ${instUserToken2}`); // College 2 user

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Verification Client & Partial Failure Handling', () => {
    test('marks step UNAVAILABLE and overall run PARTIAL when verification service fails without crashing', async () => {
      // Mock extractDocumentText to simulate external timeout
      jest.spyOn(verificationClient, 'extractDocumentText').mockResolvedValueOnce({
        status: 'UNAVAILABLE',
        errorCode: 'TIMEOUT',
        errorMessage: 'Verification request timed out'
      });

      const res = await request(app)
        .post(`/api/applications/${submittedAppId}/run-checks`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(202);
      const partialRunId = res.body.data.runId;

      // Allow background worker to finish
      await new Promise((resolve) => setTimeout(resolve, 800));

      const statusRes = await request(app)
        .get(`/api/applications/${submittedAppId}/runs/${partialRunId}`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.run.status).toBe('PARTIAL');

      const ocrStep = statusRes.body.data.run.steps.find((s) => s.name === 'DOCUMENT_OCR');
      expect(ocrStep.status).toBe('UNAVAILABLE');
      expect(ocrStep.errorCode).toBe('TIMEOUT');
    });
  });
});

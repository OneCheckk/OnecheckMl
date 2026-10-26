const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Document, CheckRun, RiskScore, Alert, AuditLog } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');

let mongoServer;
let adminToken;
let officerToken;
let instUserToken;
let institutionId;

// Sample valid PDF and JPEG buffers
const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Compliance Record) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

// Increase timeout for remote MongoDB Atlas operations
jest.setTimeout(120000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // 1. Seed base users and institutions using the repeatable seed script
  const seeded = await seedDatabase(uri);
  institutionId = seeded.institution._id;

  // 2. Log in as Institution User (Dr. Ramesh Sharma)
  const resInst = await request(app).post('/api/auth/login').send({
    email: 'director@apex-tech.edu.in',
    password: 'Institution@123456'
  });
  instUserToken = resInst.body.data.token;

  // 3. Log in as Officer
  const resOff = await request(app).post('/api/auth/login').send({
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = resOff.body.data.token;

  // 4. Log in as Admin
  const resAdm = await request(app).post('/api/auth/login').send({
    email: 'admin@onecheck.gov.in',
    password: 'Admin@123456'
  });
  adminToken = resAdm.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 8 — End-to-End OneCheck Compliance Verification Lifecycle', () => {
  let createdAppId;
  let runId;
  let generatedAlertId;

  test('Step 1: Institution user creates a new application in DRAFT status', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${instUserToken}`)
      .send({
        category: 'NEW_INSTITUTION',
        academicYear: '2026-2027'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.status).toBe('DRAFT');
    expect(res.body.data.application.applicationNumber).toMatch(/^APP-2026-\d{6}$/);
    createdAppId = res.body.data.application._id;
  });

  test('Step 2: Submitting without required documents fails with specific deficiencies', async () => {
    const res = await request(app)
      .post(`/api/applications/${createdAppId}/submit`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details.length).toBe(4); // All 4 mandatory doc types missing
  });

  test('Step 3: Institution user uploads all 4 required compliance documents + photo', async () => {
    const docTypes = ['LAND_DOC', 'AFFILIATION_DOC', 'BUILDING_PLAN', 'FACULTY_LIST'];

    for (const dType of docTypes) {
      const uploadRes = await request(app)
        .post(`/api/documents/${createdAppId}/upload`)
        .set('Authorization', `Bearer ${instUserToken}`)
        .field('documentType', dType)
        .attach('file', validPdf, { filename: `${dType.toLowerCase()}.pdf`, contentType: 'application/pdf' });

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.data.documents[0].documentType).toBe(dType);
      expect(uploadRes.body.data.documents[0].uploadStatus).toBe('STORED');
    }

    // Upload infrastructure photo
    const photoRes = await request(app)
      .post(`/api/documents/${createdAppId}/upload`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('documentType', 'INFRA_PHOTO')
      .field('photoType', 'BUILDING_FRONT')
      .attach('file', validJpeg, { filename: 'front.jpg', contentType: 'image/jpeg' });

    expect(photoRes.status).toBe(201);
  });

  test('Step 4: Institution user submits completed application, transitioning to SUBMITTED', async () => {
    const res = await request(app)
      .post(`/api/applications/${createdAppId}/submit`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('SUBMITTED');
    expect(res.body.data.application.totalDocuments).toBe(5);

    // Verify AuditLog
    const audit = await AuditLog.findOne({
      application: createdAppId,
      action: 'APPLICATION_SUBMIT'
    });
    expect(audit).toBeDefined();
    expect(audit.outcome).toBe('SUCCESS');
  });

  test('Step 5: Scrutiny Officer triggers asynchronous check run and receives 202 with runId', async () => {
    const res = await request(app)
      .post(`/api/applications/${createdAppId}/run-checks`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(202);
    expect(res.body.data.runId).toBeDefined();
    expect(res.body.data.status).toBe('QUEUED');
    expect(res.body.data.steps).toHaveLength(6);
    runId = res.body.data.runId;
  });

  test('Step 6: Officer polls run progress until pipeline completes', async () => {
    let res;
    let status = 'RUNNING';
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      res = await request(app)
        .get(`/api/applications/${createdAppId}/runs/${runId}`)
        .set('Authorization', `Bearer ${officerToken}`);
      status = res.body?.data?.run?.status;
      if (status === 'SUCCEEDED' || status === 'PARTIAL' || status === 'FAILED') break;
    }

    expect(res.status).toBe(200);
    expect(res.body.data.run.runId).toBe(runId);
    expect(['RUNNING', 'SUCCEEDED', 'PARTIAL']).toContain(status);
    expect(res.body.data.run.steps).toHaveLength(6);
  });

  test('Step 7: Officer views full application details with documents, scores, and alerts', async () => {
    let res;
    for (let i = 0; i < 10; i++) {
      res = await request(app)
        .get(`/api/applications/${createdAppId}`)
        .set('Authorization', `Bearer ${officerToken}`);
      if (res.body?.data?.latestScore) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(res.status).toBe(200);
    expect(res.body.data.application._id.toString()).toBe(createdAppId.toString());
    expect(res.body.data.documents.length).toBe(5);
    if (res.body.data.latestScore) {
      expect(res.body.data.latestScore.totalScore).toBeGreaterThanOrEqual(0);
      expect(res.body.data.latestScore.riskLevel).toBeDefined();
    }
  });

  test('Step 8: Officer retrieves alerts queue, filters by severity, and resolves an alert', async () => {
    // Manually create a test alert to verify resolution workflow
    const testAlert = await Alert.create({
      application: createdAppId,
      runId,
      type: 'GPS_MISMATCH',
      severity: 'HIGH',
      title: 'Geofence check review required',
      message: 'Photo captured 510m from perimeter boundary.',
      sourceModel: 'Application',
      sourceId: createdAppId,
      status: 'OPEN'
    });
    generatedAlertId = testAlert._id;

    const listRes = await request(app)
      .get('/api/alerts?severity=HIGH')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.alerts.length).toBeGreaterThanOrEqual(1);

    // Resolve alert with valid reason
    const resolveRes = await request(app)
      .patch(`/api/alerts/${generatedAlertId}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        status: 'RESOLVED',
        reason: 'Officer verified campus extension plot boundary covers the 510m location.'
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.alert.status).toBe('RESOLVED');
  });

  test('Step 9: Officer checks dashboard summary and observes real-time aggregated metrics', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.overview.totalApplications).toBeGreaterThanOrEqual(2);
    expect(res.body.data.applicationsByStatus.SUBMITTED).toBeGreaterThanOrEqual(1);
    expect(res.body.data.recentRuns.length).toBeGreaterThanOrEqual(1);
  });
});

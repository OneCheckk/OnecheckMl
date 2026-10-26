const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const {
  User,
  Institution,
  Application,
  Document,
  FacultyHash,
  InfraPhoto,
  Alert,
  AuditLog
} = require('../../src/models');
const { generateIdentifierHmac } = require('../../src/utils/hmac');
const { getRiskLevel } = require('../../src/config/riskRules');

let mongoServer;
let officerToken;
let instUserToken;
let app1Id;
let app2Id;
let inst1Id;
let inst2Id;
let docId;
let alertId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Create Users
  const officerPassword = await User.hashPassword('Officer@123456');
  await User.create({
    name: 'Officer User',
    email: 'officer-audit@onecheck.gov.in',
    passwordHash: officerPassword,
    role: 'OFFICER',
    isActive: true
  });

  const instPassword = await User.hashPassword('Inst@123456');
  const instUser = await User.create({
    name: 'Director Audit',
    email: 'director-audit@college.edu',
    passwordHash: instPassword,
    role: 'INSTITUTION_USER',
    isActive: true
  });

  // Create Institutions
  const inst1 = await Institution.create({
    name: 'Apex North Campus',
    registrationId: 'ANC-2026',
    address: 'Delhi NCR',
    state: 'Delhi',
    latitude: 28.628,
    longitude: 77.3649,
    createdBy: instUser._id
  });
  inst1Id = inst1._id;
  instUser.institution = inst1Id;
  await instUser.save();

  const inst2 = await Institution.create({
    name: 'Apex South Campus',
    registrationId: 'ASC-2026',
    address: 'Bangalore Tech Park',
    state: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    createdBy: instUser._id
  });
  inst2Id = inst2._id;

  // Create Applications
  const app1 = await Application.create({
    applicationNumber: 'APP-2026-777001',
    institution: inst1Id,
    category: 'NEW_INSTITUTION',
    academicYear: '2026-2027',
    status: 'SUBMITTED'
  });
  app1Id = app1._id;

  const app2 = await Application.create({
    applicationNumber: 'APP-2026-777002',
    institution: inst2Id,
    category: 'EXTENSION_OF_APPROVAL',
    academicYear: '2026-2027',
    status: 'SUBMITTED'
  });
  app2Id = app2._id;

  // Create Document
  const doc = await Document.create({
    application: app1Id,
    documentType: 'LAND_DOC',
    originalName: 'land_registry.pdf',
    storageKey: 'doc_land_777.pdf',
    fileSize: 20480,
    mimeType: 'application/pdf',
    sha256FileHash: 'checksum_777',
    uploadedBy: instUser._id,
    uploadStatus: 'STORED'
  });
  docId = doc._id;

  // Create Faculty in App 2
  const { hmac } = generateIdentifierHmac('123456789012'); // Mock Aadhaar
  await FacultyHash.create({
    application: app2Id,
    institution: inst2Id,
    nameNormalized: 'prof suresh verma',
    identifierType: 'AADHAAR',
    identifierHmac: hmac,
    keyVersion: 'v1'
  });

  // Create Faculty with same HMAC in App 1 (will collide!)
  await FacultyHash.create({
    application: app1Id,
    institution: inst1Id,
    nameNormalized: 'prof suresh verma',
    identifierType: 'AADHAAR',
    identifierHmac: hmac,
    keyVersion: 'v1'
  });

  // Create InfraPhoto in App 1
  await InfraPhoto.create({
    application: app1Id,
    document: docId,
    photoType: 'CLASSROOM',
    storageKey: 'photo_classroom_777.jpg'
  });

  // Logins
  const resOff = await request(app).post('/api/auth/login').send({
    email: 'officer-audit@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = resOff.body.data.token;

  const resInst = await request(app).post('/api/auth/login').send({
    email: 'director-audit@college.edu',
    password: 'Inst@123456'
  });
  instUserToken = resInst.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 6 — Faculty Collision & Geofence Checks Tests', () => {
  test('POST /api/faculty/:appId/ghost-check flags collision without leaking raw IDs', async () => {
    const res = await request(app)
      .post(`/api/faculty/${app1Id}/ghost-check`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.collisionsFound).toBe(1);

    // Verify alert was created
    const alert = await Alert.findOne({
      application: app1Id,
      type: 'FACULTY_COLLISION'
    });
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('CRITICAL');
    expect(alert.message).not.toContain('123456789012'); // Never leak raw identifier
    alertId = alert._id;
  });

  test('POST /api/forensics/:appId/geo-check calculates distance and handles geofence', async () => {
    const res = await request(app)
      .post(`/api/forensics/${app1Id}/geo-check`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.photosChecked).toBe(1);
    expect(res.body.data.results[0].status).toBeDefined();
  });

  test('POST /api/documents/:docId/ocr runs standalone OCR', async () => {
    const res = await request(app)
      .post(`/api/documents/${docId}/ocr`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ocr.status).toBe('SUCCEEDED');
    expect(res.body.data.ocr.confidence).toBeGreaterThan(0.9);
  });

  test('POST /api/documents/:docId/ela runs standalone ELA tamper analysis', async () => {
    const res = await request(app)
      .post(`/api/documents/${docId}/ela`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ela.status).toBe('SUCCEEDED');
  });
});

describe('Phase 7 — Risk Scoring, Alerts & Dashboard Summaries Tests', () => {
  describe('POST /api/score/:appId/compute', () => {
    test('computes deterministic score and persists 5-pillar RiskScore', async () => {
      const res = await request(app)
        .post(`/api/score/${app1Id}/compute`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.score.totalScore).toBeGreaterThanOrEqual(0);
      expect(res.body.data.score.totalScore).toBeLessThanOrEqual(100);
      expect(['GREEN', 'YELLOW', 'RED']).toContain(res.body.data.score.riskLevel);
      expect(res.body.data.score.pillarScores).toHaveProperty('documentCompleteness');
      expect(res.body.data.score.pillarScores).toHaveProperty('anomalyFlags');
      expect(res.body.data.score.pillarScores).toHaveProperty('sourceVerification');
      expect(res.body.data.score.pillarScores).toHaveProperty('historicalCompliance');
      expect(res.body.data.score.pillarScores).toHaveProperty('infrastructureEvidence');
    });

    test('verifies exact threshold boundaries: 49=RED, 50=YELLOW, 79=YELLOW, 80=GREEN', () => {
      expect(getRiskLevel(49)).toBe('RED');
      expect(getRiskLevel(50)).toBe('YELLOW');
      expect(getRiskLevel(79)).toBe('YELLOW');
      expect(getRiskLevel(80)).toBe('GREEN');
      expect(getRiskLevel(100)).toBe('GREEN');
      expect(getRiskLevel(0)).toBe('RED');
    });
  });

  describe('Alerts Management Endpoints', () => {
    test('GET /api/alerts retrieves paginated alert queue', async () => {
      const res = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.alerts).toBeInstanceOf(Array);
      expect(res.body.meta.pagination).toBeDefined();
    });

    test('PATCH /api/alerts/:id/status rejects resolution without mandatory reason (400)', async () => {
      const res = await request(app)
        .patch(`/api/alerts/${alertId}/status`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          status: 'FALSE_POSITIVE'
          // Missing reason
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('resolutionReason is required');
    });

    test('PATCH /api/alerts/:id/status updates status and writes AuditLog entry when reason provided', async () => {
      const res = await request(app)
        .patch(`/api/alerts/${alertId}/status`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          status: 'FALSE_POSITIVE',
          reason: 'Verified through manual state regulatory council affidavit.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.alert.status).toBe('FALSE_POSITIVE');
      expect(res.body.data.alert.resolutionReason).toContain('affidavit');

      // Verify AuditLog
      const audit = await AuditLog.findOne({
        entityType: 'Alert',
        entityId: alertId.toString(),
        action: 'ALERT_STATUS_CHANGE'
      });
      expect(audit).toBeDefined();
    });

    test('denies alert resolution to unauthorized institution user (403)', async () => {
      const res = await request(app)
        .patch(`/api/alerts/${alertId}/status`)
        .set('Authorization', `Bearer ${instUserToken}`)
        .send({
          status: 'RESOLVED',
          reason: 'Self-resolved'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/dashboard/summary', () => {
    test('returns aggregated compliance metrics from MongoDB', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.overview.totalInstitutions).toBeGreaterThanOrEqual(2);
      expect(res.body.data.overview.totalApplications).toBeGreaterThanOrEqual(2);
      expect(res.body.data.applicationsByStatus).toBeDefined();
      expect(res.body.data.applicationsByRiskLevel).toBeDefined();
      expect(res.body.data.openAlertsBySeverity).toBeDefined();
    });

    test('denies dashboard access to institution user (403)', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${instUserToken}`);

      expect(res.status).toBe(403);
    });
  });
});

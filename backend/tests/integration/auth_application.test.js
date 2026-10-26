const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Document, AuditLog } = require('../../src/models');

let mongoServer;
let adminToken;
let officerToken;
let instUserToken1;
let instUserToken2;
let institution1;
let institution2;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // 1. Create Admin
  const adminPassword = await User.hashPassword('Admin@123456');
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin-test@onecheck.gov.in',
    passwordHash: adminPassword,
    role: 'ADMIN',
    isActive: true
  });

  // 2. Create Officer
  const officerPassword = await User.hashPassword('Officer@123456');
  const officer = await User.create({
    name: 'Officer User',
    email: 'officer-test@onecheck.gov.in',
    passwordHash: officerPassword,
    role: 'OFFICER',
    isActive: true
  });

  // 3. Create Institution Users
  const instPassword = await User.hashPassword('Inst@123456');
  const instUser1 = await User.create({
    name: 'Director College 1',
    email: 'director1@college.edu',
    passwordHash: instPassword,
    role: 'INSTITUTION_USER',
    isActive: true
  });

  const instUser2 = await User.create({
    name: 'Director College 2',
    email: 'director2@college.edu',
    passwordHash: instPassword,
    role: 'INSTITUTION_USER',
    isActive: true
  });

  // 4. Create Institutions
  institution1 = await Institution.create({
    name: 'Delhi Engineering College',
    registrationId: 'DEC-2026-001',
    address: 'Connaught Place, Delhi',
    state: 'Delhi',
    latitude: 28.6315,
    longitude: 77.2167,
    verificationStatus: 'VERIFIED',
    createdBy: instUser1._id
  });

  institution2 = await Institution.create({
    name: 'Mumbai Institute of Tech',
    registrationId: 'MIT-2026-002',
    address: 'Bandra, Mumbai',
    state: 'Maharashtra',
    latitude: 19.0596,
    longitude: 72.8295,
    verificationStatus: 'VERIFIED',
    createdBy: instUser2._id
  });

  instUser1.institution = institution1._id;
  await instUser1.save();

  instUser2.institution = institution2._id;
  await instUser2.save();

  // Obtain tokens via /api/auth/login
  const resAdmin = await request(app).post('/api/auth/login').send({
    email: 'admin-test@onecheck.gov.in',
    password: 'Admin@123456'
  });
  adminToken = resAdmin.body.data.token;

  const resOfficer = await request(app).post('/api/auth/login').send({
    email: 'officer-test@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = resOfficer.body.data.token;

  const resInst1 = await request(app).post('/api/auth/login').send({
    email: 'director1@college.edu',
    password: 'Inst@123456'
  });
  instUserToken1 = resInst1.body.data.token;

  const resInst2 = await request(app).post('/api/auth/login').send({
    email: 'director2@college.edu',
    password: 'Inst@123456'
  });
  instUserToken2 = resInst2.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 3 — Authentication & Authorization Tests', () => {
  describe('POST /api/auth/login', () => {
    test('succeeds with valid credentials and returns safe user DTO + JWT', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'admin-test@onecheck.gov.in',
        password: 'Admin@123456'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('admin-test@onecheck.gov.in');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    test('fails with 401 when password is wrong and does not leak specifics', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'admin-test@onecheck.gov.in',
        password: 'WrongPassword@123'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    test('fails with 401 when user account is inactive', async () => {
      const password = await User.hashPassword('Inactive@123');
      await User.create({
        name: 'Inactive User',
        email: 'inactive@onecheck.gov.in',
        passwordHash: password,
        role: 'OFFICER',
        isActive: false
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'inactive@onecheck.gov.in',
        password: 'Inactive@123'
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns 200 with current profile when valid JWT provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin-test@onecheck.gov.in');
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    test('returns 401 when token is missing', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('returns 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.bogus.jwt');
      expect(res.status).toBe(401);
    });
  });
});

describe('Phase 3 — Institutions & Cross-Institution Authorization Tests', () => {
  describe('POST /api/institutions', () => {
    test('creates institution when coordinates and registration are valid', async () => {
      const res = await request(app)
        .post('/api/institutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bangalore Institute of Tech',
          registrationId: 'BIT-2026-003',
          address: 'Electronic City, Bangalore',
          state: 'Karnataka',
          latitude: 12.9716,
          longitude: 77.5946
        });

      expect(res.status).toBe(201);
      expect(res.body.data.institution.registrationId).toBe('BIT-2026-003');
    });

    test('rejects creation when coordinates are out of bounds', async () => {
      const res = await request(app)
        .post('/api/institutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Geo Campus',
          address: 'No Road',
          state: 'Goa',
          latitude: 95.5, // Invalid > 90
          longitude: 77.0
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 409 CONFLICT on duplicate registration ID', async () => {
      const res = await request(app)
        .post('/api/institutions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate DEC College',
          registrationId: 'DEC-2026-001', // Already belongs to institution1
          address: 'Another address',
          state: 'Delhi',
          latitude: 28.5,
          longitude: 77.2
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /api/institutions/:id ownership rules', () => {
    test('institution user can read their own institution profile', async () => {
      const res = await request(app)
        .get(`/api/institutions/${institution1._id}`)
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.institution.name).toBe('Delhi Engineering College');
    });

    test('blocks institution user from reading another institution profile (403)', async () => {
      const res = await request(app)
        .get(`/api/institutions/${institution2._id}`)
        .set('Authorization', `Bearer ${instUserToken1}`); // User 1 accessing College 2

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('allows Officer to read any institution profile', async () => {
      const res = await request(app)
        .get(`/api/institutions/${institution2._id}`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.institution.name).toBe('Mumbai Institute of Tech');
    });
  });
});

describe('Phase 3 — Applications & Lifecycle State Machine Tests', () => {
  let appId1;

  describe('POST /api/applications', () => {
    test('creates application with server-generated unique number and DRAFT status', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${instUserToken1}`)
        .send({
          category: 'NEW_INSTITUTION',
          academicYear: '2026-2027'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.application.status).toBe('DRAFT');
      expect(res.body.data.application.applicationNumber).toMatch(/^APP-2026-\d{6}$/);
      expect(res.body.data.application.institution.toString()).toBe(institution1._id.toString());
      appId1 = res.body.data.application._id;
    });

    test('rejects creation when required category or academic year is missing', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${instUserToken1}`)
        .send({
          category: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/applications scoping & pagination', () => {
    test('institution user sees only applications belonging to their institution', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applications).toBeInstanceOf(Array);
      expect(res.body.data.applications.length).toBeGreaterThanOrEqual(1);
      for (const appItem of res.body.data.applications) {
        expect(appItem.institution._id.toString()).toBe(institution1._id.toString());
      }
      expect(res.body.meta.pagination).toBeDefined();
    });

    test('officer can see all applications and filter by status', async () => {
      const res = await request(app)
        .get('/api/applications?status=DRAFT')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.applications.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/applications/:id field protection', () => {
    test('allows updating whitelisted fields (category)', async () => {
      const res = await request(app)
        .patch(`/api/applications/${appId1}`)
        .set('Authorization', `Bearer ${instUserToken1}`)
        .send({
          category: 'EXTENSION_OF_APPROVAL'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.application.category).toBe('EXTENSION_OF_APPROVAL');
    });

    test('rejects attempts to tamper with protected fields (status, riskScore, assignedOfficer)', async () => {
      const res = await request(app)
        .patch(`/api/applications/${appId1}`)
        .set('Authorization', `Bearer ${instUserToken1}`)
        .send({
          status: 'APPROVED',
          riskScore: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/applications/:id/submit submission & deficiency check', () => {
    test('fails submission when required documents are missing and returns deficiency list', async () => {
      const res = await request(app)
        .post(`/api/applications/${appId1}/submit`)
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('deficiencies');
      expect(res.body.error.details).toBeInstanceOf(Array);
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(4); // All 4 required docs missing
    });

    test('succeeds submission when all required documents are stored and audits action', async () => {
      // Simulate stored required documents
      const docTypes = ['LAND_DOC', 'AFFILIATION_DOC', 'BUILDING_PLAN', 'FACULTY_LIST'];
      for (const dType of docTypes) {
        await Document.create({
          application: appId1,
          documentType: dType,
          originalName: `${dType}.pdf`,
          storageKey: `key_${dType}_${Date.now()}.pdf`,
          fileSize: 50000,
          mimeType: 'application/pdf',
          sha256FileHash: 'hash12345',
          uploadedBy: (await User.findOne({ email: 'director1@college.edu' }))._id,
          uploadStatus: 'STORED'
        });
      }

      const res = await request(app)
        .post(`/api/applications/${appId1}/submit`)
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.application.status).toBe('SUBMITTED');
      expect(res.body.data.application.totalDocuments).toBe(4);

      // Verify AuditLog entry was written
      const auditEntry = await AuditLog.findOne({
        application: appId1,
        action: 'APPLICATION_SUBMIT'
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry.outcome).toBe('SUCCESS');
    });

    test('prevents re-submitting an already SUBMITTED application', async () => {
      const res = await request(app)
        .post(`/api/applications/${appId1}/submit`)
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot submit application');
    });
  });
});

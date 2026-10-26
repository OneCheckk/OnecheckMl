const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, AuditEvent } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');
const { verifyAuditChain } = require('../../src/services/auditChain.service');

let mongoServer;
let instUserToken;
let officerToken;
let adminToken;
let auditorToken;
let institutionId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seeded = await seedDatabase(uri);
  institutionId = seeded.institution._id;

  // Login as institution user
  const res1 = await request(app).post('/api/auth/login').send({
    email: 'director@apex-tech.edu.in',
    password: 'Institution@123456'
  });
  instUserToken = res1.body.data.token;

  // Login as Officer
  const res2 = await request(app).post('/api/auth/login').send({
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = res2.body.data.token;

  // Login as Admin
  const res3 = await request(app).post('/api/auth/login').send({
    email: 'admin@onecheck.gov.in',
    password: 'Admin@123456'
  });
  adminToken = res3.body.data.token;

  // Login Auditor (seeded in seedDatabase)
  const res4 = await request(app).post('/api/auth/login').send({
    email: 'auditor@onecheck.gov.in',
    password: 'Auditor@123456'
  });
  auditorToken = res4.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Stage 8 — Cryptographic Audit Hash Chain & Tamper Verification', () => {
  test('Step 1: Normal system operations generate monotonically linked AuditEvents', async () => {
    // Perform actions that trigger audit events
    await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${instUserToken}`)
      .send({ category: 'EOA_CONTINUATION', academicYear: '2026-2027' });

    // Verify AuditEvents exist and are ordered
    const events = await AuditEvent.find().sort({ seq: 1 });
    expect(events.length).toBeGreaterThan(0);

    // Verify first event has GENESIS prevHash
    expect(events[0].seq).toBe(1);
    expect(events[0].prevHash).toBe('0'.repeat(64));
    expect(events[0].hash).toMatch(/^[a-f0-9]{64}$/);

    // If multiple events, verify sequential chaining
    for (let i = 1; i < events.length; i++) {
      expect(events[i].seq).toBe(i + 1);
      expect(events[i].prevHash).toBe(events[i - 1].hash);
      expect(events[i].hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  test('Step 2: GET /api/audit/verify confirms hash chain is cryptographically sound', async () => {
    // 1. Auditor verifies chain
    const res = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.totalEvents).toBeGreaterThan(0);
    expect(res.body.data.latestHash).toMatch(/^[a-f0-9]{64}$/);

    // 2. Institution user is denied access (403)
    const instDeny = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(instDeny.status).toBe(403);
  });

  test('Step 3: GET /api/audit allows paginated querying for authorized roles', async () => {
    const res = await request(app)
      .get('/api/audit?limit=5')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.limit).toBe(5);
  });

  test('Step 4: Tampering with an audit event breaks cryptographic verification', async () => {
    // 1. Tamper an event via dev tamper endpoint
    const tamperRes = await request(app)
      .post('/api/dev/tamper-audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ seq: 1 });

    expect(tamperRes.status).toBe(200);
    expect(tamperRes.body.success).toBe(true);
    expect(tamperRes.body.data.tamperedSeq).toBe(1);

    // 2. Chain verification must now FAIL and pinpoint brokenSeq = 1
    const verifyFailRes = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(verifyFailRes.status).toBe(200);
    expect(verifyFailRes.body.data.verified).toBe(false);
    expect(verifyFailRes.body.data.brokenSeq).toBe(1);
    expect(verifyFailRes.body.data.reason).toContain('mismatch');
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Rulepack, Checklist } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');

let mongoServer;
let adminToken;
let officerToken;
let instUserToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seeded = await seedDatabase(uri);

  // Login Admin
  const resAdm = await request(app).post('/api/auth/login').send({
    email: 'admin@onecheck.gov.in',
    password: 'Admin@123456'
  });
  adminToken = resAdm.body.data.token;

  // Login Officer
  const resOff = await request(app).post('/api/auth/login').send({
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = resOff.body.data.token;

  // Login Institution
  const resInst = await request(app).post('/api/auth/login').send({
    email: 'director@apex-tech.edu.in',
    password: 'Institution@123456'
  });
  instUserToken = resInst.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Stage 11 — Admin APIs, Dashboards & Benchmark Proxy', () => {
  test('Step 1: Admin Rulepacks API (list, create, activate)', async () => {
    // 1. List rulepacks
    const listRes = await request(app)
      .get('/api/admin/rulepacks')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    // 2. Create new rulepack
    const createRes = await request(app)
      .post('/api/admin/rulepacks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        version: '2026.2-test',
        yamlText: 'rules:\n  - id: TEST-001\n    title: Test Rule\n',
        notes: 'Test rulepack creation'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.version).toBe('2026.2-test');

    // 3. Activate rulepack
    const activateRes = await request(app)
      .post('/api/admin/rulepacks/2026.2-test/activate')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.active).toBe(true);

    const activeInDb = await Rulepack.findOne({ version: '2026.2-test' });
    expect(activeInDb.active).toBe(true);
  });

  test('Step 2: Admin Checklists API (list, update)', async () => {
    // 1. List checklists
    const listRes = await request(app)
      .get('/api/admin/checklists')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    // 2. Update checklist for category
    const updateRes = await request(app)
      .put('/api/admin/checklists/EOA_CONTINUATION')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: 'CHK-01', label: 'Form A', docTypes: ['SELF_DISCLOSURE_FORM'], required: true },
          { id: 'CHK-02', label: 'NOC', docTypes: ['FIRE_NOC'], required: true }
        ]
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.items.length).toBe(2);
  });

  test('Step 3: Admin Users API (list, create, update)', async () => {
    // 1. List users
    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    // 2. Create user
    const createRes = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Officer',
        email: 'new.officer@onecheck.gov.in',
        password: 'Password@123456',
        role: 'SCRUTINY_OFFICER'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.email).toBe('new.officer@onecheck.gov.in');
    const newUserId = createRes.body.data._id;

    // 3. Update user role
    const updateRes = await request(app)
      .patch(`/api/admin/users/${newUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'REGIONAL_DIRECTOR' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.role).toBe('REGIONAL_DIRECTOR');
  });

  test('Step 4: GET /api/dashboard/officer and /api/dashboard/institution', async () => {
    // 1. Officer dashboard
    const officerDashRes = await request(app)
      .get('/api/dashboard/officer')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(officerDashRes.status).toBe(200);
    expect(officerDashRes.body.success).toBe(true);
    expect(officerDashRes.body.data.byBand).toBeDefined();
    expect(officerDashRes.body.data.byStatus).toBeDefined();
    expect(officerDashRes.body.data.prioritizedQueue).toBeDefined();

    // 2. Institution dashboard
    const instDashRes = await request(app)
      .get('/api/dashboard/institution')
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(instDashRes.status).toBe(200);
    expect(instDashRes.body.success).toBe(true);
    expect(instDashRes.body.data.totalApplications).toBeDefined();
    expect(Array.isArray(instDashRes.body.data.applications)).toBe(true);
  });

  test('Step 5: Benchmark Proxy POST /api/benchmark/run and GET /api/benchmark/runs', async () => {
    // 1. Run benchmark
    const runRes = await request(app)
      .post('/api/benchmark/run')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ n: 2, seed: 42 });

    expect(runRes.status).toBe(200);
    expect(runRes.body.success).toBe(true);
    expect(runRes.body.data.runId).toBeDefined();
    expect(runRes.body.data.scores.extractionAccuracy).toBeDefined();
    expect(runRes.body.data.scores.perFault.length).toBeGreaterThan(0);

    // 2. List benchmark runs
    const listRes = await request(app)
      .get('/api/benchmark/runs')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);
  });
});

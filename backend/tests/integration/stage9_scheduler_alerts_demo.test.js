const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Finding, Alert, VerificationEntry } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');
const { runSchedulerTick } = require('../../src/services/scheduler.service');
const { resetSettings, updateSettings } = require('../../src/services/demoSettings.service');

let mongoServer;
let officerToken;
let instUserToken;
let applicationId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seeded = await seedDatabase(uri);

  // Login as Officer
  const resOff = await request(app).post('/api/auth/login').send({
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = resOff.body.data.token;

  // Login as Institution user
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
});

afterAll(async () => {
  resetSettings();
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Stage 9 — Alerts, Scheduler, Demo Settings & SSE', () => {
  let raisedAlertId;

  test('Step 1: GET and PUT /api/demo/settings manages time-travel simulation', async () => {
    // 1. GET default demo settings
    const getRes = await request(app).get('/api/demo/settings');
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.clockOffsetDays).toBe(0);

    // 2. PUT demo settings with clock offset
    const putRes = await request(app)
      .put('/api/demo/settings')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ clockOffsetDays: 90, forceSourceUnavailable: true });

    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);
    expect(putRes.body.data.clockOffsetDays).toBe(90);
    expect(putRes.body.data.forceSourceUnavailable).toBe(true);
  });

  test('Step 2: Scheduler tick evaluates findings alertAt against simulated effective time', async () => {
    // Create a finding with alertAt 30 days from now (which is in the past under a 90-day offset)
    const futureDate = new Date(Date.now() + 30 * 86400000);

    const finding = await Finding.create({
      findingId: `find_test_expiry_${Date.now()}`,
      applicationId,
      ruleId: 'NOC-VALIDITY-008',
      title: 'Fire Safety NOC lapses before approval period ends',
      message: 'Fire Safety NOC will expire in 90 days.',
      severity: 'MEDIUM',
      status: 'MANUAL_REVIEW_REQUIRED',
      alertAt: futureDate,
      disposition: { state: 'OPEN' }
    });

    // Run scheduler tick
    const tickResult = await runSchedulerTick();
    expect(tickResult.success).toBe(true);
    expect(tickResult.createdAlerts).toBeGreaterThanOrEqual(1);

    // Verify alert was created in MongoDB
    const alert = await Alert.findOne({
      application: applicationId,
      refType: 'Finding',
      refId: finding._id.toString()
    });

    expect(alert).not.toBeNull();
    expect(alert.type).toBe('DOC_EXPIRING');
    expect(alert.status).toBe('OPEN');
    raisedAlertId = alert._id;
  });

  test('Step 3: POST /api/alerts/:id/ack acknowledges the raised alert', async () => {
    const res = await request(app)
      .post(`/api/alerts/${raisedAlertId}/ack`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alert.status).toBe('ACKNOWLEDGED');

    const inDb = await Alert.findById(raisedAlertId);
    expect(inDb.status).toBe('ACKNOWLEDGED');
  });

  test('Step 4: SSE service subscribes client and broadcasts live events', (done) => {
    const { EventEmitter } = require('events');
    const { subscribe, broadcast } = require('../../src/services/sse.service');

    const mockReq = new EventEmitter();
    const mockRes = new EventEmitter();
    mockRes.writeHead = jest.fn();
    mockRes.write = jest.fn((chunk) => {
      if (typeof chunk === 'string' && chunk.includes('TEST_EVENT')) {
        expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/event-stream' }));
        mockReq.emit('close');
        done();
      }
    });

    subscribe(mockReq, mockRes);
    broadcast('TEST_EVENT', { sample: 123 });
  });
});

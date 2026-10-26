const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const authenticate = require('../../src/middleware/authenticate');
const { authorize } = require('../../src/middleware/authorize');
const validate = require('../../src/middleware/validate');
const requestIdMiddleware = require('../../src/middleware/requestId');
const errorHandler = require('../../src/middleware/errorHandler');
const {
  claimPatchSchema,
  findingDispositionSchema,
  applicationDecisionSchema,
  manualConfirmSchema
} = require('../../src/validators/schemas');
const { User } = require('../../src/models');

describe('Stage 2 — Auth, RBAC, Request IDs & Zod Validation Unit Tests', () => {
  let app;
  let testUser;
  let validToken;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);

    // Mock User findById for authenticate middleware
    testUser = {
      _id: '6719876543210123456789ab',
      name: 'Auditor User',
      email: 'auditor.test@onecheck.gov.in',
      role: 'AUDITOR',
      isActive: true,
      institution: null
    };

    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue(testUser)
    });

    validToken = jwt.sign(
      { id: testUser._id, role: testUser.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Test routes
    app.get('/test/scoped-auditor', authenticate, authorize('AUDITOR'), (req, res) => {
      res.json({ success: true, role: req.user.role });
    });

    app.get('/test/scoped-officer', authenticate, authorize('SCRUTINY_OFFICER'), (req, res) => {
      res.json({ success: true, role: req.user.role });
    });

    app.post('/test/zod-disposition', validate(findingDispositionSchema), (req, res) => {
      res.json({ success: true, data: req.validatedBody });
    });

    app.post('/test/zod-claim', validate(claimPatchSchema), (req, res) => {
      res.json({ success: true, data: req.validatedBody });
    });

    app.use(errorHandler);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('Request ID middleware attaches unique ID and sets X-Request-Id header', async () => {
    const res = await request(app).get('/test/scoped-auditor')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.headers).toHaveProperty('x-request-id');
    expect(res.headers['x-request-id']).toMatch(/^req-/);
  });

  test('RBAC allows authorized AUDITOR role', async () => {
    const res = await request(app).get('/test/scoped-auditor')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.role).toBe('AUDITOR');
  });

  test('RBAC denies unauthorized access (AUDITOR accessing SCRUTINY_OFFICER route)', async () => {
    const res = await request(app).get('/test/scoped-officer')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('Zod validation succeeds with valid finding disposition', async () => {
    const res = await request(app).post('/test/zod-disposition').send({
      state: 'DISMISSED',
      reason: 'Verified with physical building inspection report #402'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('DISMISSED');
  });

  test('Zod validation rejects DISMISSED finding without mandatory 10-character reason', async () => {
    const res = await request(app).post('/test/zod-disposition').send({
      state: 'DISMISSED',
      reason: 'Too short'
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].message).toContain('at least 10 characters');
  });

  test('Zod validation rejects claim correction with invalid reason', async () => {
    const res = await request(app).post('/test/zod-claim').send({
      value: 700,
      reason: 'Bad'
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('reason');
  });
});

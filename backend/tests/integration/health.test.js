const request = require('supertest');
const app = require('../../src/app');
const database = require('../../src/config/database');

describe('Health and System Foundation Integration Tests', () => {
  describe('GET /api/health', () => {
    test('returns 503 SERVICE_UNAVAILABLE when MongoDB is not connected', async () => {
      // Ensure database is disconnected
      jest.spyOn(database, 'isReady').mockReturnValue(false);

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'SERVICE_UNAVAILABLE');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('requestId');
    });

    test('returns 200 and standard success envelope when MongoDB is ready', async () => {
      jest.spyOn(database, 'isReady').mockReturnValue(true);

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'UP');
      expect(response.body.data).toHaveProperty('database', 'CONNECTED');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('requestId');
    });
  });

  describe('Centralized 404 and Error Envelope', () => {
    test('returns standard error envelope for undefined routes', async () => {
      const response = await request(app).get('/api/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.meta).toHaveProperty('requestId');
      expect(response.headers).toHaveProperty('x-request-id');
    });
  });
});

const ApiError = require('../../src/utils/ApiError');
const { parsePagination, buildPaginationMeta } = require('../../src/utils/pagination');
const requestIdMiddleware = require('../../src/middleware/requestId');

describe('Foundation Unit Tests', () => {
  describe('ApiError utility', () => {
    test('creates badRequest error with VALIDATION_ERROR code', () => {
      const error = ApiError.badRequest('Field is missing', [{ field: 'name', message: 'Required' }]);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Field is missing');
      expect(error.details).toHaveLength(1);
      expect(error.isOperational).toBe(true);
    });

    test('creates unauthorized error with 401 status', () => {
      const error = ApiError.unauthorized('No token provided');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    test('creates forbidden error with 403 status', () => {
      const error = ApiError.forbidden('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    test('creates conflict error with 409 status', () => {
      const error = ApiError.conflict('Already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    test('creates file error utilities', () => {
      const large = ApiError.fileTooLarge();
      expect(large.statusCode).toBe(413);
      expect(large.code).toBe('FILE_TOO_LARGE');

      const unsupported = ApiError.unsupportedMediaType();
      expect(unsupported.statusCode).toBe(415);
      expect(unsupported.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('Pagination utility', () => {
    test('provides safe default values when query is empty', () => {
      const result = parsePagination({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('desc');
    });

    test('caps limit at 100 to prevent DOS unbounded queries', () => {
      const result = parsePagination({ page: 2, limit: 500 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(100);
      expect(result.skip).toBe(100);
    });

    test('rejects non-allowlisted sort fields', () => {
      const result = parsePagination(
        { sortBy: 'maliciousField', sortOrder: 'asc' },
        ['createdAt', 'riskScore']
      );
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('asc');
    });

    test('builds accurate pagination metadata', () => {
      const meta = buildPaginationMeta(2, 20, 45);
      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(20);
      expect(meta.totalItems).toBe(45);
      expect(meta.totalPages).toBe(3);
    });
  });

  describe('RequestId Middleware', () => {
    test('generates a new UUID request ID if none is supplied', () => {
      const req = { headers: {} };
      const res = {
        locals: {},
        setHeader: jest.fn()
      };
      const next = jest.fn();

      requestIdMiddleware(req, res, next);

      expect(req.id).toBeDefined();
      expect(req.id.startsWith('req-')).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
      expect(next).toHaveBeenCalled();
    });

    test('preserves existing x-request-id header', () => {
      const customId = 'client-trace-12345';
      const req = { headers: { 'x-request-id': customId } };
      const res = {
        locals: {},
        setHeader: jest.fn()
      };
      const next = jest.fn();

      requestIdMiddleware(req, res, next);

      expect(req.id).toBe(customId);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', customId);
      expect(next).toHaveBeenCalled();
    });
  });
});

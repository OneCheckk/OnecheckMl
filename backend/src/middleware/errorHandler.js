const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const requestId = res.locals.requestId || req.id || 'unknown';

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred. Please try again later.';
  let details = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    // Mongoose schema validation error
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed for one or more fields.';
    details = Object.keys(err.errors || {}).map((field) => ({
      field,
      message: err.errors[field].message
    }));
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    code = 'CONFLICT';
    const fields = Object.keys(err.keyPattern || {});
    message = `Duplicate value provided for unique field: ${fields.join(', ')}`;
    details = fields.map((f) => ({ field: f, message: `A record with this ${f} already exists.` }));
  } else if (err.name === 'CastError') {
    // Invalid ObjectId format
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = `Invalid format for field '${err.path}'`;
    details = [{ field: err.path, message: `Value '${err.value}' is not a valid identifier.` }];
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = err.name === 'TokenExpiredError' ? 'Session token expired' : 'Invalid session token';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'FILE_TOO_LARGE';
    message = 'Uploaded file exceeds the maximum permitted size.';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Unexpected file field encountered in multipart payload.';
  }

  // Log non-operational errors or 500s privately with stack trace
  if (statusCode >= 500) {
    logger.error(`[Unhandled Error] ${err.message}`, {
      requestId,
      code,
      path: req.originalUrl,
      method: req.method,
      stack: err.stack,
      suppressInTest: process.env.NODE_ENV === 'test'
    });
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details
    },
    meta: {
      requestId
    }
  });
}

module.exports = errorHandler;

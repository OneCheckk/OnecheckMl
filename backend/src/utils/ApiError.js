class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = Array.isArray(details) ? details : [details];
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Invalid request', details = []) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Access denied') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Resource conflict or duplicate entry') {
    return new ApiError(409, 'CONFLICT', message);
  }

  static fileTooLarge(message = 'File size exceeds allowed limit') {
    return new ApiError(413, 'FILE_TOO_LARGE', message);
  }

  static unsupportedMediaType(message = 'File format or MIME type not supported') {
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', message);
  }

  static internal(message = 'An internal server error occurred') {
    const error = new ApiError(500, 'INTERNAL_ERROR', message);
    error.isOperational = false;
    return error;
  }
}

module.exports = ApiError;

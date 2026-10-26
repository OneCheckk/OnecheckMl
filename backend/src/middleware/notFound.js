const ApiError = require('../utils/ApiError');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route '${req.method} ${req.originalUrl}' does not exist.`));
}

module.exports = notFoundHandler;

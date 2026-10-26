const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { User } = require('../models');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('Authentication token is missing or malformed'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(ApiError.unauthorized('Bearer token value is required'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Authentication token has expired'));
      }
      return next(ApiError.unauthorized('Invalid authentication token signature'));
    }

    const user = await User.findById(decoded.id).select('+passwordHash');
    if (!user) {
      return next(ApiError.unauthorized('User associated with this token no longer exists'));
    }

    if (user.isActive === false || user.active === false) {
      return next(ApiError.unauthorized('User account has been deactivated'));
    }

    if (!user.institutionId && user.institution) {
      user.institutionId = user.institution;
    }

    // Attach sanitized user to request
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;

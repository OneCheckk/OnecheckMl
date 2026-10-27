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

    // Support frontend dev bypass tokens in development / demo mode
    if (token.startsWith('dev-mock-jwt-token-for-') && (env.NODE_ENV === 'development' || env.DEMO_MODE || !env.NODE_ENV)) {
      const roleSuffix = token.replace('dev-mock-jwt-token-for-', '').toLowerCase();
      let targetRole = 'OFFICER';
      let targetEmail = 'officer@onecheck.gov.in';

      if (roleSuffix.includes('inst')) {
        targetRole = 'INSTITUTION_USER';
        targetEmail = 'director@apex-tech.edu.in';
      } else if (roleSuffix.includes('admin')) {
        targetRole = 'ADMIN';
        targetEmail = 'admin@onecheck.gov.in';
      } else if (roleSuffix.includes('audit')) {
        targetRole = 'AUDITOR';
        targetEmail = 'auditor@onecheck.gov.in';
      } else if (roleSuffix.includes('director')) {
        targetRole = 'REGIONAL_DIRECTOR';
        targetEmail = 'director.regional@onecheck.gov.in';
      }

      let user = null;
      try {
        user = await User.findOne({ email: targetEmail });
      } catch (dbErr) {
        // Fall back to synthetic mock user if DB is currently unreachable
      }

      if (!user) {
        user = {
          _id: '6ade1b1356023d453cb0afbc',
          name: `Dev Bypass ${targetRole}`,
          email: targetEmail,
          role: targetRole,
          isActive: true,
          toJSON: () => ({
            _id: '6ade1b1356023d453cb0afbc',
            name: `Dev Bypass ${targetRole}`,
            email: targetEmail,
            role: targetRole,
            isActive: true
          })
        };
      }

      req.user = user;
      return next();
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

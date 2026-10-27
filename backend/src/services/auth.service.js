const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { User } = require('../models');
const { logEvent } = require('./audit.service');

/**
 * Validates credentials and generates access token
 */
async function login(email, password, requestId = null) {
  const normalizedEmail = email.toLowerCase().trim();
  const EMAIL_ALIASES = {
    'officer.rao@aicte.gov.in': 'officer@onecheck.gov.in',
    'officer@aicte.gov.in': 'officer@onecheck.gov.in',
    'institution@apex-tech.edu.in': 'director@apex-tech.edu.in',
    'admin@aicte.gov.in': 'admin@onecheck.gov.in',
    'auditor@cag.gov.in': 'auditor@onecheck.gov.in',
    'director@aicte.gov.in': 'director.regional@onecheck.gov.in'
  };
  const effectiveEmail = EMAIL_ALIASES[normalizedEmail] || normalizedEmail;
  const user = await User.findOne({ email: effectiveEmail }).select('+passwordHash');

  if (!user || !user.isActive) {
    await logEvent({
      action: 'LOGIN_FAILURE',
      entityType: 'User',
      requestId,
      outcome: 'FAILURE',
      metadata: { email: normalizedEmail, reason: 'INVALID_CREDENTIALS_OR_INACTIVE' }
    });
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (password) {
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await logEvent({
        actorUser: user._id,
        action: 'LOGIN_FAILURE',
        entityType: 'User',
        entityId: user._id,
        requestId,
        outcome: 'FAILURE',
        metadata: { email: normalizedEmail, reason: 'PASSWORD_MISMATCH' }
      });
      throw ApiError.unauthorized('Invalid email or password');
    }
  } else if (!env.DEMO_MODE) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  // Generate JWT access token
  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      institution: user.institution || null
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  await logEvent({
    actorUser: user._id,
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { role: user.role }
  });

  const safeUser = user.toJSON();

  return {
    user: safeUser,
    token,
    expiresIn: env.JWT_EXPIRES_IN
  };
}

/**
 * Retrieves the current authenticated user's profile
 */
async function getCurrentUser(userId) {
  let user = null;
  try {
    user = await User.findById(userId).populate('institution', 'name registrationId state verificationStatus');
  } catch (err) {
    // DB or ID conversion issue
  }

  if (!user) {
    if (env.NODE_ENV === 'development' || env.DEMO_MODE) {
      return {
        _id: userId || '6ade1b1356023d453cb0afbc',
        name: 'Development User',
        email: 'officer@onecheck.gov.in',
        role: 'OFFICER',
        isActive: true
      };
    }
    throw ApiError.notFound('User profile not found');
  }
  return user.toJSON();
}

module.exports = {
  login,
  getCurrentUser
};

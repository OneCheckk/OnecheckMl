const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const requestId = res.locals.requestId || req.id;
  const result = await authService.login(email, password, requestId);

  res.status(200).json({
    success: true,
    data: result,
    meta: {
      requestId
    }
  });
});

const getMe = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const user = await authService.getCurrentUser(req.user._id);

  res.status(200).json({
    success: true,
    data: { user },
    meta: {
      requestId
    }
  });
});

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

const devBypass = asyncHandler(async (req, res) => {
  const { role } = req.body || {};
  const roleUpper = (role || 'SCRUTINY_OFFICER').toUpperCase();

  const ROLE_MAP = {
    INSTITUTION: { email: 'director@apex-tech.edu.in', role: 'INSTITUTION_USER', name: 'Dr. Ramesh Sharma' },
    INSTITUTION_USER: { email: 'director@apex-tech.edu.in', role: 'INSTITUTION_USER', name: 'Dr. Ramesh Sharma' },
    SCRUTINY_OFFICER: { email: 'officer@onecheck.gov.in', role: 'OFFICER', name: 'Senior Scrutiny Officer' },
    OFFICER: { email: 'officer@onecheck.gov.in', role: 'OFFICER', name: 'Senior Scrutiny Officer' },
    ADMIN: { email: 'admin@onecheck.gov.in', role: 'ADMIN', name: 'System Administrator' },
    AUDITOR: { email: 'auditor@onecheck.gov.in', role: 'AUDITOR', name: 'Regulatory Compliance Auditor' },
    REGIONAL_DIRECTOR: { email: 'director.regional@onecheck.gov.in', role: 'REGIONAL_DIRECTOR', name: 'Northern Regional Director' },
  };

  const target = ROLE_MAP[roleUpper] || ROLE_MAP.SCRUTINY_OFFICER;
  let user = null;
  try {
    user = await User.findOne({ email: target.email });
  } catch (err) {
    // Ignore DB error
  }

  if (!user) {
    user = {
      _id: '6ade1b1356023d453cb0afbc',
      name: target.name,
      email: target.email,
      role: target.role,
      isActive: true,
      toJSON: () => ({
        _id: '6ade1b1356023d453cb0afbc',
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: true
      })
    };
  }

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

  const safeUser = typeof user.toJSON === 'function' ? user.toJSON() : user;

  res.status(200).json({
    success: true,
    data: {
      user: safeUser,
      token,
      expiresIn: env.JWT_EXPIRES_IN
    }
  });
});

module.exports = {
  login,
  getMe,
  devBypass
};

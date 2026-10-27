const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { validateLogin } = require('../validators/auth.validator');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Canonical: POST /api/auth/login
router.post('/login', loginLimiter, validate(validateLogin), authController.login);

// Development & Demo Bypass: POST /api/auth/dev-bypass
router.post('/dev-bypass', authController.devBypass);

// Canonical: GET /api/auth/me
router.get('/me', authenticate, authController.getMe);

module.exports = router;

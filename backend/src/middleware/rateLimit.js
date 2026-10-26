const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Max 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const requestId = res.locals.requestId || req.id || 'unknown';
    res.status(429).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Too many login attempts. Please wait 15 minutes before trying again.',
        details: []
      },
      meta: {
        requestId
      }
    });
  }
});

module.exports = {
  loginLimiter
};

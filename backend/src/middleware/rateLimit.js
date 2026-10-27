const rateLimit = require('express-rate-limit');
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: isDev ? 1000 : 30, // 1000 attempts in development, 30 in production
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

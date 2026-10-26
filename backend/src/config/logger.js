const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'jwt',
  'authorization',
  'aadhaar',
  'pan',
  'identifierhmac',
  'secret',
  'extractedtext'
];

/**
 * Recursively sanitizes objects to prevent leaking sensitive fields in logs
 */
function sanitize(obj, depth = 0) {
  if (!obj || depth > 4) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, depth + 1));
  }

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitize(val, depth + 1);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

const logger = {
  info: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'test') return;
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        message,
        ...sanitize(meta)
      })
    );
  },
  warn: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'test') return;
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'WARN',
        timestamp: new Date().toISOString(),
        message,
        ...sanitize(meta)
      })
    );
  },
  error: (message, meta = {}) => {
    // In tests, suppress expected error logs to keep test output clean
    if (process.env.NODE_ENV === 'test' && meta.suppressInTest) return;
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        message,
        ...sanitize(meta)
      })
    );
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'development') return;
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        level: 'DEBUG',
        timestamp: new Date().toISOString(),
        message,
        ...sanitize(meta)
      })
    );
  }
};

module.exports = logger;

const crypto = require('crypto');
const env = require('../config/env');

/**
 * Normalizes identifier (strips whitespace, dashes, uppercase)
 */
function normalizeIdentifier(rawIdentifier) {
  if (!rawIdentifier || typeof rawIdentifier !== 'string') return '';
  return rawIdentifier.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Computes deterministic secret-keyed HMAC-SHA256 for cross-institution collision check
 * NOTE: Never log or store raw national identifiers. Key material is restricted to environment secrets.
 */
function generateIdentifierHmac(rawIdentifier, secret = env.HMAC_SECRET) {
  const normalized = normalizeIdentifier(rawIdentifier);
  const hmac = crypto.createHmac('sha256', secret).update(normalized).digest('hex');
  return {
    hmac,
    keyVersion: env.HMAC_KEY_VERSION
  };
}

module.exports = {
  normalizeIdentifier,
  generateIdentifierHmac
};

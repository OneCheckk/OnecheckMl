const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requiredKeys = ['JWT_SECRET', 'HMAC_SECRET'];

const missing = requiredKeys.filter((key) => !process.env[key]);
if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn(`[Config Warning] Missing recommended environment variables: ${missing.join(', ')}`);
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 4000,
  MONGODB_URI: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onecheck',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_dev_secret_never_use_in_production_key_12345',
  JWT_EXPIRES_IN: process.env.JWT_TTL || process.env.JWT_EXPIRES_IN || '8h',
  JWT_TTL: process.env.JWT_TTL || process.env.JWT_EXPIRES_IN || '8h',
  ML_BASE_URL: process.env.ML_BASE_URL || process.env.VERIFICATION_SERVICE_URL || 'http://127.0.0.1:8001',
  VERIFICATION_SERVICE_URL: process.env.ML_BASE_URL || process.env.VERIFICATION_SERVICE_URL || 'http://127.0.0.1:8001',
  VERIFICATION_TIMEOUT_MS: parseInt(process.env.VERIFICATION_TIMEOUT_MS, 10) || 30000,
  STORAGE_ROOT: process.env.STORAGE_ROOT || process.env.UPLOAD_DIR || './storage',
  UPLOAD_DIR: process.env.STORAGE_ROOT || process.env.UPLOAD_DIR || './storage',
  MAX_UPLOAD_MB: parseInt(process.env.MAX_UPLOAD_MB || process.env.MAX_FILE_SIZE_MB, 10) || 25,
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_UPLOAD_MB || process.env.MAX_FILE_SIZE_MB, 10) || 25,
  MAX_FILES_PER_REQUEST: parseInt(process.env.MAX_FILES_PER_REQUEST, 10) || 10,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173'],
  ALLOWED_MIME: process.env.ALLOWED_MIME
    ? process.env.ALLOWED_MIME.split(',').map((m) => m.trim())
    : ['application/pdf', 'image/jpeg', 'image/png'],
  HMAC_KEY: process.env.HMAC_KEY || process.env.HMAC_SECRET || 'fallback_hmac_secret_for_local_testing_key_12345',
  HMAC_SECRET: process.env.HMAC_KEY || process.env.HMAC_SECRET || 'fallback_hmac_secret_for_local_testing_key_12345',
  HMAC_KEY_VERSION: process.env.HMAC_KEY_VERSION || 'v1',
  DEMO_MODE: process.env.DEMO_MODE !== 'false',
  PENDING_ALERT_MINUTES: parseInt(process.env.PENDING_ALERT_MINUTES, 10) || 60,
  EXPIRY_ALERT_DAYS: parseInt(process.env.EXPIRY_ALERT_DAYS, 10) || 90,
  OCR_CONF_MIN: parseFloat(process.env.OCR_CONF_MIN) || 0.80,
  MOCK_VERIFICATION_SERVICE: process.env.MOCK_VERIFICATION_SERVICE === 'true' || process.env.NODE_ENV === 'test'
};

module.exports = env;

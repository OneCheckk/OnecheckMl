const { AuditLog } = require('../models');
const { appendAuditEvent } = require('./auditChain.service');
const logger = require('../config/logger');

const SENSITIVE_FIELDS = ['password', 'token', 'jwt', 'aadhaar', 'pan', 'extractedText', 'secret'];

/**
 * Sanitizes metadata object to prevent any sensitive fields in audit log
 */
function sanitizeAuditMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};
  const clean = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((s) => lowerKey.includes(s))) {
      clean[key] = '[REDACTED]';
    } else if (value instanceof Date) {
      clean[key] = value.toISOString();
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      clean[key] = sanitizeAuditMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Appends an audit event to both legacy AuditLog and the cryptographic AuditEvent hash chain
 */
async function logEvent({
  actorUser = null,
  action,
  entityType = 'SYSTEM',
  entityId = null,
  application = null,
  requestId = null,
  outcome = 'SUCCESS',
  metadata = {}
}) {
  try {
    const cleanMeta = sanitizeAuditMetadata(metadata);
    const auditRecord = await AuditLog.create({
      actorUser: actorUser?._id || actorUser || null,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      application: application?._id || application || null,
      requestId,
      outcome,
      metadata: cleanMeta
    });

    // Also append to the cryptographic hash chain
    await appendAuditEvent({
      actor: {
        id: actorUser?._id ? String(actorUser._id) : (actorUser ? String(actorUser) : 'SYSTEM'),
        role: actorUser?.role || 'SYSTEM'
      },
      action,
      entity: {
        type: entityType,
        id: entityId ? String(entityId) : 'NONE'
      },
      payload: {
        ...cleanMeta,
        applicationId: application?._id ? String(application._id) : (application ? String(application) : null),
        outcome,
        requestId
      }
    });

    // Broadcast event to connected SSE clients
    try {
      const { broadcast } = require('./sse.service');
      broadcast('AUDIT_EVENT', {
        action,
        entityType,
        entityId,
        outcome,
        applicationId: application?._id || application || null,
        timestamp: new Date().toISOString()
      });
    } catch (_) {
      // Non-blocking
    }

    return auditRecord;
  } catch (err) {
    // Audit log failure should be logged privately but not crash primary business transaction
    logger.error('Failed to persist audit log record', {
      action,
      entityType,
      error: err.message,
      suppressInTest: process.env.NODE_ENV === 'test'
    });
    return null;
  }
}

module.exports = {
  logEvent,
  sanitizeAuditMetadata
};

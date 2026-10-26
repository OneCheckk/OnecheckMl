/**
 * Cryptographic Audit Hash Chain Service
 * Implements monotonic sequence allocation, single-queue serialization,
 * canonical JSON serialization, and SHA-256 chain verification.
 */

const crypto = require('crypto');
const { AuditEvent, Counter } = require('../models');
const logger = require('../config/logger');

const GENESIS_HASH = '0'.repeat(64);

let chainQueue = Promise.resolve();

/**
 * Deterministic canonical JSON stringification with recursively sorted keys.
 * Handles Dates, ObjectIds, and nested objects consistently.
 */
function canonicalStringify(val) {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (val instanceof Date) {
    return JSON.stringify(val.toISOString());
  }
  if (typeof val === 'object') {
    if (typeof val.toHexString === 'function') {
      return JSON.stringify(val.toHexString());
    }
    if (val.constructor && val.constructor.name === 'ObjectId') {
      return JSON.stringify(val.toString());
    }
    if (typeof val.toJSON === 'function') {
      return canonicalStringify(val.toJSON());
    }
    if (Array.isArray(val)) {
      return '[' + val.map(canonicalStringify).join(',') + ']';
    }
    const keys = Object.keys(val).filter((k) => val[k] !== undefined).sort();
    const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(val[k]));
    return '{' + pairs.join(',') + '}';
  }
  return JSON.stringify(val);
}

/**
 * Appends an audit event to the cryptographic hash chain
 */
async function appendAuditEvent({ actor = null, action, entity = {}, payload = {}, ts = new Date() }) {
  // Wrap in promise queue to ensure sequential execution
  const task = async () => {
    try {
      // 1. Allocate next monotonic sequence
      const counter = await Counter.findOneAndUpdate(
        { name: 'audit_event_seq' },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
      );
      const seq = counter.value;

      // 2. Fetch previous event hash
      let prevHash = GENESIS_HASH;
      if (seq > 1) {
        const lastEvent = await AuditEvent.findOne({ seq: seq - 1 });
        if (lastEvent) {
          prevHash = lastEvent.hash;
        }
      }

      // 3. Format event data with consistent normalized timestamp and payload
      const eventDate = ts instanceof Date ? ts : new Date(ts);
      const tsIso = new Date(eventDate.getTime()).toISOString();

      // Normalize payload to ensure plain JSON representation matches persistence
      let normalizedPayload = {};
      try {
        normalizedPayload = JSON.parse(JSON.stringify(payload || {}));
      } catch (_) {
        normalizedPayload = payload || {};
      }

      const eventData = {
        seq,
        ts: tsIso,
        actor: {
          id: actor?.id ? String(actor.id) : (actor?._id ? String(actor._id) : 'SYSTEM'),
          role: actor?.role || 'SYSTEM'
        },
        action: String(action),
        entity: {
          type: entity?.type || 'SYSTEM',
          id: entity?.id ? String(entity.id) : 'NONE'
        },
        payload: normalizedPayload
      };

      // 4. Compute SHA-256 hash
      const canonical = canonicalStringify(eventData);
      const hash = crypto.createHash('sha256').update(prevHash + canonical).digest('hex');

      // 5. Persist event
      const eventRecord = await AuditEvent.create({
        seq,
        ts: new Date(tsIso),
        actor: eventData.actor,
        action,
        entity: eventData.entity,
        payload: eventData.payload,
        prevHash,
        hash
      });

      return eventRecord;
    } catch (err) {
      logger.error(`Failed to append cryptographic audit event: ${err.message}`);
      return null;
    }
  };

  chainQueue = chainQueue.then(task, task);
  return chainQueue;
}

/**
 * Verifies cryptographic integrity of the entire audit hash chain
 */
async function verifyAuditChain() {
  const events = await AuditEvent.find().sort({ seq: 1 });

  if (events.length === 0) {
    return {
      verified: true,
      totalEvents: 0,
      latestHash: GENESIS_HASH,
      verifiedAt: new Date().toISOString()
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Verify monotonic sequence numbering
    if (event.seq !== i + 1) {
      return {
        verified: false,
        brokenSeq: event.seq,
        reason: `Monotonic sequence broken. Expected ${i + 1}, found ${event.seq}`,
        verifiedAt: new Date().toISOString()
      };
    }

    // Verify linkage to previous event's hash
    if (event.prevHash !== expectedPrevHash) {
      return {
        verified: false,
        brokenSeq: event.seq,
        reason: 'Previous hash mismatch',
        expectedPrevHash,
        actualPrevHash: event.prevHash,
        verifiedAt: new Date().toISOString()
      };
    }

    // Recompute event hash
    const eventData = {
      seq: event.seq,
      ts: event.ts.toISOString(),
      actor: {
        id: event.actor.id,
        role: event.actor.role
      },
      action: event.action,
      entity: {
        type: event.entity.type,
        id: event.entity.id
      },
      payload: event.payload
    };

    const computedHash = crypto
      .createHash('sha256')
      .update(expectedPrevHash + canonicalStringify(eventData))
      .digest('hex');

    if (computedHash !== event.hash) {
      return {
        verified: false,
        brokenSeq: event.seq,
        reason: 'Cryptographic hash mismatch. Payload or metadata was altered.',
        expectedHash: computedHash,
        actualHash: event.hash,
        verifiedAt: new Date().toISOString()
      };
    }

    expectedPrevHash = event.hash;
  }

  return {
    verified: true,
    totalEvents: events.length,
    latestHash: events[events.length - 1].hash,
    verifiedAt: new Date().toISOString()
  };
}

module.exports = {
  appendAuditEvent,
  verifyAuditChain,
  canonicalStringify,
  GENESIS_HASH
};

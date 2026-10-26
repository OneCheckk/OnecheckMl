/**
 * Audit Controller
 * Manages queries, verification, and demo tampering for the cryptographic audit hash chain
 */

const { AuditEvent } = require('../models');
const { verifyAuditChain } = require('../services/auditChain.service');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

async function getAuditEvents(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const query = {};

    if (req.query.action) query.action = req.query.action;
    if (req.query.entityType) query['entity.type'] = req.query.entityType;
    if (req.query.entityId) query['entity.id'] = req.query.entityId;

    const [events, total] = await Promise.all([
      AuditEvent.find(query).sort({ seq: -1 }).skip(skip).limit(limit),
      AuditEvent.countDocuments(query)
    ]);

    const meta = buildPaginationMeta(page, limit, total);

    res.status(200).json({
      success: true,
      data: events,
      pagination: meta
    });
  } catch (err) {
    next(err);
  }
}

async function verifyChain(req, res, next) {
  try {
    const verificationResult = await verifyAuditChain();
    res.status(200).json({
      success: true,
      data: verificationResult
    });
  } catch (err) {
    next(err);
  }
}

async function tamperAudit(req, res, next) {
  try {
    if (!env.DEMO_MODE && process.env.NODE_ENV === 'production') {
      throw ApiError.forbidden('Tamper endpoint is only accessible in DEMO or test mode.');
    }

    const targetSeq = req.body.seq ? Number(req.body.seq) : null;
    let eventToTamper;

    if (targetSeq) {
      eventToTamper = await AuditEvent.findOne({ seq: targetSeq });
    } else {
      eventToTamper = await AuditEvent.findOne().sort({ seq: -1 });
    }

    if (!eventToTamper) {
      throw ApiError.notFound('No audit event found to tamper');
    }

    // Tamper payload directly without updating hash to simulate malicious DB modification
    eventToTamper.payload = {
      ...eventToTamper.payload,
      _tampered: true,
      tamperedAt: new Date().toISOString(),
      unauthorizedEdit: 'Tampered malicious data insertion'
    };

    await eventToTamper.save();

    res.status(200).json({
      success: true,
      message: 'Audit event payload was directly modified in storage. Chain integrity is now broken.',
      data: {
        tamperedSeq: eventToTamper.seq,
        storedHash: eventToTamper.hash
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAuditEvents,
  verifyChain,
  tamperAudit
};

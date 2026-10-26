/**
 * Finding Controller
 * Handles retrieval of regulatory findings and manual reconciliation triggers
 */

const mongoose = require('mongoose');
const { Finding, Application } = require('../models');
const { reconcileApplication } = require('../services/reconciliation.service');
const ApiError = require('../utils/ApiError');

async function getFindingsByApplication(req, res, next) {
  try {
    const application = await Application.findByIdOrNumber(req.params.id);
    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    if (req.user.role === 'INSTITUTION' || req.user.role === 'INSTITUTION_USER') {
      const userInstId = req.user.institutionId || req.user.institution?._id || req.user.institution;
      const appInstId = application.institutionId || application.institution?._id || application.institution;
      if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
        throw ApiError.forbidden('Access denied: You cannot view findings for another institution.');
      }
    }

    const query = { applicationId: application._id };
    if (req.query.status) query.status = req.query.status;
    if (req.query.severity) query.severity = req.query.severity.toUpperCase();

    const findings = await Finding.find(query).sort({ severity: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: findings
    });
  } catch (err) {
    next(err);
  }
}

async function getFindingById(req, res, next) {
  try {
    const id = req.params.id;
    const query = mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { findingId: id }] }
      : { findingId: id };
    const finding = await Finding.findOne(query);
    if (!finding) {
      throw ApiError.notFound('Finding not found');
    }

    const application = await Application.findById(finding.applicationId);
    if (application && (req.user.role === 'INSTITUTION' || req.user.role === 'INSTITUTION_USER')) {
      const userInstId = req.user.institutionId || req.user.institution?._id || req.user.institution;
      const appInstId = application.institutionId || application.institution?._id || application.institution;
      if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
        throw ApiError.forbidden('Access denied');
      }
    }

    res.status(200).json({
      success: true,
      data: finding
    });
  } catch (err) {
    next(err);
  }
}

async function triggerReconcile(req, res, next) {
  try {
    const result = await reconcileApplication(req.params.id, req.user, req.requestId);
    res.status(200).json({
      success: true,
      message: 'Application reconciled successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function recordDisposition(req, res, next) {
  try {
    const { state, reason } = req.body;
    const validStates = ['OPEN', 'ACCEPTED', 'DISMISSED', 'CLARIFICATION_REQUESTED', 'RESOLVED'];

    if (!validStates.includes(state)) {
      throw ApiError.badRequest(`Invalid disposition state '${state}'. Allowed: ${validStates.join(', ')}`);
    }

    if (['DISMISSED', 'ACCEPTED'].includes(state) && (!reason || reason.trim().length < 10)) {
      throw ApiError.badRequest(`Mandatory justification reason (at least 10 characters) required when disposition is ${state}`);
    }

    const id = req.params.id;
    const query = mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { findingId: id }] }
      : { findingId: id };
    const finding = await Finding.findOne(query);
    if (!finding) {
      throw ApiError.notFound('Finding not found');
    }

    finding.disposition = {
      state,
      dispositionedBy: req.user._id,
      dispositionedAt: new Date(),
      reason: reason ? reason.trim() : null
    };
    finding.state = state;
    finding.decidedBy = req.user._id;
    finding.decidedAt = new Date();
    finding.decisionReason = reason ? reason.trim() : null;
    await finding.save();

    // Recompute deterministic summary
    const { computeApplicationSummary } = require('../services/summary.service');
    const { logEvent } = require('../services/audit.service');
    const summary = await computeApplicationSummary(finding.applicationId);

    await logEvent({
      actorUser: req.user._id,
      action: 'FINDING_DISPOSITION',
      entityType: 'Finding',
      entityId: finding._id,
      application: finding.applicationId,
      requestId: req.requestId,
      outcome: 'SUCCESS',
      metadata: {
        findingId: finding._id,
        ruleId: finding.ruleId,
        state,
        reason: finding.disposition.reason
      }
    });

    res.status(200).json({
      success: true,
      message: 'Finding disposition recorded successfully',
      data: finding,
      summary
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFindingsByApplication,
  getFindingById,
  triggerReconcile,
  recordDisposition
};

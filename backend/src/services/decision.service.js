/**
 * Decision Guard Service
 * Strictly enforces regulatory governance:
 * - Scrutiny Officer proposes recommendations
 * - Regional Director confirms final outcomes
 * - Blocks APPROVAL while any HIGH or CRITICAL findings remain open
 */

const { Application, Finding } = require('../models');
const { logEvent } = require('./audit.service');
const ApiError = require('../utils/ApiError');

const PROPOSAL_OUTCOMES = [
  'RECOMMEND_APPROVAL',
  'RECOMMEND_REJECTION',
  'RECOMMEND_DEFICIENCY_LETTER',
  'ACCEPT_SCRUTINY',
  'REQUEST_CLARIFICATION',
  'REFER_FOR_INSPECTION',
  'RECOMMEND_ADVERSE_ACTION'
];

const FINAL_CONFIRMATION_OUTCOMES = ['APPROVE', 'REJECT'];

async function recordDecision(user, applicationId, { outcome, reason }, requestId = null) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // 1. Role permission checks
  const isDirectorOrAdmin = ['REGIONAL_DIRECTOR', 'ADMIN'].includes(user.role);
  if (FINAL_CONFIRMATION_OUTCOMES.includes(outcome) && !isDirectorOrAdmin) {
    throw ApiError.forbidden(
      'Only Regional Director or Administrator can confirm final APPROVE or REJECT decision.'
    );
  }

  // 2. Regulatory Integrity Guard:
  // Cannot APPROVE or RECOMMEND_APPROVAL if any open HIGH or CRITICAL findings exist
  if (['APPROVE', 'RECOMMEND_APPROVAL', 'ACCEPT_SCRUTINY'].includes(outcome)) {
    const blockingFindings = await Finding.find({
      applicationId: application._id,
      severity: { $in: ['HIGH', 'CRITICAL'] },
      'disposition.state': { $nin: ['ACCEPTED', 'DISMISSED', 'RESOLVED'] }
    });

    if (blockingFindings.length > 0) {
      const details = blockingFindings.map((f) => ({
        ruleId: f.ruleId,
        title: f.title,
        severity: f.severity,
        clauseRef: f.clauseRef
      }));

      throw ApiError.badRequest(
        `Decision blocked: Cannot approve or recommend approval while ${blockingFindings.length} open HIGH/CRITICAL regulatory findings exist.`,
        details
      );
    }
  }

  // 3. Persist decision
  application.decision = {
    outcome,
    reason: reason ? reason.trim() : null,
    byUserId: user._id,
    at: new Date(),
    confirmedBy: isDirectorOrAdmin ? user._id : null
  };

  if (outcome === 'APPROVE') {
    application.status = 'VERIFIED';
  } else if (outcome === 'REJECT') {
    application.status = 'REJECTED';
  } else if (['REQUEST_CLARIFICATION', 'RECOMMEND_DEFICIENCY_LETTER'].includes(outcome)) {
    application.status = 'DEFICIENCY_RAISED';
  }

  await application.save();

  await logEvent({
    actorUser: user._id,
    action: 'DECISION_RECORDED',
    entityType: 'Application',
    entityId: application._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      decisionOutcome: outcome,
      reason,
      confirmed: isDirectorOrAdmin
    }
  });

  return application;
}

module.exports = {
  recordDecision
};

/**
 * Claim Service
 * Manages extracted claims, confidence confirmation, corrections, and scoping
 */

const { Claim, Application } = require('../models');
const ApiError = require('../utils/ApiError');
const { logEvent } = require('./audit.service');

/**
 * Retrieves claims for an application with access control and filtering
 */
async function getClaims(user, applicationId, filters = {}) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Ownership verification for institution user
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You cannot view claims for another institution.');
    }
  }

  const query = { applicationId: application._id };

  if (filters.predicate) {
    query.predicate = filters.predicate;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.docId) {
    query['source.docId'] = filters.docId;
  }

  return Claim.find(query).sort({ createdAt: -1 });
}

/**
 * Confirms a claim (e.g. for low-confidence claims needing manual verification)
 */
async function confirmClaim(user, claimId, requestId = null) {
  const claim = await Claim.findOne({ claimId });
  if (!claim) {
    throw ApiError.notFound(`Claim '${claimId}' not found`);
  }

  const application = await Application.findById(claim.applicationId);
  if (!application) {
    throw ApiError.notFound('Associated application not found');
  }

  // Ownership check
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You cannot confirm claims for another institution.');
    }
  }

  const previousStatus = claim.status;
  claim.status = 'CONFIRMED';
  await claim.save();

  await logEvent({
    actorUser: user._id,
    action: 'CLAIM_CONFIRMED',
    entityType: 'Claim',
    entityId: claim._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      claimId: claim.claimId,
      predicate: claim.predicate,
      previousStatus,
      newStatus: 'CONFIRMED'
    }
  });

  return claim;
}

/**
 * Corrects a claim's extracted value with audit trail
 */
async function correctClaim(user, claimId, { newValue, value, reason }, requestId = null) {
  const finalValue = newValue !== undefined ? newValue : value;
  if (finalValue === undefined || finalValue === null) {
    throw ApiError.badRequest('newValue is required for claim correction');
  }

  if (!reason || reason.trim().length < 5) {
    throw ApiError.badRequest('Correction reason must be at least 5 characters');
  }

  const claim = await Claim.findOne({ claimId });
  if (!claim) {
    throw ApiError.notFound(`Claim '${claimId}' not found`);
  }

  const application = await Application.findById(claim.applicationId);
  if (!application) {
    throw ApiError.notFound('Associated application not found');
  }

  // Scoping check
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You cannot correct claims for another institution.');
    }
  }

  const oldValue = claim.value;
  claim.previousValue = oldValue;
  claim.value = finalValue;
  claim.status = 'CORRECTED';
  claim.correctedBy = user._id;
  claim.correctionReason = reason.trim();
  claim.version = (claim.version || 1) + 1;

  await claim.save();

  await logEvent({
    actorUser: user._id,
    action: 'CLAIM_CORRECTED',
    entityType: 'Claim',
    entityId: claim._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      claimId: claim.claimId,
      predicate: claim.predicate,
      oldValue,
      newValue,
      reason: claim.correctionReason,
      version: claim.version
    }
  });

  // Partial re-verification
  let partialReverify = null;
  try {
    const mlClient = require('./mlClient.service');
    const { computeApplicationSummary } = require('./summary.service');
    const { getInstitutionRecords } = require('../adapters/records/syntheticRecords');
    const { computeClaimsKey } = require('./reconciliation.service');
    const { Finding } = require('../models');

    const rulesIndex = await mlClient.getRulesIndex(application.rulepackVersion || '2026.1-demo');
    const affectedRules = (rulesIndex?.predicates && rulesIndex.predicates[claim.predicate]) || [];

    if (affectedRules.length > 0) {
      const allClaims = await Claim.find({ applicationId: application._id });
      const recordsRes = await getInstitutionRecords(application.institution?.aicteId || 'AICTE-DEMO-01');

      const reconcileRes = await mlClient.reconcile({
        applicationId: application._id.toString(),
        claims: allClaims,
        records: recordsRes.bundle,
        onlyRules: affectedRules
      });

      // Update or close affected findings
      for (const ruleId of affectedRules) {
        const returnedFinding = (reconcileRes.findings || []).find((f) => f.ruleId === ruleId);
        if (!returnedFinding) {
          // Rule passed now! If there was an open finding for this rule, mark it RESOLVED
          await Finding.updateMany(
            { applicationId: application._id, ruleId, 'disposition.state': 'OPEN' },
            { $set: { status: 'VERIFIED', 'disposition.state': 'RESOLVED', state: 'RESOLVED' } }
          );
        } else {
          // Finding remains
          const claimsKey = computeClaimsKey(ruleId, returnedFinding.claimIds || []);
          const existing = await Finding.findOne({ applicationId: application._id, ruleId, claimsKey });
          if (existing && existing.disposition?.state === 'OPEN') {
            existing.proof = returnedFinding.proof;
            existing.message = returnedFinding.message;
            existing.severity = returnedFinding.severity;
            await existing.save();
          }
        }
      }

      const summary = await computeApplicationSummary(application._id);
      partialReverify = {
        rulesRerun: affectedRules,
        rulesTotal: 12,
        summary
      };
    }
  } catch (_) {
    // Non-fatal if index unavailable
  }

  return { claim, partialReverify };
}

module.exports = {
  getClaims,
  confirmClaim,
  correctClaim
};

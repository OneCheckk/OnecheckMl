/**
 * Claim Controller
 * Handles HTTP endpoints for claims querying and confirmation
 */

const claimService = require('../services/claim.service');

async function getClaimsByApplication(req, res, next) {
  try {
    const claims = await claimService.getClaims(req.user, req.params.id, {
      predicate: req.query.predicate,
      status: req.query.status,
      docId: req.query.docId
    });

    res.status(200).json({
      success: true,
      data: claims
    });
  } catch (err) {
    next(err);
  }
}

async function confirmClaim(req, res, next) {
  try {
    const claim = await claimService.confirmClaim(req.user, req.params.claimId, req.requestId);

    res.status(200).json({
      success: true,
      message: 'Claim confirmed successfully',
      data: claim
    });
  } catch (err) {
    next(err);
  }
}

async function correctClaim(req, res, next) {
  try {
    const newValue = req.body.newValue !== undefined ? req.body.newValue : req.body.value;
    const { reason } = req.body;
    const result = await claimService.correctClaim(
      req.user,
      req.params.claimId,
      { newValue, reason },
      req.requestId
    );

    res.status(200).json({
      success: true,
      message: 'Claim corrected successfully',
      data: result.claim || result,
      partialReverify: result.partialReverify
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getClaimsByApplication,
  confirmClaim,
  correctClaim
};

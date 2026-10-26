const express = require('express');
const claimController = require('../controllers/claim.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// POST /api/claims/:claimId/confirm (INSTITUTION / OFFICER / ADMIN)
router.post(
  '/:claimId/confirm',
  authenticate,
  authorize('INSTITUTION', 'INSTITUTION_USER', 'OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN'),
  claimController.confirmClaim
);

// PATCH /api/claims/:claimId (INSTITUTION / OFFICER / ADMIN)
router.patch(
  '/:claimId',
  authenticate,
  authorize('INSTITUTION', 'INSTITUTION_USER', 'OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN'),
  claimController.correctClaim
);

module.exports = router;

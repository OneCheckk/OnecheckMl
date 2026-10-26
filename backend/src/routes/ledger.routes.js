const express = require('express');
const ledgerController = require('../controllers/ledger.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// POST /api/ledger/:entryId/manual-confirm (OFFICER / ADMIN)
router.post(
  '/:entryId/manual-confirm',
  authenticate,
  authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN'),
  ledgerController.manualConfirm
);

module.exports = router;

const express = require('express');
const auditController = require('../controllers/audit.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// GET /api/audit/verify (OFFICER / AUDITOR / ADMIN)
router.get(
  '/verify',
  authenticate,
  authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'AUDITOR', 'ADMIN'),
  auditController.verifyChain
);

// GET /api/audit (OFFICER / AUDITOR / ADMIN)
router.get(
  '/',
  authenticate,
  authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'AUDITOR', 'ADMIN'),
  auditController.getAuditEvents
);

// POST /api/audit/tamper (DEV / DEMO MODE ONLY)
router.post(
  '/tamper',
  authenticate,
  authorize('ADMIN'),
  auditController.tamperAudit
);

module.exports = router;

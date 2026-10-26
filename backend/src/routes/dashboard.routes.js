const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Canonical: GET /api/dashboard/summary (OFFICER / ADMIN)
router.get(
  '/summary',
  authenticate,
  authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN'),
  dashboardController.getSummary
);

// Spec: GET /api/dashboard/officer (OFFICER / ADMIN)
router.get(
  '/officer',
  authenticate,
  authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN'),
  dashboardController.getOfficer
);

// Spec: GET /api/dashboard/institution (INSTITUTION / ADMIN)
router.get(
  '/institution',
  authenticate,
  authorize('INSTITUTION_USER', 'INSTITUTION', 'ADMIN'),
  dashboardController.getInstitution
);

module.exports = router;

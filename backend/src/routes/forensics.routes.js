const express = require('express');
const forensicsController = require('../controllers/forensics.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Canonical: POST /api/forensics/:appId/geo-check (OFFICER / ADMIN)
router.post(
  '/:appId/geo-check',
  authenticate,
  authorize('OFFICER', 'ADMIN'),
  forensicsController.runGeoCheck
);

// Canonical: GET /api/forensics/:appId
router.get(
  '/:appId',
  authenticate,
  forensicsController.getForensics
);

module.exports = router;

const express = require('express');
const scoreController = require('../controllers/score.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Canonical: POST /api/score/:appId/compute (OFFICER / ADMIN)
router.post(
  '/:appId/compute',
  authenticate,
  authorize('OFFICER', 'ADMIN'),
  scoreController.computeScore
);

// Canonical: GET /api/score/:appId
router.get(
  '/:appId',
  authenticate,
  scoreController.getScore
);

module.exports = router;

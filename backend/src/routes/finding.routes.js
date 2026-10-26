const express = require('express');
const findingController = require('../controllers/finding.controller');
const authenticate = require('../middleware/authenticate');

const { authorize } = require('../middleware/authorize');

const router = express.Router();

// GET /api/findings/:id (Role & ownership check)
router.get('/:id', authenticate, findingController.getFindingById);

// POST /api/findings/:id/disposition (OFFICER / ADMIN)
router.post(
  '/:id/disposition',
  authenticate,
  authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN'),
  findingController.recordDisposition
);

module.exports = router;

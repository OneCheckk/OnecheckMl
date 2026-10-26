const express = require('express');
const facultyController = require('../controllers/faculty.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// Canonical: POST /api/faculty/:appId/ghost-check (OFFICER / ADMIN)
router.post(
  '/:appId/ghost-check',
  authenticate,
  authorize('OFFICER', 'ADMIN'),
  facultyController.runGhostCheck
);

module.exports = router;

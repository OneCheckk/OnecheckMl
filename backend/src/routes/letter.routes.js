const express = require('express');
const letterController = require('../controllers/letter.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// POST /api/letters/:id/send (OFFICER / ADMIN)
router.post(
  '/:id/send',
  authenticate,
  authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN'),
  letterController.sendLetter
);

module.exports = router;

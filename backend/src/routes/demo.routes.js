const express = require('express');
const { getSettings, updateSettings } = require('../services/demoSettings.service');
const { subscribe } = require('../services/sse.service');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const router = express.Router();

// GET /api/demo/settings
router.get('/settings', (req, res) => {
  res.status(200).json({
    success: true,
    data: getSettings()
  });
});

// PUT /api/demo/settings (OFFICER / ADMIN)
router.put(
  '/settings',
  authenticate,
  authorize('OFFICER', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN'),
  async (req, res, next) => {
    try {
      const updated = await updateSettings(req.body, req.user, req.requestId);
      res.status(200).json({
        success: true,
        message: 'Demo simulation settings updated successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
);

const auditController = require('../controllers/audit.controller');

// POST /api/demo/tamper-audit (Alias for demo control drawer)
router.post(
  '/tamper-audit',
  authenticate,
  authorize('ADMIN'),
  auditController.tamperAudit
);

module.exports = router;

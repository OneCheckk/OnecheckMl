const express = require('express');
const database = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  const dbReady = database.isReady();
  const requestId = res.locals.requestId || req.id;

  if (!dbReady) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database service is currently unavailable or disconnected.',
        details: []
      },
      meta: {
        requestId
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      database: 'CONNECTED',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    },
    meta: {
      requestId
    }
  });
});

module.exports = router;

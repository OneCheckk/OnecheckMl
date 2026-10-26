const asyncHandler = require('../utils/asyncHandler');
const alertService = require('../services/alert.service');

const listAlerts = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const { alerts, pagination } = await alertService.listAlerts(req.user, req.query);

  res.status(200).json({
    success: true,
    data: { alerts },
    meta: {
      requestId,
      pagination
    }
  });
});

const updateStatus = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const { status, reason } = req.body;

  const alert = await alertService.updateAlertStatus(
    req.user,
    req.params.id,
    status,
    reason,
    requestId
  );

  res.status(200).json({
    success: true,
    data: { alert },
    meta: {
      requestId
    }
  });
});

const ackAlert = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const alert = await alertService.updateAlertStatus(
    req.user,
    req.params.id,
    'ACKNOWLEDGED',
    null,
    requestId
  );

  res.status(200).json({
    success: true,
    message: 'Alert acknowledged successfully',
    data: { alert },
    meta: { requestId }
  });
});

module.exports = {
  listAlerts,
  updateStatus,
  ackAlert
};

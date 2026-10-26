const asyncHandler = require('../utils/asyncHandler');
const checkRunService = require('../services/checkRun.service');

const startChecks = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const result = await checkRunService.startCheckRun(req.user, req.params.id, requestId);

  // Return HTTP 202 Accepted immediately with runId
  res.status(202).json({
    success: true,
    data: result,
    meta: {
      requestId
    }
  });
});

const getRunStatus = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const run = await checkRunService.getCheckRunStatus(
    req.user,
    req.params.id,
    req.params.runId
  );

  res.status(200).json({
    success: true,
    data: { run },
    meta: {
      requestId
    }
  });
});

module.exports = {
  startChecks,
  getRunStatus
};

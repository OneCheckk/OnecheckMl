const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const getSummary = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const summary = await dashboardService.getDashboardSummary(req.user);

  res.status(200).json({
    success: true,
    data: summary,
    meta: {
      requestId
    }
  });
});

const getOfficer = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const data = await dashboardService.getOfficerDashboard(req.user);

  res.status(200).json({
    success: true,
    data,
    meta: {
      requestId
    }
  });
});

const getInstitution = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const data = await dashboardService.getInstitutionDashboard(req.user);

  res.status(200).json({
    success: true,
    data,
    meta: {
      requestId
    }
  });
});

module.exports = {
  getSummary,
  getOfficer,
  getInstitution
};

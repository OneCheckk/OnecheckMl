const asyncHandler = require('../utils/asyncHandler');
const applicationService = require('../services/application.service');

const createApplication = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const application = await applicationService.createApplication(req.user, req.body, requestId);

  res.status(201).json({
    success: true,
    data: { application },
    meta: {
      requestId
    }
  });
});

const listApplications = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const { applications, pagination } = await applicationService.listApplications(req.user, req.query);

  res.status(200).json({
    success: true,
    data: { applications },
    meta: {
      requestId,
      pagination
    }
  });
});

const getApplicationById = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const result = await applicationService.getApplicationById(req.user, req.params.id);

  res.status(200).json({
    success: true,
    data: result,
    meta: {
      requestId
    }
  });
});

const patchApplication = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const application = await applicationService.updateApplication(req.user, req.params.id, req.body, requestId);

  res.status(200).json({
    success: true,
    data: { application },
    meta: {
      requestId
    }
  });
});

const submitApplication = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const application = await applicationService.submitApplication(req.user, req.params.id, requestId);

  res.status(200).json({
    success: true,
    data: { application },
    meta: {
      requestId
    }
  });
});

module.exports = {
  createApplication,
  listApplications,
  getApplicationById,
  patchApplication,
  submitApplication
};

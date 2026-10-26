const asyncHandler = require('../utils/asyncHandler');
const institutionService = require('../services/institution.service');

const createInstitution = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const institution = await institutionService.createInstitution(req.user, req.body, requestId);

  res.status(201).json({
    success: true,
    data: { institution },
    meta: {
      requestId
    }
  });
});

const getInstitutionById = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const institution = await institutionService.getInstitutionById(req.user, req.params.id);

  res.status(200).json({
    success: true,
    data: { institution },
    meta: {
      requestId
    }
  });
});

const listInstitutions = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const institutions = await institutionService.listInstitutions(req.user);

  res.status(200).json({
    success: true,
    data: institutions,
    meta: {
      requestId
    }
  });
});

module.exports = {
  createInstitution,
  getInstitutionById,
  listInstitutions
};

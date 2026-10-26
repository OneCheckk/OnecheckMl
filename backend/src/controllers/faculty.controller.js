const asyncHandler = require('../utils/asyncHandler');
const { runFacultyCollisionCheck } = require('../services/faculty.service');
const { Application } = require('../models');
const ApiError = require('../utils/ApiError');

const runGhostCheck = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const application = await Application.findByIdOrNumber(req.params.appId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  const result = await runFacultyCollisionCheck(
    application._id,
    application.institution,
    `manual_faculty_check_${Date.now()}`
  );

  res.status(200).json({
    success: true,
    data: result,
    meta: {
      requestId
    }
  });
});

module.exports = {
  runGhostCheck
};

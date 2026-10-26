const asyncHandler = require('../utils/asyncHandler');
const { computeRiskScore } = require('../services/score.service');
const { Application } = require('../models');
const ApiError = require('../utils/ApiError');

const computeScore = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const application = await Application.findByIdOrNumber(req.params.appId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  const score = await computeRiskScore(
    application._id,
    `manual_score_${Date.now()}`
  );

  res.status(200).json({
    success: true,
    data: { score },
    meta: {
      requestId
    }
  });
});

const { RiskScore } = require('../models');

const getScore = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const application = await Application.findByIdOrNumber(req.params.appId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  const riskScore = await RiskScore.findOne({ application: application._id }).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: riskScore || {
      applicationId: application._id,
      totalScore: application.riskScore !== null && application.riskScore !== undefined ? application.riskScore : 100,
      riskLevel: application.riskLevel || 'GREEN',
      pillarScores: {
        documentCompleteness: 100,
        anomalyFlags: 100,
        sourceVerification: 100,
        historicalCompliance: 100,
        infrastructureEvidence: 100
      },
      deductions: []
    },
    meta: { requestId }
  });
});

module.exports = {
  computeScore,
  getScore
};

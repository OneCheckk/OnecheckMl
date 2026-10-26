/**
 * Checklist Controller
 * Handles checklist resolution and self-check endpoints
 */

const checklistService = require('../services/checklist.service');

async function getChecklist(req, res, next) {
  try {
    const checklist = await checklistService.resolveChecklist(req.user, req.params.id);
    res.status(200).json({
      success: true,
      data: checklist
    });
  } catch (err) {
    next(err);
  }
}

async function runSelfCheck(req, res, next) {
  try {
    const result = await checklistService.runSelfCheck(req.user, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Self-check completed successfully. Application remains in DRAFT.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getChecklist,
  runSelfCheck
};

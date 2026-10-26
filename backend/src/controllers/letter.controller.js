/**
 * Letter Controller
 * Handles creation, retrieval, and dispatching of deficiency letters
 */

const letterService = require('../services/letter.service');

async function createLetter(req, res, next) {
  try {
    const { findingIds } = req.body;
    const letter = await letterService.createDeficiencyLetter(
      req.user,
      req.params.id,
      { findingIds },
      req.requestId
    );

    res.status(201).json({
      success: true,
      message: 'Draft deficiency letter generated successfully',
      data: letter
    });
  } catch (err) {
    next(err);
  }
}

async function getLetters(req, res, next) {
  try {
    const letters = await letterService.getLettersByApplication(req.user, req.params.id);
    res.status(200).json({
      success: true,
      data: letters
    });
  } catch (err) {
    next(err);
  }
}

async function sendLetter(req, res, next) {
  try {
    const letter = await letterService.sendLetter(req.user, req.params.id, req.requestId);
    res.status(200).json({
      success: true,
      message: 'Deficiency letter dispatched and application transitioned to DEFICIENCY_RAISED',
      data: letter
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createLetter,
  getLetters,
  sendLetter
};

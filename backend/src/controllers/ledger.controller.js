/**
 * Ledger Controller
 * Handles HTTP requests for the verification ledger and officer manual confirmations
 */

const ledgerService = require('../services/ledger.service');

async function getLedgerByApplication(req, res, next) {
  try {
    const ledger = await ledgerService.getLedgerByApplication(req.user, req.params.id);
    res.status(200).json({
      success: true,
      data: ledger
    });
  } catch (err) {
    next(err);
  }
}

async function verifyDocument(req, res, next) {
  try {
    const result = await ledgerService.verifyDocumentSources(req.user, req.params.docId, req.requestId);
    res.status(200).json({
      success: true,
      message: 'Document source verification completed',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function manualConfirm(req, res, next) {
  try {
    const { note, confirmed } = req.body;
    const entry = await ledgerService.manualConfirmEntry(
      req.user,
      req.params.entryId,
      { note, confirmed },
      req.requestId
    );

    res.status(200).json({
      success: true,
      message: 'Ledger entry manual confirmation recorded successfully',
      data: entry
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLedgerByApplication,
  verifyDocument,
  manualConfirm
};

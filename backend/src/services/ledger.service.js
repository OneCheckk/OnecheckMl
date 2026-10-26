/**
 * Verification Ledger Service
 * Manages official issuer queries, QR/digital signature trust chain verification,
 * and officer manual confirmation workflows.
 */

const { VerificationEntry, Document, Application, Claim, Alert } = require('../models');
const { lookupIssuer } = require('../adapters/issuers/mockIssuer');
const { computeApplicationSummary } = require('./summary.service');
const { logEvent } = require('./audit.service');
const ApiError = require('../utils/ApiError');

/**
 * Retrieves verification ledger entries for an application with access control
 */
async function getLedgerByApplication(user, applicationId) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Scoping check
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You cannot view verification ledger for another institution.');
    }
  }

  return VerificationEntry.find({ applicationId: application._id }).sort({ createdAt: -1 });
}

/**
 * Verifies document sources via issuer query and trust chain rules
 */
async function verifyDocumentSources(user, docId, requestId = null) {
  const document = await Document.findById(docId);
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  const application = await Application.findById(document.application);
  if (!application) {
    throw ApiError.notFound('Associated application not found');
  }

  if (user && (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER')) {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied');
    }
  }

  const docType = (document.docType || document.documentType || 'OTHER').toUpperCase();

  // Find certificate number claim if extracted
  const certClaim = await Claim.findOne({
    applicationId: application._id,
    'source.docId': document._id.toString(),
    predicate: { $in: ['noc_certificate_no', 'certificate_no', 'reference_no'] }
  });

  const refNo = certClaim ? certClaim.value : `REF-${docType}-${document._id.toString().slice(-6)}`;

  // 1. Query mock issuer adapter
  const issuerResult = await lookupIssuer({
    docType,
    referenceNo: String(refNo)
  });

  let ledgerEntry = await VerificationEntry.findOne({
    applicationId: application._id,
    docId: document._id,
    checkType: 'ISSUER_LOOKUP'
  });

  if (ledgerEntry) {
    ledgerEntry.status = issuerResult.status;
    ledgerEntry.source = { label: issuerResult.sourceLabel, kind: 'SYNTHETIC_DEMO' };
    ledgerEntry.respondedAt = new Date();
    ledgerEntry.requestSummary = `Issuer lookup for ${docType} ref ${refNo}`;
    ledgerEntry.responseSummary = `Issuer registry returned ${issuerResult.outcome}`;
    ledgerEntry.error = issuerResult.error || null;
    await ledgerEntry.save();
  } else {
    ledgerEntry = await VerificationEntry.create({
      applicationId: application._id,
      docId: document._id,
      checkType: 'ISSUER_LOOKUP',
      status: issuerResult.status,
      source: { label: issuerResult.sourceLabel, kind: 'SYNTHETIC_DEMO' },
      requestedAt: new Date(),
      respondedAt: new Date(),
      requestSummary: `Issuer lookup for ${docType} ref ${refNo}`,
      responseSummary: `Issuer registry returned ${issuerResult.outcome}`,
      error: issuerResult.error || null
    });
  }

  // Raise alert if source is unavailable
  if (issuerResult.status === 'SOURCE_UNAVAILABLE') {
    await Alert.create({
      application: application._id,
      applicationId: application._id,
      type: 'SOURCE_UNAVAILABLE',
      severity: 'HIGH',
      title: `External source unavailable for ${document.originalName}`,
      message: `Issuing authority gateway timed out while verifying ${docType}. Manual review or retry required.`,
      status: 'OPEN'
    });
  }

  // 2. Non-negotiable QR & Signature constraint:
  // "Never mark QR or signature as VERIFIED without valid trust chain"
  // For demo/simulated QR codes, set to MANUAL_REVIEW_REQUIRED
  let qrEntry = await VerificationEntry.findOne({
    applicationId: application._id,
    docId: document._id,
    checkType: 'QR_DECODE'
  });

  if (!qrEntry) {
    qrEntry = await VerificationEntry.create({
      applicationId: application._id,
      docId: document._id,
      checkType: 'QR_DECODE',
      status: 'MANUAL_REVIEW_REQUIRED',
      source: { label: 'DEMO ADAPTER - simulated QR decode', kind: 'SYNTHETIC_DEMO' },
      requestedAt: new Date(),
      respondedAt: new Date(),
      requestSummary: 'QR code payload decode',
      responseSummary: 'Simulated QR decoded; trust chain unanchored (requires manual confirmation)',
      error: null
    });
  }

  // 3. Recompute deterministic summary
  await computeApplicationSummary(application._id);

  await logEvent({
    actorUser: user?._id || null,
    action: 'SOURCE_RESPONSE',
    entityType: 'VerificationEntry',
    entityId: ledgerEntry._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      docId: document._id,
      checkType: 'ISSUER_LOOKUP',
      status: issuerResult.status,
      outcome: issuerResult.outcome
    }
  });

  return { issuerEntry: ledgerEntry, qrEntry };
}

/**
 * Scrutiny Officer manual confirmation of a pending or flagged ledger entry
 */
async function manualConfirmEntry(user, entryId, { note, confirmed = true }, requestId = null) {
  if (!note || note.trim().length < 10) {
    throw ApiError.badRequest('Manual confirmation note must be at least 10 characters');
  }

  const entry = await VerificationEntry.findById(entryId);
  if (!entry) {
    throw ApiError.notFound('Verification ledger entry not found');
  }

  entry.manual = {
    state: confirmed ? 'CONFIRMED' : 'REJECTED',
    note: note.trim(),
    byUserId: user._id,
    at: new Date()
  };

  entry.status = confirmed ? 'VERIFIED' : 'MISMATCH_DETECTED';
  await entry.save();

  // Recompute deterministic summary
  await computeApplicationSummary(entry.applicationId);

  await logEvent({
    actorUser: user._id,
    action: 'SOURCE_RESPONSE',
    entityType: 'VerificationEntry',
    entityId: entry._id,
    application: entry.applicationId,
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      entryId: entry._id,
      manualState: entry.manual.state,
      note: entry.manual.note
    }
  });

  return entry;
}

module.exports = {
  getLedgerByApplication,
  verifyDocumentSources,
  manualConfirmEntry
};

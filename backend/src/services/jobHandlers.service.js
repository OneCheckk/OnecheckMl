/**
 * Job Handlers for OneCheck Background Pipeline
 * Dispatches ANALYZE_DOC, RECONCILE_APP, VERIFY_SOURCES
 */

const { Document, Application, Claim, Finding, Alert } = require('../models');
const mlClient = require('./mlClient.service');
const { logEvent } = require('./audit.service');
const env = require('../config/env');
const logger = require('../config/logger');

/**
 * Handler: ANALYZE_DOC
 * Executes ML analysis, persists extracted claims, performs confidence gating & forensics checks
 */
async function handleAnalyzeDoc(payload) {
  const { docId, applicationId, filePath, mime, hintDocType, site } = payload;

  const doc = await Document.findById(docId);
  if (!doc) {
    logger.warn(`Document ${docId} not found during ANALYZE_DOC execution`);
    return;
  }

  // 1. Invoke typed ML client
  const analysisResult = await mlClient.analyzeDocument({
    docId,
    filePath,
    mime: mime || doc.mime,
    hintDocType: hintDocType || doc.docType || doc.documentType,
    site,
    originalName: doc.originalName
  });

  const resolvedDocType = analysisResult.docType || hintDocType || doc.docType || doc.documentType;

  // 2. Persist extracted claims into Claim collection with confidence gating
  const minConfidence = env.OCR_CONF_MIN || 0.80;
  const rawClaims = analysisResult.claims || [];

  // Remove existing non-corrected claims from this document to avoid duplicates on re-run
  await Claim.deleteMany({
    applicationId: doc.application || applicationId,
    'source.docId': docId.toString(),
    status: { $in: ['EXTRACTED', 'NEEDS_CONFIRMATION'] }
  });

  const claimsToCreate = rawClaims.map((c, index) => {
    const confidence = c.confidence != null ? c.confidence : 1.0;
    // Non-negotiable: claims with confidence < 0.80 get NEEDS_CONFIRMATION
    const status = confidence < minConfidence ? 'NEEDS_CONFIRMATION' : 'EXTRACTED';
    const claimId = c.claimId || `claim_${docId}_${c.predicate}_${index + 1}`;

    return {
      claimId,
      applicationId: doc.application || applicationId,
      subject: c.subject || 'institution',
      predicate: c.predicate,
      value: c.value,
      unit: c.unit || null,
      rawText: c.rawText || null,
      origin: c.origin || 'DOCUMENT',
      source: {
        docId: docId.toString(),
        page: c.source?.page || 1,
        bbox: c.source?.bbox || [0, 0, 1, 1],
        snippet: c.source?.snippet || c.rawText || `${c.predicate}: ${c.value}`,
        docType: resolvedDocType
      },
      method: c.method || analysisResult.method || 'TEXT_LAYER',
      confidence,
      status
    };
  });

  if (claimsToCreate.length > 0) {
    await Claim.insertMany(claimsToCreate, { ordered: false });
  }

  // 3. Forensics cross-comparison if fingerprints present
  let forensicsSignals = analysisResult.forensics || [];
  if (analysisResult.fingerprints?.textMinhash?.length || analysisResult.fingerprints?.imagePhash) {
    try {
      const candidates = await Document.find({
        application: { $ne: doc.application },
        uploadStatus: 'STORED',
        $or: [
          { 'fingerprints.textMinhash.0': { $exists: true } },
          { 'fingerprints.imagePhash': { $ne: null } }
        ]
      })
        .limit(20)
        .select('_id fingerprints application');

      if (candidates.length > 0) {
        const forensicsRes = await mlClient.compareForensics({
          docId,
          textMinhash: analysisResult.fingerprints.textMinhash,
          imagePhash: analysisResult.fingerprints.imagePhash,
          candidates: candidates.map((c) => ({
            docId: c._id.toString(),
            textMinhash: c.fingerprints?.textMinhash,
            imagePhash: c.fingerprints?.imagePhash
          }))
        });

        if (forensicsRes?.signals?.length) {
          forensicsSignals = [...forensicsSignals, ...forensicsRes.signals];
        }
      }
    } catch (fErr) {
      logger.warn(`Forensics comparison non-fatal error: ${fErr.message}`);
    }
  }

  // 4. Update Document model
  doc.docType = resolvedDocType;
  doc.documentType = resolvedDocType;
  doc.typeConfidence = analysisResult.typeConfidence || 1.0;
  doc.pageCount = analysisResult.pageCount || 1;
  doc.analysis = {
    status: 'DONE',
    method: analysisResult.method || 'TEXT_LAYER',
    forensics: forensicsSignals,
    warnings: analysisResult.warnings || [],
    error: null
  };
  if (analysisResult.fingerprints) {
    doc.fingerprints = {
      sha256: analysisResult.fingerprints.sha256 || doc.sha256,
      textMinhash: analysisResult.fingerprints.textMinhash || [],
      imagePhash: analysisResult.fingerprints.imagePhash || null
    };
  }
  await doc.save();

  // 5. Log audit event
  await logEvent({
    action: 'ANALYSIS_DONE',
    entityType: 'Document',
    entityId: doc._id,
    application: doc.application,
    outcome: 'SUCCESS',
    metadata: {
      docId: doc._id,
      docType: resolvedDocType,
      method: analysisResult.method,
      claimsExtracted: claimsToCreate.length,
      needsConfirmationCount: claimsToCreate.filter((c) => c.status === 'NEEDS_CONFIRMATION').length
    }
  });

  return { claimsExtracted: claimsToCreate.length, docType: resolvedDocType };
}

/**
 * Handle document analysis terminal failure (after max retries)
 */
async function onAnalyzeDocFailed(payload, error) {
  const { docId, applicationId } = payload;
  try {
    const doc = await Document.findById(docId);
    if (doc) {
      doc.analysis = {
        status: 'FAILED',
        method: null,
        forensics: [],
        warnings: [],
        error: error.message
      };
      await doc.save();

      // Create finding: MANUAL_REVIEW_REQUIRED
      await Finding.create({
        findingId: `finding_fail_${doc._id}_${Date.now()}`,
        applicationId: doc.application || applicationId,
        ruleId: 'ANALYSIS-FAILED-000',
        ruleVersion: '1',
        rulepackVersion: '2026.1-demo',
        clauseRef: 'GENERAL-INTEGRITY',
        placeholder: false,
        status: 'MANUAL_REVIEW_REQUIRED',
        severity: 'HIGH',
        title: `Automated analysis failed for document ${doc.originalName}`,
        message: `System was unable to automatically extract claims from ${doc.originalName} (${error.message}). Manual verification required.`,
        claimIds: [],
        proof: {
          statement: 'Automated ML extraction failed after retries',
          evidence: [{ label: 'Error message', value: error.message }]
        }
      });

      // Raise Alert
      await Alert.create({
        application: doc.application || applicationId,
        applicationId: doc.application || applicationId,
        type: 'ANALYSIS_FAILED',
        severity: 'HIGH',
        title: `Analysis failed for document: ${doc.originalName}`,
        message: `Automated ML extraction failed: ${error.message}`,
        status: 'OPEN'
      });
    }
  } catch (err) {
    logger.error(`Error in onAnalyzeDocFailed: ${err.message}`);
  }
}

/**
 * Handler: RECONCILE_APP
 * Runs cross-document and regulatory record reconciliation
 */
async function handleReconcileApp(payload) {
  const { reconcileApplication } = require('./reconciliation.service');
  return reconcileApplication(payload.applicationId);
}

/**
 * Handler: VERIFY_SOURCES
 * Verifies external issuer sources for all documents in the application
 */
async function handleVerifySources(payload) {
  const { verifyDocumentSources } = require('./ledger.service');
  const docs = await Document.find({
    application: payload.applicationId,
    uploadStatus: 'STORED'
  });

  for (const doc of docs) {
    await verifyDocumentSources(null, doc._id);
  }
  return { success: true, count: docs.length };
}

module.exports = {
  handleAnalyzeDoc,
  onAnalyzeDocFailed,
  handleReconcileApp,
  handleVerifySources
};

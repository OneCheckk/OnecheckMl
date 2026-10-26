const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const { Application, CheckRun, Document, Alert } = require('../models');
const verificationClient = require('./verificationClient.service');
const { runFacultyCollisionCheck } = require('./faculty.service');
const { runGeofenceCheck } = require('./forensics.service');
const { computeRiskScore } = require('./score.service');
const { logEvent } = require('./audit.service');
const logger = require('../config/logger');

const PIPELINE_STEPS = [
  'DOCUMENT_OCR',
  'DOCUMENT_TAMPER_ANALYSIS',
  'AUTHORITY_VERIFICATION',
  'FACULTY_CROSS_CHECK',
  'GEOFENCE_CHECK',
  'SCORE_COMPUTATION'
];

/**
 * Initializes and enqueues a CheckRun, returning 202 immediately
 */
async function startCheckRun(user, applicationId, requestId = null) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Target application not found');
  }

  // Only submitted, scrutiny, or verified applications can undergo check runs
  if (application.status === 'DRAFT') {
    throw ApiError.badRequest('Cannot run compliance checks on an unsubmitted DRAFT application.');
  }

  const runId = `run_${uuidv4()}`;

  const initialSteps = PIPELINE_STEPS.map((name) => ({
    name,
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    errorCode: null,
    errorSummary: null,
    evidenceRefs: []
  }));

  const checkRun = await CheckRun.create({
    application: application._id,
    runId,
    requestedBy: user._id,
    status: 'QUEUED',
    steps: initialSteps,
    startedAt: new Date()
  });

  // Asynchronously trigger execution in the background
  setImmediate(() => {
    executeCheckRun(checkRun._id, application._id, runId, requestId).catch((err) => {
      logger.error(`Critical failure in check run ${runId}`, { error: err.message, stack: err.stack });
    });
  });

  await logEvent({
    actorUser: user._id,
    action: 'CHECK_RUN_START',
    entityType: 'CheckRun',
    entityId: checkRun._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { runId, stepCount: initialSteps.length }
  });

  return {
    runId,
    status: checkRun.status,
    applicationId: application._id,
    steps: checkRun.steps
  };
}

/**
 * Internal worker executing pipeline steps sequentially
 */
async function executeCheckRun(checkRunId, applicationId, runId, requestId) {
  const checkRun = await CheckRun.findById(checkRunId);
  if (!checkRun) return;

  const application = await Application.findById(applicationId);
  if (!application) return;

  checkRun.status = 'RUNNING';
  await checkRun.save();

  let hasPartialFailure = false;

  for (const step of checkRun.steps) {
    step.status = 'RUNNING';
    step.startedAt = new Date();
    await checkRun.save();

    try {
      if (step.name === 'DOCUMENT_OCR') {
        const docs = await Document.find({ application: applicationId, uploadStatus: 'STORED' });
        for (const doc of docs) {
          const ocrResult = await verificationClient.extractDocumentText(doc.storageKey, doc.documentType);
          if (ocrResult.status === 'SUCCEEDED') {
            doc.extractedFields = ocrResult.fields;
            doc.extractedText = ocrResult.text;
            doc.latestCheckRunId = runId;
            await doc.save();
            step.evidenceRefs.push(`OCR:${doc._id}`);
          } else {
            step.status = 'UNAVAILABLE';
            step.errorCode = ocrResult.errorCode;
            step.errorSummary = ocrResult.errorMessage;
            hasPartialFailure = true;
          }
        }
        if (step.status !== 'UNAVAILABLE') {
          step.status = 'SUCCEEDED';
        }
      } else if (step.name === 'DOCUMENT_TAMPER_ANALYSIS') {
        const docs = await Document.find({ application: applicationId, uploadStatus: 'STORED' });
        for (const doc of docs) {
          const tamperResult = await verificationClient.analyzeTampering(doc.storageKey);
          if (tamperResult.status === 'SUCCEEDED') {
            if (tamperResult.suspected) {
              await Alert.create({
                application: applicationId,
                runId,
                type: 'TAMPER_SUSPECTED',
                severity: 'CRITICAL',
                title: 'Digital document tampering suspected',
                message: `Error Level Analysis detected pixel inconsistencies in '${doc.originalName}'.`,
                sourceModel: 'Document',
                sourceId: doc._id,
                status: 'OPEN'
              });
            }
            step.evidenceRefs.push(`ELA:${doc._id}`);
          }
        }
        step.status = 'SUCCEEDED';
      } else if (step.name === 'AUTHORITY_VERIFICATION') {
        // PDF Section 1: Authority APIs return safe NOT_CONFIGURED
        const authResult = await verificationClient.verifyAuthorityDocument('GENERAL', null);
        step.status = 'SUCCEEDED';
        step.evidenceRefs.push(`AUTHORITY:${authResult.status}`);
      } else if (step.name === 'FACULTY_CROSS_CHECK') {
        const facultyResult = await runFacultyCollisionCheck(applicationId, application.institution, runId);
        step.status = 'SUCCEEDED';
        step.evidenceRefs.push(`FACULTY_CHECKED:${facultyResult.checkedCount}`);
      } else if (step.name === 'GEOFENCE_CHECK') {
        const geoResult = await runGeofenceCheck(applicationId, application.institution, runId);
        step.status = 'SUCCEEDED';
        step.evidenceRefs.push(`GEO_CHECKED:${geoResult.photosChecked}`);
      } else if (step.name === 'SCORE_COMPUTATION') {
        const score = await computeRiskScore(applicationId, runId);
        step.status = 'SUCCEEDED';
        step.evidenceRefs.push(`SCORE:${score.totalScore}`);
      }

      step.completedAt = new Date();
    } catch (stepErr) {
      step.status = 'FAILED';
      step.errorCode = 'STEP_EXECUTION_ERROR';
      step.errorSummary = stepErr.message;
      step.completedAt = new Date();
      hasPartialFailure = true;
      logger.error(`Error in step ${step.name}`, { error: stepErr.message });
    }

    await checkRun.save();
  }

  // Set overall check run status
  checkRun.status = hasPartialFailure ? 'PARTIAL' : 'SUCCEEDED';
  checkRun.completedAt = new Date();
  await checkRun.save();

  // Update application currentRunId
  application.currentRunId = runId;
  await application.save();

  await logEvent({
    action: 'CHECK_RUN_COMPLETE',
    entityType: 'CheckRun',
    entityId: checkRun._id,
    application: applicationId,
    requestId,
    outcome: 'SUCCESS',
    metadata: { runId, finalStatus: checkRun.status }
  });
}

/**
 * Retrieves CheckRun status and step progress
 */
async function getCheckRunStatus(user, applicationId, runId) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Role and ownership check
  if (user.role === 'INSTITUTION_USER') {
    const userInstId = user.institution?._id || user.institution;
    if (!userInstId || userInstId.toString() !== application.institution.toString()) {
      throw ApiError.forbidden('Access denied: You cannot view check runs for another institution\'s application.');
    }
  }

  const checkRun = await CheckRun.findOne({ application: application._id, runId });
  if (!checkRun) {
    throw ApiError.notFound(`CheckRun with identifier '${runId}' not found for this application.`);
  }

  return checkRun;
}

module.exports = {
  startCheckRun,
  executeCheckRun,
  getCheckRunStatus
};

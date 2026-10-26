/**
 * Checklist Service
 * Resolves category-specific regulatory checklists, document completeness, and self-check workflows
 */

const { Application, Checklist, Document, Job } = require('../models');
const ApiError = require('../utils/ApiError');
const { processNextJob } = require('./jobRunner.service');

const DEFAULT_EOA_ITEMS = [
  { id: 'CHK-01', label: 'Self-Disclosure Application Form', docTypes: ['SELF_DISCLOSURE_FORM'], required: true, clauseRef: 'AICTE-APH-CH2-01' },
  { id: 'CHK-02', label: 'Fire Safety NOC', docTypes: ['FIRE_NOC'], required: true, clauseRef: 'AICTE-APH-CH2-04' },
  { id: 'CHK-03', label: 'Approved Building Plan & Area Statement', docTypes: ['BUILDING_PLAN'], required: true, clauseRef: 'AICTE-APH-CH2-05' },
  { id: 'CHK-04', label: 'Complete Faculty List with Cadre Ratios', docTypes: ['FACULTY_LIST'], required: true, clauseRef: 'AICTE-APH-CH2-07' },
  { id: 'CHK-05', label: 'TER Regulatory Processing Fee Receipt', docTypes: ['TER_PAYMENT_RECEIPT'], required: true, clauseRef: 'AICTE-APH-CH2-09' }
];

/**
 * Resolves active checklist for an application, mapping stored documents to checklist items
 */
async function resolveChecklist(user, applicationId) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Scoping check
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You cannot view checklist for another institution.');
    }
  }

  // 1. Fetch active checklist from DB or use fallback
  let checklist = await Checklist.findOne({
    category: application.category,
    active: true
  }).sort({ version: -1 });

  let rawItems = checklist?.items;
  if (!rawItems || rawItems.length === 0) {
    // If not in DB, use default items
    rawItems = [...DEFAULT_EOA_ITEMS];
    if (application.category === 'EOA_INTAKE_INCREASE' || application.category === 'EOA_NEW_COURSE') {
      rawItems.push({
        id: 'CHK-06',
        label: 'NBA / NAAC Accreditation Certificate',
        docTypes: ['ACCREDITATION_CERT'],
        required: true,
        clauseRef: 'AICTE-APH-CH2-11'
      });
    }
  }

  // 2. Fetch all valid stored documents for this application
  const storedDocs = await Document.find({
    application: application._id,
    uploadStatus: 'STORED'
  }).sort({ version: -1, createdAt: -1 });

  // 3. Map items to their evaluation status
  const evaluatedItems = rawItems.map((item) => {
    // Find matching document for this item's accepted docTypes
    const matchingDoc = storedDocs.find((doc) => {
      const type = (doc.docType || doc.documentType || '').toUpperCase();
      return item.docTypes.map((t) => t.toUpperCase()).includes(type);
    });

    let status = 'MISSING';
    let docDetails = null;

    if (matchingDoc) {
      docDetails = {
        docId: matchingDoc._id,
        docType: matchingDoc.docType || matchingDoc.documentType,
        version: matchingDoc.version || 1,
        originalName: matchingDoc.originalName,
        analysisStatus: matchingDoc.analysis?.status || 'QUEUED'
      };

      if (matchingDoc.analysis?.status === 'QUEUED') {
        status = 'EXTRACTING';
      } else if (matchingDoc.analysis?.status === 'DONE') {
        status = 'DONE';
      } else if (matchingDoc.analysis?.status === 'FAILED') {
        status = 'FAILED';
      } else {
        status = 'UPLOADED';
      }
    }

    return {
      id: item.id,
      label: item.label,
      docTypes: item.docTypes,
      required: item.required,
      clauseRef: item.clauseRef,
      status,
      document: docDetails
    };
  });

  const missingRequired = evaluatedItems.filter((i) => i.required && i.status === 'MISSING');
  const isComplete = missingRequired.length === 0;

  return {
    applicationId: application._id,
    category: application.category,
    version: checklist?.version || '2026.1',
    isComplete,
    totalItems: evaluatedItems.length,
    missingRequiredCount: missingRequired.length,
    missingRequired: missingRequired.map((m) => ({ id: m.id, label: m.label, docTypes: m.docTypes })),
    items: evaluatedItems
  };
}

/**
 * Runs application self-check pipeline while preserving DRAFT status
 */
async function runSelfCheck(user, applicationId) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You can only self-check your own application.');
    }
  }

  if (application.status !== 'DRAFT') {
    throw ApiError.badRequest(`Self-check is only available for DRAFT applications. Current status: ${application.status}`);
  }

  // Process all queued analysis jobs for this application's documents
  const storedDocs = await Document.find({
    application: application._id,
    uploadStatus: 'STORED',
    'analysis.status': 'QUEUED'
  });

  for (const doc of storedDocs) {
    const job = await Job.findOne({ 'payload.docId': doc._id.toString(), status: 'QUEUED' });
    if (job) {
      await processNextJob();
    }
  }

  // Resolve updated checklist status
  const checklistResult = await resolveChecklist(user, applicationId);

  return {
    applicationId: application._id,
    mode: 'SELF_CHECK',
    status: application.status, // stays DRAFT
    isComplete: checklistResult.isComplete,
    checklist: checklistResult,
    summary: application.summary || { band: 'NOT_RUN', openFindingsCount: 0 }
  };
}

module.exports = {
  resolveChecklist,
  runSelfCheck
};

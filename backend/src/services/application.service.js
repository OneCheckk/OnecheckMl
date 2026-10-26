const ApiError = require('../utils/ApiError');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const {
  Application,
  Institution,
  Document,
  RiskScore,
  Alert,
  CheckRun
} = require('../models');
const { logEvent } = require('./audit.service');

// Default required document types for complete application submission
const REQUIRED_SUBMISSION_DOCUMENTS = [
  'LAND_DOC',
  'AFFILIATION_DOC',
  'BUILDING_PLAN',
  'FACULTY_LIST'
];

// Valid status transitions map
const ALLOWED_STATUS_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_SCRUTINY'],
  UNDER_SCRUTINY: ['DEFICIENCY_RAISED', 'VERIFIED'],
  DEFICIENCY_RAISED: ['SUBMITTED'],
  VERIFIED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: []
};

/**
 * Generates a unique application number: APP-YYYY-XXXXXX
 */
async function generateUniqueApplicationNumber() {
  const year = new Date().getFullYear();
  let attempts = 0;
  while (attempts < 10) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const candidateNumber = `APP-${year}-${randomSuffix}`;
    const exists = await Application.findOne({ applicationNumber: candidateNumber });
    if (!exists) {
      return candidateNumber;
    }
    attempts += 1;
  }
  return `APP-${year}-${Date.now().toString().slice(-6)}`;
}

/**
 * Creates a new application
 */
async function createApplication(user, data, requestId = null) {
  let targetInstitutionId;

  if (user.role === 'INSTITUTION_USER' || user.role === 'INSTITUTION') {
    if (!user.institution && !user.institutionId) {
      throw ApiError.badRequest('No institution profile is associated with this user account. Create an institution first.');
    }
    targetInstitutionId = user.institution?._id || user.institution || user.institutionId;
  } else if (user.role === 'ADMIN') {
    if (!data.institutionId) {
      throw ApiError.badRequest('institutionId is required when creating an application as administrator.');
    }
    const inst = await Institution.findById(data.institutionId);
    if (!inst) {
      throw ApiError.notFound('Target institution does not exist');
    }
    targetInstitutionId = inst._id;
  } else {
    throw ApiError.forbidden('Only institution representatives or administrators can create applications.');
  }

  const applicationNumber = await generateUniqueApplicationNumber();

  const application = await Application.create({
    applicationNumber,
    appNo: applicationNumber,
    institution: targetInstitutionId,
    institutionId: targetInstitutionId,
    category: data.category.trim(),
    academicYear: data.academicYear ? data.academicYear.trim() : '2026-2027',
    status: 'DRAFT'
  });

  await logEvent({
    actorUser: user._id,
    action: 'APPLICATION_CREATE',
    entityType: 'Application',
    entityId: application._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { applicationNumber, category: application.category }
  });

  return application;
}

/**
 * Lists applications with role scoping, filtering, and pagination
 */
async function listApplications(user, query) {
  const filter = {};

  // Scope: Institution users can ONLY see applications belonging to their institution
  if (user.role === 'INSTITUTION_USER' || user.role === 'INSTITUTION') {
    const instId = user.institution?._id || user.institution || user.institutionId;
    if (!instId) {
      return { applications: [], pagination: buildPaginationMeta(1, 20, 0) };
    }
    filter.institution = instId;
  } else {
    // Admins and Officers can filter by institution if provided
    if (query.institutionId) {
      filter.institution = query.institutionId;
    }
  }

  // Filter by status if provided and valid
  if (query.status) {
    const validStatuses = ['DRAFT', 'SUBMITTED', 'UNDER_SCRUTINY', 'DEFICIENCY_RAISED', 'VERIFIED', 'APPROVED', 'REJECTED'];
    if (validStatuses.includes(query.status.toUpperCase())) {
      filter.status = query.status.toUpperCase();
    }
  }

  // Filter by riskLevel if provided
  if (query.riskLevel) {
    const validLevels = ['GREEN', 'YELLOW', 'RED'];
    if (validLevels.includes(query.riskLevel.toUpperCase())) {
      filter.riskLevel = query.riskLevel.toUpperCase();
    }
  }

  // Filter by assigned officer for officers
  if (query.assignedOfficer) {
    filter.assignedOfficer = query.assignedOfficer;
  }

  const { page, limit, skip, sort } = parsePagination(
    query,
    ['createdAt', 'riskScore', 'status', 'applicationNumber'],
    'createdAt'
  );

  const totalItems = await Application.countDocuments(filter);
  const applications = await Application.find(filter)
    .populate('institution', 'name registrationId state')
    .populate('assignedOfficer', 'name email role')
    .sort(sort)
    .skip(skip)
    .limit(limit);

  return {
    applications,
    pagination: buildPaginationMeta(page, limit, totalItems)
  };
}

/**
 * Retrieves full application details including documents, score, alerts, and latest run
 */
async function getApplicationById(user, applicationId) {
  const application = await Application.findByIdOrNumber(applicationId)
    .populate('institution', 'name registrationId address state latitude longitude verificationStatus')
    .populate('assignedOfficer', 'name email role');

  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Role & ownership check
  if (user.role === 'INSTITUTION_USER' || user.role === 'INSTITUTION') {
    const userInstId = user.institution?._id || user.institution || user.institutionId;
    const appInstId = application.institution?._id || application.institution || application.institutionId;
    if (!userInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You do not have permission to access this application.');
    }
  }

  // Fetch related metadata
  const documents = await Document.find({ application: application._id, uploadStatus: { $ne: 'DELETED' } })
    .select('-extractedText')
    .sort({ createdAt: -1 });

  let latestScore = await RiskScore.findOne({ application: application._id }).sort({ calculatedAt: -1 });
  if (!latestScore && application.riskScore !== undefined && application.riskScore !== null) {
    latestScore = {
      totalScore: application.riskScore,
      riskLevel: application.riskLevel || 'YELLOW',
      calculatedAt: application.updatedAt || new Date()
    };
  }
  const alerts = await Alert.find({ application: application._id }).sort({ createdAt: -1 });
  const latestRun = await CheckRun.findOne({ application: application._id }).sort({ createdAt: -1 });

  return {
    application,
    documents,
    latestScore,
    alerts,
    latestRun
  };
}

/**
 * Updates application allowed fields
 */
async function updateApplication(user, applicationId, updateData, requestId = null) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Ownership verification
  if (user.role === 'INSTITUTION_USER' || user.role === 'INSTITUTION') {
    const userInstId = user.institution?._id || user.institution || user.institutionId;
    const appInstId = application.institution?._id || application.institution || application.institutionId;
    if (!userInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You cannot edit another institution\'s application.');
    }

    // Institution users can only modify applications in DRAFT or DEFICIENCY_RAISED states
    if (!['DRAFT', 'DEFICIENCY_RAISED'].includes(application.status)) {
      throw ApiError.badRequest(
        `Application cannot be modified when in '${application.status}' status.`
      );
    }
  }

  // Allowlist modifications only
  if (updateData.category) application.category = updateData.category.trim();
  if (updateData.academicYear) application.academicYear = updateData.academicYear.trim();

  await application.save();

  await logEvent({
    actorUser: user._id,
    action: 'APPLICATION_UPDATE',
    entityType: 'Application',
    entityId: application._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { updatedFields: Object.keys(updateData) }
  });

  return application;
}

/**
 * Validates requirements and submits application
 */
async function submitApplication(user, applicationId, requestId = null) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Ownership verification
  if (user.role === 'INSTITUTION_USER' || user.role === 'INSTITUTION') {
    const userInstId = user.institution?._id || user.institution || user.institutionId;
    const appInstId = application.institution?._id || application.institution || application.institutionId;
    if (!userInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You can only submit applications for your own institution.');
    }
  }

  // Must be in DRAFT or DEFICIENCY_RAISED
  if (!['DRAFT', 'DEFICIENCY_RAISED'].includes(application.status)) {
    throw ApiError.badRequest(
      `Cannot submit application in '${application.status}' state. Only DRAFT or DEFICIENCY_RAISED applications can be submitted.`
    );
  }

  const deficiencies = [];

  // Check required application metadata
  if (!application.category) {
    deficiencies.push({ field: 'category', message: 'Application category is missing.' });
  }
  if (!application.academicYear) {
    deficiencies.push({ field: 'academicYear', message: 'Academic year is missing.' });
  }

  // Check required uploaded documents
  const storedDocs = await Document.find({
    application: application._id,
    uploadStatus: 'STORED'
  });

  const isEoaCategory = ['EOA_CONTINUATION', 'EOA_INTAKE_INCREASE', 'EOA_NEW_COURSE'].includes(application.category);

  if (isEoaCategory) {
    const checklistService = require('./checklist.service');
    const chkResult = await checklistService.resolveChecklist(user, application._id);
    if (!chkResult.isComplete) {
      for (const m of chkResult.missingRequired) {
        deficiencies.push({
          field: m.docTypes[0] || m.id,
          message: `Mandatory regulatory document '${m.label}' (${m.docTypes.join('/')}) has not been uploaded.`
        });
      }
    }
  } else {
    const uploadedDocTypes = storedDocs.map((d) => (d.docType || d.documentType || '').toUpperCase());
    for (const requiredType of REQUIRED_SUBMISSION_DOCUMENTS) {
      if (!uploadedDocTypes.includes(requiredType)) {
        deficiencies.push({
          field: requiredType,
          message: `Mandatory document of type '${requiredType}' has not been uploaded.`
        });
      }
    }
  }

  // If there are deficiencies, reject submission with specific actionable list
  if (deficiencies.length > 0) {
    throw ApiError.badRequest('Application has deficiencies preventing submission', deficiencies);
  }

  // Transition status to SUBMITTED
  application.status = 'SUBMITTED';
  application.submittedAt = new Date();
  application.totalDocuments = storedDocs.length;
  await application.save();

  // Enqueue RECONCILE_APP job if documents are ready or being analyzed
  const { Job } = require('../models');
  const idempotencyKey = `reconcile:${application._id}:${Date.now()}`;
  await Job.create({
    type: 'RECONCILE_APP',
    payload: {
      applicationId: application._id.toString(),
      academicYear: application.academicYear,
      category: application.category
    },
    status: 'QUEUED',
    runAfter: new Date(),
    idempotencyKey
  });

  await logEvent({
    actorUser: user._id,
    action: 'APPLICATION_SUBMIT',
    entityType: 'Application',
    entityId: application._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { totalDocuments: storedDocs.length, submittedAt: application.submittedAt }
  });

  return application;
}

/**
 * Transitions application status adhering strictly to allowed status lifecycle
 */
async function transitionStatus(user, applicationId, targetStatus, reason = null, assignedOfficerId = null, requestId = null) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  const currentStatus = application.status;
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedNext.includes(targetStatus)) {
    throw ApiError.badRequest(
      `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowedNext.join(', ')}]`
    );
  }

  // Role checks for transitions
  if (['UNDER_SCRUTINY', 'DEFICIENCY_RAISED', 'VERIFIED'].includes(targetStatus)) {
    if (!['OFFICER', 'ADMIN'].includes(user.role)) {
      throw ApiError.forbidden(`Only officers or administrators can transition application to '${targetStatus}'.`);
    }
  }

  if (['APPROVED', 'REJECTED'].includes(targetStatus)) {
    if (user.role !== 'ADMIN') {
      throw ApiError.forbidden(`Final decision '${targetStatus}' requires ADMIN authorization.`);
    }
  }

  application.status = targetStatus;
  if (assignedOfficerId && (user.role === 'ADMIN' || user.role === 'OFFICER')) {
    application.assignedOfficer = assignedOfficerId;
  }

  await application.save();

  await logEvent({
    actorUser: user._id,
    action: 'APPLICATION_STATUS_CHANGE',
    entityType: 'Application',
    entityId: application._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { fromStatus: currentStatus, toStatus: targetStatus, reason }
  });

  return application;
}

module.exports = {
  createApplication,
  listApplications,
  getApplicationById,
  updateApplication,
  submitApplication,
  transitionStatus,
  REQUIRED_SUBMISSION_DOCUMENTS
};

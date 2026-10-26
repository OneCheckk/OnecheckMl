const FORBIDDEN_PATCH_FIELDS = [
  'status',
  'riskScore',
  'riskLevel',
  'assignedOfficer',
  'applicationNumber',
  'institution',
  'currentRunId',
  'totalDocuments',
  'flaggedDocuments'
];

function validateCreateApplication(req) {
  const errors = [];
  const { category, academicYear, institutionId } = req.body || {};

  if (!category || typeof category !== 'string' || !category.trim()) {
    errors.push({ field: 'category', message: 'Application category is required' });
  }

  // Default academicYear to '2026-2027' if missing in request body, rather than throwing a validation error
  if (!req.body?.academicYear || typeof req.body.academicYear !== 'string' || !req.body.academicYear.trim()) {
    if (req.body) {
      req.body.academicYear = '2026-2027';
    }
  }

  // If ADMIN is creating, institutionId must be provided in body
  if (req.user?.role === 'ADMIN' && (!institutionId || typeof institutionId !== 'string')) {
    errors.push({ field: 'institutionId', message: 'Institution ID is required for administrative creation' });
  }

  return errors;
}

function validatePatchApplication(req) {
  const errors = [];
  const bodyKeys = Object.keys(req.body || {});

  if (bodyKeys.length === 0) {
    errors.push({ field: 'body', message: 'Update payload cannot be empty' });
    return errors;
  }

  for (const field of bodyKeys) {
    if (FORBIDDEN_PATCH_FIELDS.includes(field)) {
      errors.push({
        field,
        message: `Field '${field}' is protected and cannot be modified via standard update.`
      });
    }
  }

  return errors;
}

module.exports = {
  validateCreateApplication,
  validatePatchApplication
};

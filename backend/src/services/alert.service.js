const { Alert } = require('../models');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');
const { logEvent } = require('./audit.service');

/**
 * Lists alerts with status, severity filters, and pagination
 */
async function listAlerts(user, query) {
  const filter = {};

  if (query.status) {
    const validStatuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE'];
    if (validStatuses.includes(query.status.toUpperCase())) {
      filter.status = query.status.toUpperCase();
    }
  }

  if (query.severity) {
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (validSeverities.includes(query.severity.toUpperCase())) {
      filter.severity = query.severity.toUpperCase();
    }
  }

  if (query.applicationId) {
    filter.application = query.applicationId;
  }

  const { page, limit, skip, sort } = parsePagination(
    query,
    ['createdAt', 'severity', 'status'],
    'createdAt'
  );

  const totalItems = await Alert.countDocuments(filter);
  const alerts = await Alert.find(filter)
    .populate('application', 'applicationNumber category academicYear status')
    .populate('resolvedBy', 'name email role')
    .sort(sort)
    .skip(skip)
    .limit(limit);

  return {
    alerts,
    pagination: buildPaginationMeta(page, limit, totalItems)
  };
}

/**
 * Updates alert status (acknowledge, resolve, false-positive) with mandatory audit log
 */
async function updateAlertStatus(user, alertId, newStatus, resolutionReason = null, requestId = null) {
  const validTransitions = ['ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE'];
  const formattedStatus = newStatus ? newStatus.toUpperCase().trim() : '';

  if (!validTransitions.includes(formattedStatus)) {
    throw ApiError.badRequest(
      `Invalid alert status '${newStatus}'. Allowed values: [${validTransitions.join(', ')}]`
    );
  }

  // Reason is mandatory when marking FALSE_POSITIVE or RESOLVED
  if (['RESOLVED', 'FALSE_POSITIVE'].includes(formattedStatus) && (!resolutionReason || !resolutionReason.trim())) {
    throw ApiError.badRequest(
      `A non-empty resolutionReason is required when transitioning alert to '${formattedStatus}'.`
    );
  }

  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw ApiError.notFound('Alert not found');
  }

  const previousStatus = alert.status;
  alert.status = formattedStatus;
  alert.resolvedBy = user._id;
  alert.resolvedAt = new Date();
  alert.resolutionReason = resolutionReason ? resolutionReason.trim() : null;
  await alert.save();

  await logEvent({
    actorUser: user._id,
    action: 'ALERT_STATUS_CHANGE',
    entityType: 'Alert',
    entityId: alert._id,
    application: alert.application,
    requestId,
    outcome: 'SUCCESS',
    metadata: { previousStatus, newStatus: formattedStatus, resolutionReason }
  });

  return alert;
}

module.exports = {
  listAlerts,
  updateAlertStatus
};

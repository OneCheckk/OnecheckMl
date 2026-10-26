const ApiError = require('../utils/ApiError');
const { Institution, User } = require('../models');
const { logEvent } = require('./audit.service');

/**
 * Creates a new institution profile
 */
async function createInstitution(user, data, requestId = null) {
  // Policy gate: If INSTITUTION_USER already has an institution assigned, forbid duplicate creation
  if (user.role === 'INSTITUTION_USER' && user.institution) {
    throw ApiError.conflict('An institution profile is already associated with this user account.');
  }

  // Check unique registration ID if supplied
  if (data.registrationId) {
    const existing = await Institution.findOne({ registrationId: data.registrationId.toUpperCase().trim() });
    if (existing) {
      throw ApiError.conflict(`An institution with registration ID '${data.registrationId}' already exists.`);
    }
  }

  const institution = await Institution.create({
    name: data.name.trim(),
    registrationId: data.registrationId ? data.registrationId.toUpperCase().trim() : undefined,
    address: data.address.trim(),
    state: data.state.trim(),
    latitude: data.latitude,
    longitude: data.longitude,
    verificationStatus: 'PENDING',
    createdBy: user._id
  });

  // If created by an INSTITUTION_USER, link institution to their user profile
  if (user.role === 'INSTITUTION_USER') {
    await User.findByIdAndUpdate(user._id, { institution: institution._id });
    user.institution = institution._id;
  }

  await logEvent({
    actorUser: user._id,
    action: 'INSTITUTION_CREATE',
    entityType: 'Institution',
    entityId: institution._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { name: institution.name, state: institution.state }
  });

  return institution;
}

/**
 * Retrieves institution by ID enforcing role and ownership rules
 */
async function getInstitutionById(user, institutionId) {
  const institution = await Institution.findById(institutionId);
  if (!institution) {
    throw ApiError.notFound('Institution not found');
  }

  // Ownership scope: INSTITUTION_USER can only view their own institution
  if (user.role === 'INSTITUTION_USER') {
    const userInstId = user.institution?._id || user.institution;
    if (!userInstId || userInstId.toString() !== institution._id.toString()) {
      throw ApiError.forbidden('Access denied: You do not have permission to view this institution profile.');
    }
  }

  return institution;
}

/**
 * Retrieves bulk list of institutions for authorized users
 */
async function listInstitutions(user) {
  let query = {};
  if (user && (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER')) {
    const userInstId = user.institution?._id || user.institution || user.institutionId;
    if (userInstId) {
      query._id = userInstId;
    }
  }
  return await Institution.find(query).sort({ name: 1 });
}

module.exports = {
  createInstitution,
  getInstitutionById,
  listInstitutions
};

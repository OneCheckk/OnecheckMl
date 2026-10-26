const { FacultyHash, Alert } = require('../models');
const { generateIdentifierHmac } = require('../utils/hmac');
const verificationClient = require('./verificationClient.service');
const logger = require('../config/logger');

/**
 * Executes faculty collision check against other institution applications
 */
async function runFacultyCollisionCheck(applicationId, institutionId, runId) {
  const currentFacultyList = await FacultyHash.find({ application: applicationId });
  const findings = [];

  for (const faculty of currentFacultyList) {
    // Cross-application collision query (excludes current application)
    const collision = await FacultyHash.findOne({
      application: { $ne: applicationId },
      identifierType: faculty.identifierType,
      identifierHmac: faculty.identifierHmac
    }).populate('institution', 'name');

    if (collision) {
      faculty.isGhostFlagged = true;
      faculty.matchInstitution = collision.institution?._id || collision.institution;
      faculty.matchApplication = collision.application;
      faculty.matchConfidence = 1.0;
      faculty.lastCheckedRunId = runId;
      await faculty.save();

      // Deduplicate alert: check if an open alert already exists for this faculty record
      const existingAlert = await Alert.findOne({
        application: applicationId,
        type: 'FACULTY_COLLISION',
        sourceModel: 'FacultyHash',
        sourceId: faculty._id,
        status: { $in: ['OPEN', 'ACKNOWLEDGED'] }
      });

      if (!existingAlert) {
        const instName = collision.institution?.name || 'another registered institution';
        await Alert.create({
          application: applicationId,
          runId,
          type: 'FACULTY_COLLISION',
          severity: 'CRITICAL',
          title: 'Faculty collision detected across applications',
          message: `Faculty member (${faculty.nameNormalized}) identifier is also claimed by ${instName}.`,
          sourceModel: 'FacultyHash',
          sourceId: faculty._id,
          status: 'OPEN'
        });
      }

      findings.push({
        facultyId: faculty._id,
        name: faculty.nameNormalized,
        collisionWith: collision.application
      });
    } else {
      faculty.lastCheckedRunId = runId;
      await faculty.save();
    }
  }

  // Optional external fuzzy matching call
  if (currentFacultyList.length > 0) {
    const names = currentFacultyList.map((f) => f.nameNormalized);
    try {
      await verificationClient.matchFacultyNames(names);
    } catch (err) {
      logger.warn('Fuzzy faculty match adapter call skipped', { error: err.message });
    }
  }

  return {
    checkedCount: currentFacultyList.length,
    collisionsFound: findings.length,
    findings
  };
}

module.exports = {
  runFacultyCollisionCheck
};

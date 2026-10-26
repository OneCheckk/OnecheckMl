const geolib = require('geolib');
const { Institution, InfraPhoto, Alert } = require('../models');
const verificationClient = require('./verificationClient.service');
const ApiError = require('../utils/ApiError');

const GEOFENCE_RADIUS_METERS = 500;

/**
 * Executes geofence distance calculation and EXIF extraction on application photos
 */
async function runGeofenceCheck(applicationId, institutionId, runId) {
  const institution = await Institution.findById(institutionId);
  if (!institution) {
    throw ApiError.notFound('Associated institution profile not found');
  }

  if (institution.latitude === null || institution.latitude === undefined ||
      institution.longitude === null || institution.longitude === undefined) {
    return {
      status: 'DEFICIENT',
      message: 'Campus coordinates are not configured on institution record. Cannot perform geofence verification.',
      photosChecked: 0
    };
  }

  const campusCoords = {
    latitude: institution.latitude,
    longitude: institution.longitude
  };

  const photos = await InfraPhoto.find({ application: applicationId });
  const results = [];

  for (const photo of photos) {
    // 1. Extract GPS from verification service
    const exifData = await verificationClient.extractPhotoMetadata(photo.storageKey);

    // 2. Compute pHash
    const phashData = await verificationClient.computePerceptualHash(photo.storageKey);
    if (phashData.imageHash) {
      photo.imageHash = phashData.imageHash;
    }

    if (exifData.gpsLatitude === null || exifData.gpsLongitude === null) {
      photo.geofenceStatus = 'NO_GPS_DATA';
      photo.distanceFromCampus = null;
      photo.lastCheckedRunId = runId;
      await photo.save();

      // Deduplicate alert: check if NO_GPS_DATA alert already exists
      const existingAlert = await Alert.findOne({
        application: applicationId,
        type: 'NO_GPS_DATA',
        sourceModel: 'InfraPhoto',
        sourceId: photo._id,
        status: { $in: ['OPEN', 'ACKNOWLEDGED'] }
      });

      if (!existingAlert) {
        await Alert.create({
          application: applicationId,
          runId,
          type: 'NO_GPS_DATA',
          severity: 'LOW',
          title: 'Infrastructure photo lacks GPS metadata',
          message: `Photo of type '${photo.photoType}' lacks embedded EXIF GPS coordinates for physical verification.`,
          sourceModel: 'InfraPhoto',
          sourceId: photo._id,
          status: 'OPEN'
        });
      }

      results.push({ photoId: photo._id, status: 'NO_GPS_DATA', distance: null });
      continue;
    }

    // GPS data exists: calculate straight-line distance
    const photoCoords = {
      latitude: exifData.gpsLatitude,
      longitude: exifData.gpsLongitude
    };

    const distanceMeters = geolib.getDistance(campusCoords, photoCoords);
    photo.gpsLatitude = exifData.gpsLatitude;
    photo.gpsLongitude = exifData.gpsLongitude;
    photo.distanceFromCampus = distanceMeters;
    photo.lastCheckedRunId = runId;

    if (distanceMeters <= GEOFENCE_RADIUS_METERS) {
      photo.geofenceStatus = 'PASS';
      results.push({ photoId: photo._id, status: 'PASS', distance: distanceMeters });
    } else {
      photo.geofenceStatus = 'FAIL';

      // Deduplicate alert: check if GPS_MISMATCH alert exists
      const existingAlert = await Alert.findOne({
        application: applicationId,
        type: 'GPS_MISMATCH',
        sourceModel: 'InfraPhoto',
        sourceId: photo._id,
        status: { $in: ['OPEN', 'ACKNOWLEDGED'] }
      });

      if (!existingAlert) {
        await Alert.create({
          application: applicationId,
          runId,
          type: 'GPS_MISMATCH',
          severity: 'HIGH',
          title: 'Infrastructure photo coordinates outside campus geofence',
          message: `Photo was captured ${distanceMeters}m from campus, exceeding the statutory ${GEOFENCE_RADIUS_METERS}m perimeter limit.`,
          sourceModel: 'InfraPhoto',
          sourceId: photo._id,
          status: 'OPEN'
        });
      }

      results.push({ photoId: photo._id, status: 'FAIL', distance: distanceMeters });
    }

    await photo.save();
  }

  return {
    status: 'SUCCEEDED',
    photosChecked: photos.length,
    results
  };
}

module.exports = {
  runGeofenceCheck,
  GEOFENCE_RADIUS_METERS
};

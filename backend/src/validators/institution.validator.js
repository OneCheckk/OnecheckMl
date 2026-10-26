function validateCreateInstitution(req) {
  const errors = [];
  const { name, address, state, latitude, longitude } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push({ field: 'name', message: 'Institution name is required' });
  }

  if (!address || typeof address !== 'string' || !address.trim()) {
    errors.push({ field: 'address', message: 'Address is required' });
  }

  if (!state || typeof state !== 'string' || !state.trim()) {
    errors.push({ field: 'state', message: 'State is required' });
  }

  if (latitude === undefined || latitude === null || typeof latitude !== 'number') {
    errors.push({ field: 'latitude', message: 'Latitude must be a valid number' });
  } else if (latitude < -90 || latitude > 90) {
    errors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90' });
  }

  if (longitude === undefined || longitude === null || typeof longitude !== 'number') {
    errors.push({ field: 'longitude', message: 'Longitude must be a valid number' });
  } else if (longitude < -180 || longitude > 180) {
    errors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180' });
  }

  return errors;
}

module.exports = {
  validateCreateInstitution
};

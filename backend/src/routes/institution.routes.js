const express = require('express');
const institutionController = require('../controllers/institution.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { validateCreateInstitution } = require('../validators/institution.validator');

const router = express.Router();

// Canonical: POST /api/institutions (ADMIN / INSTITUTION_USER)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'INSTITUTION_USER'),
  validate(validateCreateInstitution),
  institutionController.createInstitution
);

// Canonical: GET /api/institutions (Bulk List)
router.get('/', authenticate, institutionController.listInstitutions);

// Canonical: GET /api/institutions/:id (Role + ownership check)
router.get('/:id', authenticate, institutionController.getInstitutionById);

module.exports = router;

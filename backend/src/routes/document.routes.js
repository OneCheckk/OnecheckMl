const express = require('express');
const documentController = require('../controllers/document.controller');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { upload } = require('../config/upload');

const router = express.Router();

// Canonical: POST /api/documents/:appId/upload (Institution owner / ADMIN)
router.post(
  '/:appId/upload',
  authenticate,
  authorize('INSTITUTION_USER', 'ADMIN'),
  upload.any(),
  documentController.upload
);

// Spec: POST /api/documents/:docId/replace (INSTITUTION)
router.post(
  '/:docId/replace',
  authenticate,
  authorize('INSTITUTION_USER', 'INSTITUTION', 'ADMIN'),
  upload.any(),
  documentController.replaceSpec
);

// Spec: GET /api/documents/:docId/file (Scoped - inline streaming)
router.get('/:docId/file', authenticate, documentController.streamFile);

// Canonical: GET /api/documents/:docId (Authorized user)
router.get('/:docId', authenticate, documentController.getMetadata);

// Canonical: GET /api/documents/:docId/download (Authorized user)
router.get('/:docId/download', authenticate, documentController.download);

// Canonical: POST /api/documents/:docId/ocr (OFFICER / ADMIN)
router.post(
  '/:docId/ocr',
  authenticate,
  authorize('OFFICER', 'ADMIN'),
  documentController.runOcr
);

// Canonical: POST /api/documents/:docId/ela (OFFICER / ADMIN)
router.post(
  '/:docId/ela',
  authenticate,
  authorize('OFFICER', 'ADMIN'),
  documentController.runEla
);

// Spec: POST /api/documents/:docId/verify (INSTITUTION / OFFICER / ADMIN)
const ledgerController = require('../controllers/ledger.controller');
router.post(
  '/:docId/verify',
  authenticate,
  ledgerController.verifyDocument
);

module.exports = router;

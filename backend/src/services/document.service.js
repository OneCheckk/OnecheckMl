const fs = require('fs');
const path = require('path');
const ApiError = require('../utils/ApiError');
const { Application, Document, InfraPhoto, Alert } = require('../models');
const verificationClient = require('./verificationClient.service');
const {
  validateFileSignature,
  computeSha256,
  savePrivateFile,
  saveOriginalFile,
  getPrivateFilePath,
  resolveFilePath,
  deletePrivateFile
} = require('./storage.service');
const { logEvent } = require('./audit.service');

/**
 * Uploads one or more documents, validates magic bytes, computes checksums, and persists metadata
 */
async function uploadDocuments(user, applicationId, files, bodyData = {}, requestId = null) {
  if (!files || files.length === 0) {
    throw ApiError.badRequest('No files provided in multipart upload request');
  }

  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Target application not found');
  }

  // Ownership verification: Institution user can only upload to their own application
  if (user.role === 'INSTITUTION_USER') {
    const userInstId = user.institution?._id || user.institution;
    if (!userInstId || userInstId.toString() !== application.institution.toString()) {
      throw ApiError.forbidden('Access denied: You cannot upload documents to another institution\'s application.');
    }

    if (!['DRAFT', 'DEFICIENCY_RAISED'].includes(application.status)) {
      throw ApiError.badRequest(
        `Cannot upload documents when application is in '${application.status}' status.`
      );
    }
  }

  const createdDocuments = [];
  const writtenStorageKeys = [];

  try {
    for (const file of files) {
      // 1. Validate magic bytes / file signature
      const isSignatureValid = validateFileSignature(file.buffer, file.mimetype);
      if (!isSignatureValid) {
        throw ApiError.unsupportedMediaType(
          `File signature does not match declared MIME type '${file.mimetype}' for file '${file.originalname}'. Spoofed file rejected.`
        );
      }

      // 2. Compute SHA-256 checksum
      const sha256FileHash = computeSha256(file.buffer);

      // 3. Save to private storage with random server UUID name
      const ext = path.extname(file.originalname);
      const { storageKey } = await savePrivateFile(file.buffer, ext);
      writtenStorageKeys.push(storageKey);

      // 4. Sanitize original filename (remove directory traversals)
      const sanitizedOriginalName = path.basename(file.originalname);

      // 5. Determine document type
      const documentType = (bodyData.documentType || file.fieldname || 'GENERAL_DOCUMENT')
        .toUpperCase()
        .trim();

      // 6. Persist Document record
      const docRecord = await Document.create({
        application: application._id,
        documentType,
        originalName: sanitizedOriginalName,
        storageKey,
        fileSize: file.size,
        mimeType: file.mimetype.toLowerCase(),
        sha256FileHash,
        uploadedBy: user._id,
        uploadStatus: 'STORED',
        verificationStatus: 'PENDING'
      });

      // If document is an infrastructure photo, link or create InfraPhoto record
      if (documentType === 'INFRA_PHOTO') {
        await InfraPhoto.create({
          application: application._id,
          document: docRecord._id,
          photoType: bodyData.photoType || 'CAMPUS_INFRA',
          storageKey
        });
      }

      createdDocuments.push(docRecord);
    }

    // Update total documents count on application
    const totalCount = await Document.countDocuments({
      application: application._id,
      uploadStatus: 'STORED'
    });
    application.totalDocuments = totalCount;
    await application.save();

    await logEvent({
      actorUser: user._id,
      action: 'DOCUMENT_UPLOAD',
      entityType: 'Document',
      entityId: createdDocuments[0]._id,
      application: application._id,
      requestId,
      outcome: 'SUCCESS',
      metadata: { count: createdDocuments.length, docTypes: createdDocuments.map((d) => d.documentType) }
    });

    return createdDocuments;
  } catch (err) {
    // If any error occurs during multi-file processing or DB write, clean up written files immediately
    for (const key of writtenStorageKeys) {
      await deletePrivateFile(key);
    }
    throw err;
  }
}

/**
 * Retrieves safe document metadata with access control
 */
async function getDocumentMetadata(user, documentId) {
  const document = await Document.findById(documentId).populate('application', 'institution status');
  if (!document || document.uploadStatus === 'DELETED') {
    throw ApiError.notFound('Document not found');
  }

  // Ownership verification
  if (user.role === 'INSTITUTION_USER') {
    const userInstId = user.institution?._id || user.institution;
    const appInstId = document.application?.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You do not have permission to view this document.');
    }
  }

  return document;
}

/**
 * Retrieves document and verified physical file path for safe streaming download
 */
async function getDocumentForDownload(user, documentId) {
  const document = await Document.findById(documentId).populate('application', 'institution status');
  if (!document || document.uploadStatus === 'DELETED') {
    throw ApiError.notFound('Document not found');
  }

  // Role and ownership check
  if (user.role === 'INSTITUTION_USER') {
    const userInstId = user.institution?._id || user.institution;
    const appInstId = document.application?.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You do not have permission to download this document.');
    }
  }

  const filePath = getPrivateFilePath(document.storageKey);
  if (!fs.existsSync(filePath)) {
    throw ApiError.notFound('Physical file not found in storage');
  }

  return { document, filePath };
}

/**
 * Executes on-demand OCR on a specific document
 */
async function runDocumentOcr(user, documentId, requestId = null) {
  const document = await Document.findById(documentId);
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  const ocrResult = await verificationClient.extractDocumentText(document.storageKey, document.documentType);
  if (ocrResult.status === 'SUCCEEDED') {
    document.extractedFields = ocrResult.fields;
    document.extractedText = ocrResult.text;
    document.verificationStatus = 'VERIFIED_AT_SOURCE';
    await document.save();
  }

  return {
    documentId: document._id,
    ocr: ocrResult
  };
}

/**
 * Executes on-demand ELA tamper analysis on a specific document
 */
async function runDocumentEla(user, documentId, requestId = null) {
  const document = await Document.findById(documentId);
  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  const elaResult = await verificationClient.analyzeTampering(document.storageKey);
  if (elaResult.status === 'SUCCEEDED' && elaResult.suspected) {
    await Alert.create({
      application: document.application,
      runId: document.latestCheckRunId || 'standalone_check',
      type: 'TAMPER_SUSPECTED',
      severity: 'CRITICAL',
      title: 'Digital document tampering suspected',
      message: `Error Level Analysis detected pixel inconsistencies in '${document.originalName}'.`,
      sourceModel: 'Document',
      sourceId: document._id,
      status: 'OPEN'
    });
  }

  return {
    documentId: document._id,
    ela: elaResult
  };
}

/**
 * Spec upload: POST /applications/:id/documents
 * Validates magic bytes, size, computes sha256, checks duplicates, stores under originals/, enqueues ANALYZE_DOC
 */
async function uploadDocumentSpec(user, applicationId, file, docTypeHint = 'OTHER', requestId = null) {
  if (!file || !file.buffer) {
    throw ApiError.badRequest('No document file attached in request payload.');
  }

  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Target application not found');
  }

  // Scoping: Institution users can only upload to their own application
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You can only upload documents to your own institution application.');
    }
  }

  // Magic-byte check (not only extension)
  const isSignatureValid = validateFileSignature(file.buffer, file.mimetype);
  if (!isSignatureValid) {
    throw ApiError.unsupportedMediaType(
      `File signature does not match declared MIME type '${file.mimetype}'. Unsupported or corrupt file.`
    );
  }

  const sha256 = computeSha256(file.buffer);

  // Duplicate detection: If same sha256 in same application, return existing document with notice
  const existingDoc = await Document.findOne({
    $or: [{ application: application._id }, { applicationId: application._id }],
    $or: [{ sha256 }, { sha256FileHash: sha256 }],
    uploadStatus: { $ne: 'DELETED' }
  });

  if (existingDoc) {
    return {
      notice: 'Document already uploaded: An identical file (matching SHA-256) already exists in this application.',
      document: existingDoc,
      isDuplicate: true
    };
  }

  const mongoose = require('mongoose');
  const { Job } = require('../models');
  const docId = new mongoose.Types.ObjectId();
  const ext = path.extname(file.originalname) || '.pdf';

  // Store original under originals/<appId>/<docId>_<sha256>.<ext>
  const { storagePath, fullPath } = await saveOriginalFile({
    buffer: file.buffer,
    appId: application._id,
    docId: docId.toString(),
    sha256,
    extension: ext
  });

  const normalizedDocType = (docTypeHint || 'OTHER').toUpperCase().trim();

  const docRecord = await Document.create({
    _id: docId,
    application: application._id,
    applicationId: application._id,
    documentType: normalizedDocType,
    docType: normalizedDocType,
    typeConfidence: 1.0,
    originalName: path.basename(file.originalname),
    mime: file.mimetype.toLowerCase(),
    mimeType: file.mimetype.toLowerCase(),
    sizeBytes: file.size,
    fileSize: file.size,
    sha256,
    sha256FileHash: sha256,
    storagePath,
    storageKey: storagePath,
    version: 1,
    pageCount: 1,
    analysis: {
      status: 'QUEUED',
      method: null,
      error: null,
      forensics: [],
      warnings: []
    },
    fingerprints: {
      sha256,
      textMinhash: [],
      imagePhash: null
    },
    uploadedBy: user._id,
    uploadStatus: 'STORED',
    verificationStatus: 'PENDING'
  });

  // Queue ANALYZE_DOC background job with idempotency key
  const idempotencyKey = `analyze:${docRecord._id}:${sha256}`;
  await Job.findOneAndUpdate(
    { idempotencyKey },
    {
      type: 'ANALYZE_DOC',
      payload: {
        docId: docRecord._id.toString(),
        applicationId: application._id.toString(),
        filePath: fullPath,
        mime: file.mimetype,
        hintDocType: normalizedDocType,
        site: application.institution?.site || null
      },
      status: 'QUEUED',
      runAfter: new Date(),
      idempotencyKey
    },
    { upsert: true, new: true }
  );

  await logEvent({
    actorUser: user._id,
    action: 'DOC_UPLOADED',
    entityType: 'Document',
    entityId: docRecord._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { docId: docRecord._id, docType: normalizedDocType, sha256, version: 1 }
  });

  return {
    notice: null,
    document: docRecord,
    isDuplicate: false
  };
}

/**
 * Spec replace: POST /documents/:docId/replace
 * Creates new version, marks old superseded, and enqueues ANALYZE_DOC
 */
async function replaceDocumentVersion(user, docId, file, docTypeHint = null, requestId = null) {
  if (!file || !file.buffer) {
    throw ApiError.badRequest('No replacement file attached.');
  }

  const oldDoc = await Document.findById(docId).populate('application');
  if (!oldDoc || oldDoc.uploadStatus === 'DELETED') {
    throw ApiError.notFound('Target document to replace not found');
  }

  const application = oldDoc.application;

  // Scoping: Institution on own application
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application?.institutionId || application?.institution?._id || application?.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You can only replace documents belonging to your institution.');
    }

    if (!['DRAFT', 'CLARIFICATION_REQUESTED', 'DEFICIENCY_RAISED'].includes(application.status)) {
      throw ApiError.badRequest(
        `Cannot replace document when application is in '${application.status}' status.`
      );
    }
  }

  const isSignatureValid = validateFileSignature(file.buffer, file.mimetype);
  if (!isSignatureValid) {
    throw ApiError.unsupportedMediaType('File signature does not match declared MIME type. Unsupported or corrupt file.');
  }

  const sha256 = computeSha256(file.buffer);
  const mongoose = require('mongoose');
  const { Job } = require('../models');
  const newDocId = new mongoose.Types.ObjectId();
  const ext = path.extname(file.originalname) || '.pdf';

  const { storagePath, fullPath } = await saveOriginalFile({
    buffer: file.buffer,
    appId: application._id,
    docId: newDocId.toString(),
    sha256,
    extension: ext
  });

  const nextVersion = (oldDoc.version || 1) + 1;
  const docType = (docTypeHint || oldDoc.docType || oldDoc.documentType || 'OTHER').toUpperCase().trim();

  // Mark old document superseded
  oldDoc.uploadStatus = 'SUPERSEDED';
  await oldDoc.save();

  const newDocRecord = await Document.create({
    _id: newDocId,
    application: application._id,
    applicationId: application._id,
    documentType: docType,
    docType,
    typeConfidence: 1.0,
    originalName: path.basename(file.originalname),
    mime: file.mimetype.toLowerCase(),
    mimeType: file.mimetype.toLowerCase(),
    sizeBytes: file.size,
    fileSize: file.size,
    sha256,
    sha256FileHash: sha256,
    storagePath,
    storageKey: storagePath,
    version: nextVersion,
    supersedesDocId: oldDoc._id,
    pageCount: 1,
    analysis: {
      status: 'QUEUED',
      method: null,
      error: null,
      forensics: [],
      warnings: []
    },
    fingerprints: {
      sha256,
      textMinhash: [],
      imagePhash: null
    },
    uploadedBy: user._id,
    uploadStatus: 'STORED',
    verificationStatus: 'PENDING'
  });

  // Enqueue ANALYZE_DOC for new version
  const idempotencyKey = `analyze:${newDocRecord._id}:${sha256}`;
  await Job.findOneAndUpdate(
    { idempotencyKey },
    {
      type: 'ANALYZE_DOC',
      payload: {
        docId: newDocRecord._id.toString(),
        applicationId: application._id.toString(),
        filePath: fullPath,
        mime: file.mimetype,
        hintDocType: docType,
        site: application.institution?.site || null
      },
      status: 'QUEUED',
      runAfter: new Date(),
      idempotencyKey
    },
    { upsert: true, new: true }
  );

  await logEvent({
    actorUser: user._id,
    action: 'DOC_UPLOADED',
    entityType: 'Document',
    entityId: newDocRecord._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      docId: newDocRecord._id,
      supersedesDocId: oldDoc._id,
      version: nextVersion,
      sha256
    }
  });

  return newDocRecord;
}

/**
 * Spec stream: GET /documents/:docId/file
 * Streams with Content-Disposition: inline and logs DOC_ACCESSED audit event
 */
async function streamDocumentFile(user, docId, res, requestId = null) {
  const document = await Document.findById(docId).populate('application');
  if (!document || document.uploadStatus === 'DELETED') {
    throw ApiError.notFound('Document not found');
  }

  // Scoping check
  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = document.application?.institutionId || document.application?.institution?._id || document.application?.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You do not have permission to access this document.');
    }
  }

  const { resolveFilePath } = require('./storage.service');
  const filePath = resolveFilePath(document.storagePath || document.storageKey);

  if (!fs.existsSync(filePath)) {
    throw ApiError.notFound('Physical document file not found on disk.');
  }

  await logEvent({
    actorUser: user._id,
    action: 'DOC_ACCESSED',
    entityType: 'Document',
    entityId: document._id,
    application: document.application?._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { docId: document._id, originalName: document.originalName }
  });

  res.setHeader('Content-Type', document.mime || document.mimeType || 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(document.originalName)}"`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');

  fs.createReadStream(filePath).pipe(res);
}

/**
 * Lists documents for an application
 */
async function listApplicationDocuments(user, applicationId) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  if (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER') {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied');
    }
  }

  return Document.find({
    $or: [{ application: application._id }, { applicationId: application._id }],
    uploadStatus: { $ne: 'DELETED' }
  }).sort({ version: -1, createdAt: -1 });
}

module.exports = {
  uploadDocuments,
  getDocumentMetadata,
  getDocumentForDownload,
  runDocumentOcr,
  runDocumentEla,
  uploadDocumentSpec,
  replaceDocumentVersion,
  streamDocumentFile,
  listApplicationDocuments
};


const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const documentService = require('../services/document.service');
const ApiError = require('../utils/ApiError');

const upload = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const files = req.files || (req.file ? [req.file] : []);

  if (files.length === 0) {
    throw ApiError.badRequest('No files found in upload payload. Attach file using form-data.');
  }

  const documents = await documentService.uploadDocuments(
    req.user,
    req.params.appId,
    files,
    req.body,
    requestId
  );

  res.status(201).json({
    success: true,
    data: { documents },
    meta: {
      requestId
    }
  });
});

const getMetadata = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const document = await documentService.getDocumentMetadata(req.user, req.params.docId);

  res.status(200).json({
    success: true,
    data: { document },
    meta: {
      requestId
    }
  });
});

const download = asyncHandler(async (req, res) => {
  const { document, filePath } = await documentService.getDocumentForDownload(
    req.user,
    req.params.docId
  );

  // Set safe headers
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(document.originalName)}"`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

const runOcr = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const result = await documentService.runDocumentOcr(req.user, req.params.docId, requestId);

  res.status(200).json({
    success: true,
    data: result,
    meta: {
      requestId
    }
  });
});

const runEla = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const result = await documentService.runDocumentEla(req.user, req.params.docId, requestId);

  res.status(200).json({
    success: true,
    data: result,
    meta: {
      requestId
    }
  });
});

const uploadSpec = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const file = req.file || (req.files && req.files[0]);

  if (!file) {
    throw ApiError.badRequest('No document attached. Multipart upload required.');
  }

  const result = await documentService.uploadDocumentSpec(
    req.user,
    req.params.id || req.params.appId,
    file,
    req.body.docTypeHint || req.body.documentType,
    requestId
  );

  const statusCode = result.isDuplicate ? 200 : 201;
  res.status(statusCode).json({
    success: true,
    data: result.document,
    notice: result.notice,
    meta: { requestId }
  });
});

const replaceSpec = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const file = req.file || (req.files && req.files[0]);

  if (!file) {
    throw ApiError.badRequest('No replacement file attached.');
  }

  const newDoc = await documentService.replaceDocumentVersion(
    req.user,
    req.params.docId,
    file,
    req.body.docTypeHint || req.body.documentType,
    requestId
  );

  res.status(201).json({
    success: true,
    data: newDoc,
    meta: { requestId }
  });
});

const streamFile = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  await documentService.streamDocumentFile(req.user, req.params.docId, res, requestId);
});

const listDocuments = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const documents = await documentService.listApplicationDocuments(
    req.user,
    req.params.id || req.params.appId
  );

  res.status(200).json({
    success: true,
    data: documents,
    meta: { requestId }
  });
});

module.exports = {
  upload,
  getMetadata,
  download,
  runOcr,
  runEla,
  uploadSpec,
  replaceSpec,
  streamFile,
  listDocuments
};

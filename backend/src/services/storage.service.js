const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

// Magic byte signatures
const SIGNATURES = {
  PDF: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  JPEG: [0xff, 0xd8, 0xff],
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
};

/**
 * Ensures the private upload directory exists
 */
function ensureUploadDir() {
  const uploadPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  return uploadPath;
}

/**
 * Validates actual binary magic bytes against declared MIME type
 */
function validateFileSignature(buffer, declaredMimeType) {
  if (!buffer || buffer.length < 8) return false;

  const mime = declaredMimeType.toLowerCase();

  if (mime === 'application/pdf') {
    return SIGNATURES.PDF.every((byte, i) => buffer[i] === byte);
  }

  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return SIGNATURES.JPEG.every((byte, i) => buffer[i] === byte);
  }

  if (mime === 'image/png') {
    return SIGNATURES.PNG.every((byte, i) => buffer[i] === byte);
  }

  return false;
}

/**
 * Computes SHA-256 checksum hex of buffer
 */
function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Writes file buffer to private storage with random server UUID name
 */
async function savePrivateFile(buffer, extension) {
  const uploadDir = ensureUploadDir();
  const safeExt = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  const storageKey = `doc_${uuidv4()}${safeExt}`;
  const filePath = path.join(uploadDir, storageKey);

  await fs.promises.writeFile(filePath, buffer);
  return { storageKey, filePath };
}

/**
 * Resolves storageKey to full disk path while preventing path traversal attacks
 */
function getPrivateFilePath(storageKey) {
  const uploadDir = ensureUploadDir();
  // Strip any directory traversal components
  const sanitizedKey = path.basename(storageKey);
  const resolvedPath = path.resolve(uploadDir, sanitizedKey);

  // Path traversal check
  if (!resolvedPath.startsWith(uploadDir)) {
    throw ApiError.badRequest('Invalid file storage key: path traversal detected');
  }

  return resolvedPath;
}

/**
 * Safely removes a file from private storage
 */
async function deletePrivateFile(storageKey) {
  try {
    const filePath = getPrivateFilePath(storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.info(`Deleted private file: ${storageKey}`);
    }
  } catch (err) {
    logger.error(`Failed to delete private file: ${storageKey}`, { error: err.message });
  }
}

/**
 * Writes file buffer under specification structure: originals/<appId>/<docId>_<sha256>.<ext>
 */
async function saveOriginalFile({ buffer, appId, docId, sha256, extension }) {
  const uploadDir = ensureUploadDir();
  const safeExt = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  const relDir = path.join('originals', String(appId));
  const fullDir = path.join(uploadDir, relDir);

  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
  }

  const fileName = `${docId}_${sha256}${safeExt}`;
  const relPath = path.join(relDir, fileName).replace(/\\/g, '/');
  const fullPath = path.join(fullDir, fileName);

  await fs.promises.writeFile(fullPath, buffer);
  return { storagePath: relPath, fullPath };
}

/**
 * Resolves storagePath or storageKey with strict path traversal defense
 */
function resolveFilePath(relativePathOrKey) {
  const uploadDir = ensureUploadDir();
  const normalized = path.normalize(relativePathOrKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolvedPath = path.resolve(uploadDir, normalized);

  if (!resolvedPath.startsWith(uploadDir)) {
    throw ApiError.badRequest('Invalid storage path: directory traversal attempt detected');
  }

  return resolvedPath;
}

module.exports = {
  validateFileSignature,
  computeSha256,
  savePrivateFile,
  saveOriginalFile,
  getPrivateFilePath,
  resolveFilePath,
  deletePrivateFile,
  ensureUploadDir
};

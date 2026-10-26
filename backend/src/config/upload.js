const multer = require('multer');
const env = require('./env');
const ApiError = require('../utils/ApiError');

// Allowed extensions and MIME types
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// Configure in-memory storage for inspection before committing to disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, // Per-file size limit (bytes)
    files: env.MAX_FILES_PER_REQUEST // Max file count per request
  },
  fileFilter: (req, file, cb) => {
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      return cb(
        ApiError.unsupportedMediaType(
          `File format not allowed for '${file.originalname}'. Only PDF, JPEG, and PNG formats are supported.`
        )
      );
    }
    cb(null, true);
  }
});

module.exports = {
  upload,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES
};

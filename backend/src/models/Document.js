const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required']
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null
    },
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      trim: true,
      uppercase: true
    },
    docType: {
      type: String,
      trim: true,
      uppercase: true
    },
    typeConfidence: {
      type: Number,
      default: 1.0
    },
    originalName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true
    },
    storageKey: {
      type: String,
      required: [true, 'Storage key is required'],
      unique: true,
      trim: true
    },
    storagePath: {
      type: String,
      trim: true
    },
    fileSize: {
      type: Number,
      required: [true, 'File size in bytes is required'],
      min: [1, 'File size must be greater than 0']
    },
    sizeBytes: {
      type: Number
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true
    },
    mime: {
      type: String,
      trim: true
    },
    sha256FileHash: {
      type: String,
      required: [true, 'SHA-256 file checksum is required'],
      trim: true
    },
    sha256: {
      type: String,
      trim: true
    },
    version: {
      type: Number,
      default: 1
    },
    supersedesDocId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null
    },
    pageCount: {
      type: Number,
      default: 1
    },
    analysis: {
      status: {
        type: String,
        enum: ['QUEUED', 'RUNNING', 'DONE', 'FAILED', null],
        default: null
      },
      method: {
        type: String,
        enum: ['TEXT_LAYER', 'OCR', 'MIXED', null],
        default: null
      },
      error: { type: String, default: null },
      forensics: { type: [mongoose.Schema.Types.Mixed], default: [] },
      warnings: { type: [String], default: [] }
    },
    fingerprints: {
      sha256: { type: String, default: null },
      textMinhash: { type: [Number], default: [] },
      imagePhash: { type: String, default: null }
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader user reference is required']
    },
    uploadStatus: {
      type: String,
      enum: ['UPLOADING', 'STORED', 'REJECTED', 'DELETED', 'SUPERSEDED'],
      default: 'STORED'
    },
    verificationStatus: {
      type: String,
      enum: [
        'PENDING',
        'VERIFIED_AT_SOURCE',
        'MISMATCH_DETECTED',
        'EXPIRED',
        'UNAVAILABLE',
        'MANUAL_REVIEW',
        'VERIFIED',
        'SOURCE_UNAVAILABLE',
        'MANUAL_REVIEW_REQUIRED',
        'NOT_CHECKED',
        'BLOCKED_LOW_CONFIDENCE',
        'VERIFICATION_PENDING'
      ],
      default: 'PENDING'
    },
    extractedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    extractedText: {
      type: String,
      select: false, // Omit raw text from standard list responses
      default: null
    },
    expiryDate: {
      type: Date,
      default: null
    },
    isExpired: {
      type: Boolean,
      default: false
    },
    latestCheckRunId: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.extractedText; // Never expose sensitive full text in DTOs
        delete ret.__v;
        return ret;
      }
    }
  }
);

documentSchema.index({ application: 1, documentType: 1 });

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;

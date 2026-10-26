const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    claimId: {
      type: String,
      required: [true, 'Claim ID is required'],
      unique: true,
      trim: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application ID is required']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      default: 'institution',
      trim: true
    },
    predicate: {
      type: String,
      required: [true, 'Predicate is required'],
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    unit: {
      type: String,
      default: null,
      trim: true
    },
    rawText: {
      type: String,
      default: null
    },
    origin: {
      type: String,
      enum: ['DOCUMENT', 'RECORD'],
      required: true
    },
    source: {
      docId: { type: String, default: null },
      page: { type: Number, default: 1 },
      bbox: { type: [Number], default: [0, 0, 1, 1] },
      snippet: { type: String, default: '' },
      docType: { type: String, default: null }
    },
    recordRef: {
      recordType: { type: String, default: null },
      sourceLabel: { type: String, default: null },
      kind: { type: String, enum: ['SYNTHETIC_DEMO', 'LIVE', null], default: null },
      fetchedAt: { type: String, default: null }
    },
    method: {
      type: String,
      enum: ['TEXT_LAYER', 'OCR', 'MANUAL', 'RECORD'],
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    status: {
      type: String,
      enum: ['EXTRACTED', 'NEEDS_CONFIRMATION', 'CONFIRMED', 'CORRECTED'],
      default: 'EXTRACTED'
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    correctionReason: {
      type: String,
      default: null
    },
    version: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

claimSchema.index({ applicationId: 1, predicate: 1 });
claimSchema.index({ applicationId: 1, status: 1 });

const Claim = mongoose.model('Claim', claimSchema);

module.exports = Claim;

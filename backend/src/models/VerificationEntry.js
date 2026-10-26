const mongoose = require('mongoose');

const verificationEntrySchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application ID is required']
    },
    docId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null
    },
    checkType: {
      type: String,
      enum: ['ISSUER_LOOKUP', 'QR_DECODE', 'SIGNATURE_CHECK', 'RECORD_MATCH'],
      required: true
    },
    status: {
      type: String,
      enum: [
        'VERIFIED',
        'MISMATCH_DETECTED',
        'EXPIRED',
        'VERIFICATION_PENDING',
        'SOURCE_UNAVAILABLE',
        'MANUAL_REVIEW_REQUIRED',
        'NOT_CHECKED',
        'BLOCKED_LOW_CONFIDENCE'
      ],
      required: true
    },
    source: {
      label: { type: String, default: 'DEMO ADAPTER - simulated source' },
      kind: { type: String, enum: ['SYNTHETIC_DEMO', 'LIVE'], default: 'SYNTHETIC_DEMO' }
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: {
      type: Date,
      default: null
    },
    requestSummary: {
      type: String,
      default: ''
    },
    responseSummary: {
      type: String,
      default: ''
    },
    error: {
      type: String,
      default: null
    },
    manual: {
      state: {
        type: String,
        enum: ['NONE', 'PENDING', 'CONFIRMED', 'REJECTED'],
        default: 'NONE'
      },
      note: { type: String, default: null },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      at: { type: Date, default: null }
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

verificationEntrySchema.index({ applicationId: 1, checkType: 1 });
verificationEntrySchema.index({ docId: 1 });

const VerificationEntry = mongoose.model('VerificationEntry', verificationEntrySchema);

module.exports = VerificationEntry;

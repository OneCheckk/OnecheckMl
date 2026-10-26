const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    unit: { type: String, default: null },
    confidence: { type: Number, default: 1.0 },
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
    }
  },
  { _id: false }
);

const findingSchema = new mongoose.Schema(
  {
    findingId: {
      type: String,
      required: [true, 'Finding ID is required'],
      unique: true,
      trim: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application ID is required']
    },
    ruleId: {
      type: String,
      required: [true, 'Rule ID is required'],
      trim: true
    },
    ruleVersion: {
      type: String,
      default: '1',
      trim: true
    },
    rulepackVersion: {
      type: String,
      default: '2026.1-demo',
      trim: true
    },
    clauseRef: {
      type: String,
      default: 'HANDBOOK-REF-TBD',
      trim: true
    },
    placeholder: {
      type: Boolean,
      default: false
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
    severity: {
      type: String,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true
    },
    state: {
      type: String,
      enum: ['OPEN', 'ACCEPTED', 'DISMISSED', 'CLARIFICATION_REQUESTED', 'RESOLVED'],
      default: 'OPEN'
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Message is required']
    },
    claimIds: {
      type: [String],
      default: []
    },
    proof: {
      statement: { type: String, default: '' },
      evidence: { type: [evidenceSchema], default: [] },
      computation: {
        formula: { type: String, default: null },
        inputs: { type: mongoose.Schema.Types.Mixed, default: null },
        result: { type: mongoose.Schema.Types.Mixed, default: null }
      }
    },
    alertAt: {
      type: Date,
      default: null
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    decidedAt: {
      type: Date,
      default: null
    },
    decisionReason: {
      type: String,
      default: null
    },
    disposition: {
      state: {
        type: String,
        enum: ['OPEN', 'ACCEPTED', 'DISMISSED', 'CLARIFICATION_REQUESTED', 'RESOLVED'],
        default: 'OPEN'
      },
      dispositionedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      dispositionedAt: {
        type: Date,
        default: null
      },
      reason: {
        type: String,
        default: null
      }
    },
    claimsKey: {
      type: String,
      default: '',
      trim: true
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

findingSchema.index({ applicationId: 1, ruleId: 1 });
findingSchema.index({ applicationId: 1, severity: 1, state: 1 });

const Finding = mongoose.model('Finding', findingSchema);

module.exports = Finding;

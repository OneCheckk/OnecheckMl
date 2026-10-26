const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      required: [true, 'Application number is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    appNo: {
      type: String,
      trim: true,
      uppercase: true
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institution reference is required']
    },
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null
    },
    category: {
      type: String,
      required: [true, 'Application category is required'],
      trim: true
    },
    academicYear: {
      type: String,
      required: false,
      trim: true,
      default: '2026-2027'
    },
    status: {
      type: String,
      enum: {
        values: [
          'DRAFT',
          'SUBMITTED',
          'PROCESSING',
          'READY_FOR_REVIEW',
          'CLARIFICATION_REQUESTED',
          'DECIDED',
          'UNDER_SCRUTINY',
          'DEFICIENCY_RAISED',
          'VERIFIED',
          'APPROVED',
          'REJECTED'
        ],
        message: 'Invalid application status value'
      },
      default: 'DRAFT'
    },
    synthetic: {
      type: Boolean,
      default: false
    },
    submittedAt: {
      type: Date,
      default: null
    },
    decisionDate: {
      type: Date,
      default: null
    },
    approvalPeriod: {
      start: { type: String, default: null },
      end: { type: String, default: null }
    },
    checklistVersion: {
      type: String,
      default: '2026.1'
    },
    rulepackVersion: {
      type: String,
      default: '2026.1-demo'
    },
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    assignedOfficerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    summary: {
      band: { type: String, enum: ['GREEN', 'YELLOW', 'RED', null], default: null },
      maxSeverity: { type: String, enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', null], default: null },
      openFindings: { type: Number, default: 0 },
      needsConfirmation: { type: Number, default: 0 },
      pendingSources: { type: Number, default: 0 },
      sortKey: { type: String, default: '00-00-00000000' }
    },
    decision: {
      outcome: {
        type: String,
        enum: [
          'ACCEPT_SCRUTINY',
          'REQUEST_CLARIFICATION',
          'REFER_FOR_INSPECTION',
          'RECOMMEND_ADVERSE_ACTION',
          'RECOMMEND_APPROVAL',
          'RECOMMEND_REJECTION',
          'RECOMMEND_DEFICIENCY_LETTER',
          'APPROVE',
          'REJECT',
          null
        ],
        default: null
      },
      reason: { type: String, default: null },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      at: { type: Date, default: null },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },
    lastTrace: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    lastValidity: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    riskScore: {
      type: Number,
      min: [0, 'Risk score cannot be less than 0'],
      max: [100, 'Risk score cannot be greater than 100'],
      default: null
    },
    riskLevel: {
      type: String,
      enum: ['GREEN', 'YELLOW', 'RED', null],
      default: null
    },
    totalDocuments: {
      type: Number,
      default: 0,
      min: 0
    },
    flaggedDocuments: {
      type: Number,
      default: 0,
      min: 0
    },
    currentRunId: {
      type: String,
      default: null
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

// Compound and single query indexes
applicationSchema.index({ status: 1 });
applicationSchema.index({ riskLevel: 1 });
applicationSchema.index({ assignedOfficer: 1 });
applicationSchema.index({ institution: 1 });
applicationSchema.index({ createdAt: -1 });

// Helper to resolve application by either MongoDB _id or string applicationNumber
applicationSchema.statics.findByIdOrNumber = function (id) {
  if (!id) return this.findOne({ _id: null });
  const isObjectId = mongoose.isValidObjectId(id);
  const query = isObjectId
    ? { $or: [{ _id: id }, { applicationNumber: id }, { appNo: id }] }
    : { $or: [{ applicationNumber: id }, { appNo: id }] };
  return this.findOne(query);
};

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;

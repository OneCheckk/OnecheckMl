const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
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
    runId: {
      type: String,
      required: false,
      default: null,
      trim: true
    },
    type: {
      type: String,
      required: [true, 'Alert type is required'],
      trim: true,
      uppercase: true
    },
    severity: {
      type: String,
      enum: {
        values: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: 'Severity must be INFO, LOW, MEDIUM, HIGH, or CRITICAL'
      },
      required: [true, 'Alert severity is required']
    },
    title: {
      type: String,
      required: false,
      default: 'System Compliance Alert',
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Alert message is required'],
      trim: true
    },
    refType: {
      type: String,
      default: null
    },
    refId: {
      type: String,
      default: null
    },
    dueAt: {
      type: Date,
      default: null
    },
    raisedAt: {
      type: Date,
      default: Date.now
    },
    ackedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    ackedAt: {
      type: Date,
      default: null
    },
    audience: {
      type: [String],
      default: ['SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR']
    },
    sourceModel: {
      type: String,
      enum: ['Document', 'FacultyHash', 'InfraPhoto', 'Application', 'Finding', 'VerificationEntry', null],
      required: false,
      default: 'Application'
    },
    sourceId: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
      default: null
    },
    status: {
      type: String,
      enum: {
        values: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE'],
        message: 'Alert status must be OPEN, ACKNOWLEDGED, RESOLVED, or FALSE_POSITIVE'
      },
      default: 'OPEN'
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolutionReason: {
      type: String,
      default: null,
      trim: true
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

alertSchema.index({ application: 1, status: 1, severity: 1 });
alertSchema.index({ application: 1, type: 1, sourceModel: 1, sourceId: 1, status: 1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;

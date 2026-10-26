const mongoose = require('mongoose');

const checkStepSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNAVAILABLE'],
      default: 'PENDING'
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    retryCount: {
      type: Number,
      default: 0
    },
    errorCode: {
      type: String,
      default: null
    },
    errorSummary: {
      type: String,
      default: null
    },
    evidenceRefs: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const checkRunSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required']
    },
    runId: {
      type: String,
      required: [true, 'Run identifier is required'],
      unique: true,
      trim: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requesting user reference is required']
    },
    status: {
      type: String,
      enum: {
        values: ['QUEUED', 'RUNNING', 'PARTIAL', 'SUCCEEDED', 'FAILED'],
        message: 'Invalid CheckRun status'
      },
      default: 'QUEUED'
    },
    steps: {
      type: [checkStepSchema],
      default: []
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    retryCount: {
      type: Number,
      default: 0
    },
    errorSummary: {
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

checkRunSchema.index({ application: 1, createdAt: -1 });

const CheckRun = mongoose.model('CheckRun', checkRunSchema);

module.exports = CheckRun;

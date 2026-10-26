const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Job type is required'],
      trim: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ['QUEUED', 'RUNNING', 'DONE', 'FAILED'],
      default: 'QUEUED'
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    runAfter: {
      type: Date,
      default: Date.now
    },
    lockedAt: {
      type: Date,
      default: null
    },
    lastError: {
      type: String,
      default: null
    },
    idempotencyKey: {
      type: String,
      unique: true,
      required: true,
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

jobSchema.index({ status: 1, runAfter: 1 });
jobSchema.index({ lockedAt: 1 });

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;

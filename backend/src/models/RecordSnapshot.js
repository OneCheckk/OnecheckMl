const mongoose = require('mongoose');

const recordSnapshotSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application ID is required']
    },
    bundle: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    source: {
      label: { type: String, default: 'DEMO ADAPTER - simulated AICTE record' },
      kind: { type: String, enum: ['SYNTHETIC_DEMO', 'LIVE'], default: 'SYNTHETIC_DEMO' },
      fetchedAt: { type: Date, default: Date.now }
    },
    sha256: {
      type: String,
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

recordSnapshotSchema.index({ applicationId: 1, createdAt: -1 });

const RecordSnapshot = mongoose.model('RecordSnapshot', recordSnapshotSchema);

module.exports = RecordSnapshot;

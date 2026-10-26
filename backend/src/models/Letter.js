const mongoose = require('mongoose');

const letterSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required']
    },
    findingIds: {
      type: [String],
      default: []
    },
    body: {
      type: String,
      required: [true, 'Letter body text is required']
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT'],
      default: 'DRAFT'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sentAt: {
      type: Date,
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

letterSchema.index({ applicationId: 1, createdAt: -1 });

const Letter = mongoose.model('Letter', letterSchema);

module.exports = Letter;

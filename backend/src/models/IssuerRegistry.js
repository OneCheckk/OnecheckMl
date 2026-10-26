const mongoose = require('mongoose');

const issuerRegistrySchema = new mongoose.Schema(
  {
    docType: {
      type: String,
      required: [true, 'Document type is required'],
      trim: true,
      uppercase: true
    },
    referenceNo: {
      type: String,
      required: [true, 'Reference number is required'],
      trim: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    behavior: {
      type: String,
      enum: ['MATCH', 'MISMATCH', 'NOT_FOUND', 'TIMEOUT', 'PENDING'],
      default: 'MATCH'
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

issuerRegistrySchema.index({ docType: 1, referenceNo: 1 }, { unique: true });

const IssuerRegistry = mongoose.model('IssuerRegistry', issuerRegistrySchema);

module.exports = IssuerRegistry;

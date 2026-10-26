const mongoose = require('mongoose');

const facultyHashSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required']
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institution reference is required']
    },
    nameNormalized: {
      type: String,
      required: [true, 'Normalized faculty name is required'],
      lowercase: true,
      trim: true
    },
    identifierType: {
      type: String,
      enum: {
        values: ['AADHAAR', 'PAN'],
        message: 'Identifier type must be AADHAAR or PAN'
      },
      required: [true, 'Identifier type is required']
    },
    identifierHmac: {
      type: String,
      required: [true, 'Keyed HMAC identifier is required'],
      trim: true
    },
    keyVersion: {
      type: String,
      required: [true, 'HMAC key version is required'],
      default: 'v1'
    },
    isGhostFlagged: {
      type: Boolean,
      default: false
    },
    matchInstitution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null
    },
    matchApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null
    },
    matchConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    lastCheckedRunId: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // Redact internal HMAC in client DTOs to preserve maximum privacy
        delete ret.identifierHmac;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound index for cross-application collision lookups
facultyHashSchema.index({ identifierType: 1, identifierHmac: 1 });
facultyHashSchema.index({ application: 1 });

const FacultyHash = mongoose.model('FacultyHash', facultyHashSchema);

module.exports = FacultyHash;

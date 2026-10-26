const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null // Null indicates an automated system action
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      uppercase: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      trim: true
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null
    },
    requestId: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    outcome: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only immutable log
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

auditLogSchema.index({ application: 1, createdAt: -1 });
auditLogSchema.index({ actorUser: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;

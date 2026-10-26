const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema(
  {
    seq: {
      type: Number,
      required: true,
      unique: true
    },
    ts: {
      type: Date,
      default: Date.now,
      required: true
    },
    actor: {
      id: { type: String, required: true },
      role: { type: String, required: true }
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    entity: {
      type: { type: String, required: true },
      id: { type: String, required: true }
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    prevHash: {
      type: String,
      required: true
    },
    hash: {
      type: String,
      required: true
    }
  },
  {
    timestamps: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

auditEventSchema.index({ action: 1 });
auditEventSchema.index({ 'entity.type': 1, 'entity.id': 1 });

const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);

module.exports = AuditEvent;

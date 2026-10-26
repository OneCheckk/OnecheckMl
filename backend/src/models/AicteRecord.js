const mongoose = require('mongoose');

const aicteRecordSchema = new mongoose.Schema(
  {
    institutionId: {
      type: String,
      required: [true, 'Institution AICTE ID is required'],
      unique: true,
      trim: true
    },
    bundle: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'RecordBundle payload is required']
    },
    sourceLabel: {
      type: String,
      default: 'DEMO ADAPTER - simulated AICTE record'
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

const AicteRecord = mongoose.model('AicteRecord', aicteRecordSchema);

module.exports = AicteRecord;

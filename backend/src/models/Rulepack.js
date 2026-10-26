const mongoose = require('mongoose');

const rulepackSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: [true, 'Rulepack version is required'],
      unique: true,
      trim: true
    },
    yamlText: {
      type: String,
      required: [true, 'YAML content is required']
    },
    sha256: {
      type: String,
      required: true,
      trim: true
    },
    active: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    notes: {
      type: String,
      default: ''
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

rulepackSchema.index({ active: 1 });

const Rulepack = mongoose.model('Rulepack', rulepackSchema);

module.exports = Rulepack;

const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    docTypes: { type: [String], required: true },
    required: { type: Boolean, default: true },
    clauseRef: { type: String, default: 'HANDBOOK-REF-TBD' },
    placeholder: { type: Boolean, default: false }
  },
  { _id: false }
);

const checklistSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    version: {
      type: String,
      required: [true, 'Checklist version is required'],
      trim: true
    },
    active: {
      type: Boolean,
      default: true
    },
    items: {
      type: [checklistItemSchema],
      default: []
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

checklistSchema.index({ category: 1, version: 1 }, { unique: true });
checklistSchema.index({ category: 1, active: 1 });

const Checklist = mongoose.model('Checklist', checklistSchema);

module.exports = Checklist;

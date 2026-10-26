const mongoose = require('mongoose');

const deductionSchema = new mongoose.Schema(
  {
    ruleId: {
      type: String,
      required: true
    },
    pillar: {
      type: String,
      required: true
    },
    points: {
      type: Number,
      required: true
    },
    explanation: {
      type: String,
      required: true
    },
    handbookRef: {
      type: String,
      default: null
    },
    evidenceRef: {
      type: String,
      default: null
    }
  },
  { _id: false }
);

const riskScoreSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required']
    },
    runId: {
      type: String,
      required: [true, 'Run identifier is required'],
      trim: true
    },
    totalScore: {
      type: Number,
      required: [true, 'Total score is required'],
      min: 0,
      max: 100
    },
    riskLevel: {
      type: String,
      enum: ['GREEN', 'YELLOW', 'RED'],
      required: [true, 'Risk level band is required']
    },
    pillarScores: {
      documentCompleteness: { type: Number, min: 0, max: 100, default: 0 },
      anomalyFlags: { type: Number, min: 0, max: 100, default: 0 },
      sourceVerification: { type: Number, min: 0, max: 100, default: 0 },
      historicalCompliance: { type: Number, min: 0, max: 100, default: 0 },
      infrastructureEvidence: { type: Number, min: 0, max: 100, default: 0 }
    },
    deductions: {
      type: [deductionSchema],
      default: []
    },
    rulesVersion: {
      type: String,
      required: [true, 'Rules version is required'],
      default: 'v1.0'
    },
    evidenceRefs: {
      type: [
        {
          type: { type: String, required: true },
          refId: { type: String, required: true },
          summary: { type: String, default: '' }
        }
      ],
      default: []
    },
    calculatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable record
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

riskScoreSchema.index({ application: 1, runId: 1 }, { unique: true });
riskScoreSchema.index({ calculatedAt: -1 });

const RiskScore = mongoose.model('RiskScore', riskScoreSchema);

module.exports = RiskScore;

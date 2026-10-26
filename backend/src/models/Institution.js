const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Institution name is required'],
      trim: true,
      maxlength: 255
    },
    registrationId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true
    },
    aicteId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    address: {
      type: String,
      required: false,
      trim: true,
      default: 'Campus Address'
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    region: {
      type: String,
      default: 'NORTH',
      trim: true
    },
    latitude: {
      type: Number,
      required: false,
      min: [-90, 'Latitude must be >= -90'],
      max: [90, 'Latitude must be <= 90'],
      default: 28.628
    },
    longitude: {
      type: Number,
      required: false,
      min: [-180, 'Longitude must be >= -180'],
      max: [180, 'Longitude must be <= 180'],
      default: 77.3649
    },
    site: {
      lat: { type: Number, default: 28.628 },
      lng: { type: Number, default: 77.3649 },
      radiusM: { type: Number, default: 500 }
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user reference is required']
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

institutionSchema.index({ state: 1 });
institutionSchema.index({ createdBy: 1 });

const Institution = mongoose.model('Institution', institutionSchema);

module.exports = Institution;

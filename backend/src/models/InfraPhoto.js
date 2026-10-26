const mongoose = require('mongoose');

const infraPhotoSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required']
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document reference is required']
    },
    photoType: {
      type: String,
      required: [true, 'Photo type is required'],
      trim: true,
      uppercase: true
    },
    storageKey: {
      type: String,
      required: [true, 'Storage key reference is required'],
      trim: true
    },
    gpsLatitude: {
      type: Number,
      default: null,
      min: -90,
      max: 90
    },
    gpsLongitude: {
      type: Number,
      default: null,
      min: -180,
      max: 180
    },
    distanceFromCampus: {
      type: Number,
      default: null, // Distance in meters
      min: 0
    },
    geofenceStatus: {
      type: String,
      enum: {
        values: ['PASS', 'FAIL', 'NO_GPS_DATA'],
        message: 'Geofence status must be PASS, FAIL, or NO_GPS_DATA'
      },
      default: 'NO_GPS_DATA'
    },
    imageHash: {
      type: String,
      default: null,
      trim: true
    },
    isStockImage: {
      type: Boolean,
      default: false
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
        delete ret.__v;
        return ret;
      }
    }
  }
);

infraPhotoSchema.index({ application: 1 });
infraPhotoSchema.index({ imageHash: 1 }, { sparse: true });

const InfraPhoto = mongoose.model('InfraPhoto', infraPhotoSchema);

module.exports = InfraPhoto;

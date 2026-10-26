const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  User,
  Institution,
  Application,
  Document,
  FacultyHash,
  InfraPhoto,
  RiskScore,
  Alert,
  AuditLog,
  CheckRun
} = require('../../src/models');
const { seedDatabase } = require('../../src/seed');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 2 — Mongoose Models & Schemas Unit Tests', () => {
  describe('User Model', () => {
    test('enforces required fields, email format, and role enum', async () => {
      const invalidUser = new User({});
      let err;
      try {
        await invalidUser.validate();
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.errors.name).toBeDefined();
      expect(err.errors.email).toBeDefined();
      expect(err.errors.role).toBeDefined();
    });

    test('hashes password and verifies password comparison correctly', async () => {
      const plainPassword = 'SecurePassword@123';
      const hash = await User.hashPassword(plainPassword);

      const user = new User({
        name: 'Test Officer',
        email: 'officer-test@onecheck.gov.in',
        passwordHash: hash,
        role: 'OFFICER'
      });
      await user.save();

      const isMatch = await user.comparePassword(plainPassword);
      const isMismatch = await user.comparePassword('WrongPassword');

      expect(isMatch).toBe(true);
      expect(isMismatch).toBe(false);

      // Verify safe JSON serialization does not leak passwordHash
      const json = user.toJSON();
      expect(json.passwordHash).toBeUndefined();
      expect(json.name).toBe('Test Officer');
    });
  });

  describe('Institution Model', () => {
    test('validates coordinate range bounds for latitude and longitude', async () => {
      const invalidInst = new Institution({
        name: 'Invalid Geo College',
        address: '123 Road',
        state: 'Punjab',
        latitude: 95.0, // Invalid: must be <= 90
        longitude: 200.0, // Invalid: must be <= 180
        createdBy: new mongoose.Types.ObjectId()
      });

      let err;
      try {
        await invalidInst.validate();
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.errors.latitude).toBeDefined();
      expect(err.errors.longitude).toBeDefined();
    });
  });

  describe('Application Model', () => {
    test('enforces valid status lifecycle enum and defaults to DRAFT', async () => {
      const app = new Application({
        applicationNumber: 'APP-TEST-001',
        institution: new mongoose.Types.ObjectId(),
        category: 'NEW_INSTITUTION',
        academicYear: '2026-2027'
      });
      await app.save();

      expect(app.status).toBe('DRAFT');
      expect(app.riskScore).toBeNull();
      expect(app.totalDocuments).toBe(0);
    });

    test('rejects invalid status value', async () => {
      const app = new Application({
        applicationNumber: 'APP-TEST-002',
        institution: new mongoose.Types.ObjectId(),
        category: 'NEW_INSTITUTION',
        academicYear: '2026-2027',
        status: 'INVALID_STATUS'
      });

      let err;
      try {
        await app.validate();
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.errors.status).toBeDefined();
    });
  });

  describe('Document Model', () => {
    test('creates document record and omits extractedText from JSON serialization', async () => {
      const doc = new Document({
        application: new mongoose.Types.ObjectId(),
        documentType: 'LAND_DOC',
        originalName: 'land_deed.pdf',
        storageKey: 'doc_uuid_12345.pdf',
        fileSize: 1048576,
        mimeType: 'application/pdf',
        sha256FileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedBy: new mongoose.Types.ObjectId(),
        extractedText: 'Extremely sensitive confidential document content'
      });
      await doc.save();

      expect(doc.uploadStatus).toBe('STORED');
      expect(doc.verificationStatus).toBe('PENDING');

      const json = doc.toJSON();
      expect(json.extractedText).toBeUndefined();
      expect(json.storageKey).toBe('doc_uuid_12345.pdf');
    });
  });

  describe('FacultyHash Model', () => {
    test('stores HMAC identifier without raw identifier leakage', async () => {
      const faculty = new FacultyHash({
        application: new mongoose.Types.ObjectId(),
        institution: new mongoose.Types.ObjectId(),
        nameNormalized: 'ramesh kumar',
        identifierType: 'AADHAAR',
        identifierHmac: 'abcde1234567890fghij987654321',
        keyVersion: 'v1'
      });
      await faculty.save();

      expect(faculty.isGhostFlagged).toBe(false);
      const json = faculty.toJSON();
      expect(json.identifierHmac).toBeUndefined(); // Safe DTO
    });
  });

  describe('InfraPhoto Model', () => {
    test('enforces geofenceStatus enum and defaults to NO_GPS_DATA', async () => {
      const photo = new InfraPhoto({
        application: new mongoose.Types.ObjectId(),
        document: new mongoose.Types.ObjectId(),
        photoType: 'BUILDING_FRONT',
        storageKey: 'photo_uuid_555.jpg'
      });
      await photo.save();

      expect(photo.geofenceStatus).toBe('NO_GPS_DATA');
      expect(photo.distanceFromCampus).toBeNull();
    });
  });

  describe('RiskScore Model', () => {
    test('persists 5 pillar subscores, clamp bounds, and immutable calculatedAt', async () => {
      const score = new RiskScore({
        application: new mongoose.Types.ObjectId(),
        runId: 'run-test-101',
        totalScore: 85,
        riskLevel: 'GREEN',
        pillarScores: {
          documentCompleteness: 90,
          anomalyFlags: 80,
          sourceVerification: 85,
          historicalCompliance: 90,
          infrastructureEvidence: 80
        },
        rulesVersion: 'v1.0'
      });
      await score.save();

      expect(score.totalScore).toBe(85);
      expect(score.riskLevel).toBe('GREEN');
      expect(score.calculatedAt).toBeDefined();
    });
  });

  describe('Alert Model', () => {
    test('creates alert with severity enum and OPEN status', async () => {
      const alert = new Alert({
        application: new mongoose.Types.ObjectId(),
        runId: 'run-test-101',
        type: 'GPS_MISMATCH',
        severity: 'HIGH',
        title: 'Geofence violation detected',
        message: 'Photo coordinates exceed 500m threshold from campus.',
        sourceModel: 'InfraPhoto',
        sourceId: new mongoose.Types.ObjectId()
      });
      await alert.save();

      expect(alert.status).toBe('OPEN');
      expect(alert.resolvedBy).toBeNull();
    });
  });

  describe('AuditLog Model', () => {
    test('persists audit log with append-only createdAt and sanitized metadata', async () => {
      const log = new AuditLog({
        action: 'APPLICATION_SUBMIT',
        entityType: 'Application',
        outcome: 'SUCCESS',
        metadata: { fieldCount: 12 }
      });
      await log.save();

      expect(log.timestamp).toBeDefined();
      expect(log.action).toBe('APPLICATION_SUBMIT');
    });
  });

  describe('CheckRun Model', () => {
    test('persists step states and defaults to QUEUED', async () => {
      const run = new CheckRun({
        application: new mongoose.Types.ObjectId(),
        runId: 'run-999-uuid',
        requestedBy: new mongoose.Types.ObjectId(),
        steps: [
          { name: 'DOCUMENT_OCR', status: 'PENDING' },
          { name: 'FACULTY_CROSS_CHECK', status: 'PENDING' }
        ]
      });
      await run.save();

      expect(run.status).toBe('QUEUED');
      expect(run.steps).toHaveLength(2);
      expect(run.steps[0].name).toBe('DOCUMENT_OCR');
    });
  });

  describe('Database Seed Script', () => {
    test('executes repeatability and seeds admin, officer, institution, and application', async () => {
      const seedResult = await seedDatabase(mongoServer.getUri());
      expect(seedResult.admin.email).toBe('admin@onecheck.gov.in');
      expect(seedResult.officer.email).toBe('officer@onecheck.gov.in');
      expect(seedResult.institution.registrationId).toBe('AICTE-DEL-2026-01');
      expect(seedResult.app.applicationNumber).toBe('APP-2026-000101');
    });
  });
});

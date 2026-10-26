const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const app = require('../../src/app');
const { User, Institution, Application, Document } = require('../../src/models');
const { getPrivateFilePath } = require('../../src/services/storage.service');

let mongoServer;
let adminToken;
let instUserToken1;
let instUserToken2;
let appId1;
let appId2;
let docId1;

// Sample valid file buffers
const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const spoofedPdfBuffer = Buffer.from('NOT A REAL PDF AT ALL JUST MALICIOUS CODE');

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Setup Admin
  const adminPassword = await User.hashPassword('Admin@123456');
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin-doc@onecheck.gov.in',
    passwordHash: adminPassword,
    role: 'ADMIN',
    isActive: true
  });

  // Setup Institution User 1
  const instPassword = await User.hashPassword('Inst@123456');
  const instUser1 = await User.create({
    name: 'Director 1',
    email: 'director1-doc@college.edu',
    passwordHash: instPassword,
    role: 'INSTITUTION_USER',
    isActive: true
  });

  const institution1 = await Institution.create({
    name: 'Tech College 1',
    registrationId: 'TC1-2026',
    address: 'Campus 1',
    state: 'Delhi',
    latitude: 28.6,
    longitude: 77.2,
    createdBy: instUser1._id
  });
  instUser1.institution = institution1._id;
  await instUser1.save();

  // Setup Institution User 2
  const instUser2 = await User.create({
    name: 'Director 2',
    email: 'director2-doc@college.edu',
    passwordHash: instPassword,
    role: 'INSTITUTION_USER',
    isActive: true
  });

  const institution2 = await Institution.create({
    name: 'Tech College 2',
    registrationId: 'TC2-2026',
    address: 'Campus 2',
    state: 'Maharashtra',
    latitude: 19.0,
    longitude: 72.8,
    createdBy: instUser2._id
  });
  instUser2.institution = institution2._id;
  await instUser2.save();

  // Applications
  const app1 = await Application.create({
    applicationNumber: 'APP-2026-900001',
    institution: institution1._id,
    category: 'NEW_INSTITUTION',
    academicYear: '2026-2027',
    status: 'DRAFT'
  });
  appId1 = app1._id;

  const app2 = await Application.create({
    applicationNumber: 'APP-2026-900002',
    institution: institution2._id,
    category: 'NEW_INSTITUTION',
    academicYear: '2026-2027',
    status: 'DRAFT'
  });
  appId2 = app2._id;

  // Logins
  const resAdmin = await request(app).post('/api/auth/login').send({
    email: 'admin-doc@onecheck.gov.in',
    password: 'Admin@123456'
  });
  adminToken = resAdmin.body.data.token;

  const resInst1 = await request(app).post('/api/auth/login').send({
    email: 'director1-doc@college.edu',
    password: 'Inst@123456'
  });
  instUserToken1 = resInst1.body.data.token;

  const resInst2 = await request(app).post('/api/auth/login').send({
    email: 'director2-doc@college.edu',
    password: 'Inst@123456'
  });
  instUserToken2 = resInst2.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 4 — Secure Document Upload & Handling Tests', () => {
  describe('POST /api/documents/:appId/upload', () => {
    test('successfully uploads valid PDF, validates magic bytes, and generates SHA-256', async () => {
      const res = await request(app)
        .post(`/api/documents/${appId1}/upload`)
        .set('Authorization', `Bearer ${instUserToken1}`)
        .field('documentType', 'LAND_DOC')
        .attach('file', validPdfBuffer, { filename: 'official_land_deed.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toHaveLength(1);

      const doc = res.body.data.documents[0];
      expect(doc.documentType).toBe('LAND_DOC');
      expect(doc.originalName).toBe('official_land_deed.pdf');
      expect(doc.storageKey).toMatch(/^doc_[a-f0-9-]+\.pdf$/);
      expect(doc.sha256FileHash).toBeDefined();
      expect(doc.uploadStatus).toBe('STORED');
      docId1 = doc._id;

      // Verify file exists in private storage
      const filePath = getPrivateFilePath(doc.storageKey);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('successfully uploads valid JPEG photo for INFRA_PHOTO', async () => {
      const res = await request(app)
        .post(`/api/documents/${appId1}/upload`)
        .set('Authorization', `Bearer ${instUserToken1}`)
        .field('documentType', 'INFRA_PHOTO')
        .field('photoType', 'BUILDING_FRONT')
        .attach('file', validJpegBuffer, { filename: 'campus_front.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.data.documents[0].documentType).toBe('INFRA_PHOTO');
    });

    test('rejects spoofed file where extension is .pdf but content is not PDF', async () => {
      const res = await request(app)
        .post(`/api/documents/${appId1}/upload`)
        .set('Authorization', `Bearer ${instUserToken1}`)
        .field('documentType', 'FACULTY_LIST')
        .attach('file', spoofedPdfBuffer, { filename: 'spoofed_virus.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(res.body.error.message).toContain('File signature does not match declared MIME type');
    });

    test('sanitizes filename with directory traversal attempts', async () => {
      const res = await request(app)
        .post(`/api/documents/${appId1}/upload`)
        .set('Authorization', `Bearer ${instUserToken1}`)
        .field('documentType', 'BUILDING_PLAN')
        .attach('file', validPdfBuffer, { filename: '../../../../etc/passwd.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      const doc = res.body.data.documents[0];
      expect(doc.originalName).toBe('passwd.pdf'); // Directory traversal stripped
      expect(doc.storageKey).toMatch(/^doc_[a-f0-9-]+\.pdf$/);
    });

    test('blocks institution user from uploading to another institution\'s application', async () => {
      const res = await request(app)
        .post(`/api/documents/${appId2}/upload`) // App 2 belongs to College 2
        .set('Authorization', `Bearer ${instUserToken1}`) // User 1 trying to upload
        .field('documentType', 'LAND_DOC')
        .attach('file', validPdfBuffer, { filename: 'intruder_doc.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/documents/:docId metadata', () => {
    test('returns safe metadata without exposing private storage path or extracted text', async () => {
      const res = await request(app)
        .get(`/api/documents/${docId1}`)
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.document.originalName).toBe('official_land_deed.pdf');
      expect(res.body.data.document.extractedText).toBeUndefined();
      expect(res.body.data.document.filePath).toBeUndefined(); // Never expose physical disk path
    });

    test('denies access to unauthorized user from another institution', async () => {
      const res = await request(app)
        .get(`/api/documents/${docId1}`)
        .set('Authorization', `Bearer ${instUserToken2}`); // User 2 accessing doc of College 1

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/documents/:docId/download streaming', () => {
    test('streams private file with safe headers and nosniff to authorized user', async () => {
      const res = await request(app)
        .get(`/api/documents/${docId1}/download`)
        .set('Authorization', `Bearer ${instUserToken1}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-disposition']).toContain('attachment; filename="official_land_deed.pdf"');
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('denies download to unauthorized outsider', async () => {
      const res = await request(app)
        .get(`/api/documents/${docId1}/download`)
        .set('Authorization', `Bearer ${instUserToken2}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('allows Admin to download any institution document', async () => {
      const res = await request(app)
        .get(`/api/documents/${docId1}/download`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});

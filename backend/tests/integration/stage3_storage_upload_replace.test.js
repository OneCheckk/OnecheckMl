const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Document, Job, AuditLog } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');

let mongoServer;
let instUserToken;
let otherInstToken;
let officerToken;
let institutionId;
let applicationId;

const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Regulatory Certificate) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
const spoofedPdf = Buffer.from('NOT A REAL PDF FILE CONTENT AT ALL');

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const seeded = await seedDatabase(uri);
  institutionId = seeded.institution._id;

  // Login as primary institution user
  const res1 = await request(app).post('/api/auth/login').send({
    email: 'director@apex-tech.edu.in',
    password: 'Institution@123456'
  });
  instUserToken = res1.body.data.token;

  // Create another institution and user to test cross-institution isolation
  const otherInst = await Institution.create({
    name: 'Outsider Institute (Synthetic)',
    aicteId: 'AICTE-OUTSIDER-99',
    registrationId: 'AICTE-OUTSIDER-99',
    state: 'Delhi',
    createdBy: seeded.admin._id
  });

  const otherUser = await User.create({
    name: 'Outsider Director',
    email: 'director.other@outsider.edu.in',
    passwordHash: await User.hashPassword('Password@123456'),
    role: 'INSTITUTION_USER',
    institution: otherInst._id,
    institutionId: otherInst._id
  });

  const res2 = await request(app).post('/api/auth/login').send({
    email: 'director.other@outsider.edu.in',
    password: 'Password@123456'
  });
  otherInstToken = res2.body.data.token;

  // Officer login
  const res3 = await request(app).post('/api/auth/login').send({
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456'
  });
  officerToken = res3.body.data.token;

  // Create DRAFT application for primary institution
  const appRes = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${instUserToken}`)
    .send({ category: 'EOA_INTAKE_INCREASE', academicYear: '2026-2027' });

  applicationId = appRes.body.data.application._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Stage 3 — Safe Storage, Specification Upload, Versions & Inline File Streaming', () => {
  let uploadedDocId;

  test('POST /api/applications/:id/documents uploads valid PDF and creates ANALYZE_DOC job', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'FIRE_NOC')
      .attach('file', validPdf, { filename: 'fire_noc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.docType).toBe('FIRE_NOC');
    expect(res.body.data.storagePath).toMatch(/^originals\//);
    expect(res.body.data.analysis.status).toBe('QUEUED');
    uploadedDocId = res.body.data._id;

    // Verify background job was queued
    const job = await Job.findOne({ 'payload.docId': uploadedDocId.toString() });
    expect(job).not.toBeNull();
    expect(job.type).toBe('ANALYZE_DOC');
    expect(job.idempotencyKey).toContain(uploadedDocId.toString());
  });

  test('POST /api/applications/:id/documents rejects spoofed non-PDF files', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'BUILDING_PLAN')
      .attach('file', spoofedPdf, { filename: 'spoofed.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('POST /api/applications/:id/documents detects duplicate upload of identical SHA-256', async () => {
    const res = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'FIRE_NOC')
      .attach('file', validPdf, { filename: 'duplicate_fire_noc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.notice).toContain('already uploaded');
    expect(res.body.data._id).toBe(uploadedDocId);
  });

  test('POST /api/documents/:docId/replace creates version 2 and marks old version SUPERSEDED', async () => {
    const replacementPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Revised Fire Safety NOC v2) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

    const res = await request(app)
      .post(`/api/documents/${uploadedDocId}/replace`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'FIRE_NOC')
      .attach('file', replacementPdf, { filename: 'fire_noc_v2.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.supersedesDocId).toBe(uploadedDocId);

    // Verify old document is marked SUPERSEDED
    const oldDoc = await Document.findById(uploadedDocId);
    expect(oldDoc.uploadStatus).toBe('SUPERSEDED');
  });

  test('GET /api/documents/:docId/file streams file inline with nosniff and logs DOC_ACCESSED', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocId}/file`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('inline');
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    // Verify DOC_ACCESSED audit event was logged
    const audit = await AuditLog.findOne({ action: 'DOC_ACCESSED', entityId: uploadedDocId.toString() });
    expect(audit).not.toBeNull();
  });

  test('GET /api/documents/:docId/file denies access to unauthorized outsider institution', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocId}/file`)
      .set('Authorization', `Bearer ${otherInstToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { User, Institution, Application, Document, VerificationEntry, Job } = require('../../src/models');
const { seedDatabase } = require('../../src/seed');
const { processNextJob } = require('../../src/services/jobRunner.service');

let mongoServer;
let instUserToken;
let otherInstToken;
let officerToken;
let institutionId;
let applicationId;

const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Fire Safety NOC) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

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

  // Outsider user
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

  // Create DRAFT application
  const appRes = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${instUserToken}`)
    .send({ category: 'EOA_CONTINUATION', academicYear: '2026-2027' });

  applicationId = appRes.body.data.application._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Stage 7 — Adapters, Verification Ledger, VERIFY_SOURCES & Manual Confirmation', () => {
  let docId;
  let qrEntryId;

  test('Step 1: Upload document and trigger source verification', async () => {
    // 1. Upload Fire NOC
    const upRes = await request(app)
      .post(`/api/applications/${applicationId}/documents`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .field('docTypeHint', 'FIRE_NOC')
      .attach('file', validPdf, { filename: 'fire_noc.pdf', contentType: 'application/pdf' });

    expect(upRes.status).toBe(201);
    docId = upRes.body.data._id;

    // Process analysis
    await processNextJob();

    // 2. Trigger source verification
    const verifyRes = await request(app)
      .post(`/api/documents/${docId}/verify`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.issuerEntry).toBeDefined();
    expect(verifyRes.body.data.issuerEntry.source.label).toContain('DEMO ADAPTER');

    // QR entry should be created as MANUAL_REVIEW_REQUIRED (safeguard)
    expect(verifyRes.body.data.qrEntry.status).toBe('MANUAL_REVIEW_REQUIRED');
    qrEntryId = verifyRes.body.data.qrEntry._id;
  });

  test('Step 2: GET /api/applications/:id/ledger returns ledger entries with scoping', async () => {
    // 1. Institution owner views ledger
    const res = await request(app)
      .get(`/api/applications/${applicationId}/ledger`)
      .set('Authorization', `Bearer ${instUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    // 2. Outsider institution is denied (403)
    const outsiderRes = await request(app)
      .get(`/api/applications/${applicationId}/ledger`)
      .set('Authorization', `Bearer ${otherInstToken}`);

    expect(outsiderRes.status).toBe(403);

    // 3. Officer can view ledger
    const officerRes = await request(app)
      .get(`/api/applications/${applicationId}/ledger`)
      .set('Authorization', `Bearer ${officerToken}`);

    expect(officerRes.status).toBe(200);
  });

  test('Step 3: Officer manual confirmation updates ledger entry and recomputes summary', async () => {
    // 1. Rejection if note is under 10 chars
    const shortNoteRes = await request(app)
      .post(`/api/ledger/${qrEntryId}/manual-confirm`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ note: 'Too short', confirmed: true });

    expect(shortNoteRes.status).toBe(400);

    // 2. Institution user is denied manual confirmation (403)
    const instDeny = await request(app)
      .post(`/api/ledger/${qrEntryId}/manual-confirm`)
      .set('Authorization', `Bearer ${instUserToken}`)
      .send({ note: 'Valid note from institution user', confirmed: true });

    expect(instDeny.status).toBe(403);

    // 3. Officer confirms entry
    const confirmRes = await request(app)
      .post(`/api/ledger/${qrEntryId}/manual-confirm`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        note: 'Physically inspected issuing authority signed register and verified trust chain.',
        confirmed: true
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.manual.state).toBe('CONFIRMED');
    expect(confirmRes.body.data.status).toBe('VERIFIED');

    // Verify in DB
    const updated = await VerificationEntry.findById(qrEntryId);
    expect(updated.status).toBe('VERIFIED');
    expect(updated.manual.state).toBe('CONFIRMED');
  });
});

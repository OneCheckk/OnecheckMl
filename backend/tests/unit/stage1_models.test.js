const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  Claim,
  Finding,
  RecordSnapshot,
  VerificationEntry,
  Job,
  Rulepack,
  Checklist,
  Letter,
  AicteRecord,
  IssuerRegistry,
  AuditEvent,
  Counter,
  Application,
  Institution,
  User
} = require('../../src/models');

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

describe('Stage 1 — Specification Mongoose Models Unit Tests', () => {
  let user;
  let institution;
  let app;

  beforeAll(async () => {
    user = await User.create({
      name: 'Test Officer',
      email: 'stage1.officer@onecheck.gov.in',
      passwordHash: 'hash',
      role: 'SCRUTINY_OFFICER'
    });

    institution = await Institution.create({
      name: 'Apex Institute of Technology (Synthetic)',
      aicteId: 'AICTE-STAGE1-01',
      registrationId: 'AICTE-STAGE1-01',
      state: 'Uttar Pradesh',
      site: { lat: 28.628, lng: 77.3649, radiusM: 500 },
      createdBy: user._id
    });

    app = await Application.create({
      applicationNumber: 'APP-2026-999999',
      appNo: 'APP-2026-999999',
      institution: institution._id,
      institutionId: institution._id,
      category: 'EOA_INTAKE_INCREASE',
      status: 'DRAFT',
      checklistVersion: '2026.1',
      rulepackVersion: '2026.1-demo'
    });
  });

  test('Claim Model: persists claim with predicate, confidence, and status', async () => {
    const claim = await Claim.create({
      claimId: 'C-001',
      applicationId: app._id,
      subject: 'institution',
      predicate: 'lab_area_sqm_total',
      value: 640,
      unit: 'sqm',
      origin: 'DOCUMENT',
      method: 'TEXT_LAYER',
      confidence: 0.98,
      status: 'EXTRACTED'
    });

    expect(claim.claimId).toBe('C-001');
    expect(claim.predicate).toBe('lab_area_sqm_total');
    expect(claim.confidence).toBe(0.98);
    expect(claim.version).toBe(1);
  });

  test('Finding Model: persists finding with proof, severity, and claimsKey', async () => {
    const finding = await Finding.create({
      findingId: 'F-001',
      applicationId: app._id,
      ruleId: 'AREA-CONSIST-001',
      ruleVersion: '1',
      rulepackVersion: '2026.1-demo',
      clauseRef: 'HANDBOOK-REF-TBD',
      placeholder: true,
      status: 'MISMATCH_DETECTED',
      severity: 'HIGH',
      state: 'OPEN',
      title: 'Laboratory area differs between form and building plan',
      message: 'Laboratory area is 640 sqm in form but 410 sqm in plan.',
      claimIds: ['C-001', 'C-002'],
      proof: {
        statement: 'Mismatch detected beyond 2% tolerance',
        evidence: [{ label: 'Form Area', value: 640, unit: 'sqm', confidence: 0.98 }],
        computation: { formula: '|form - plan| / plan * 100', inputs: { form: 640, plan: 410 }, result: 56.1 }
      },
      claimsKey: 'hash_claim_ids_values'
    });

    expect(finding.findingId).toBe('F-001');
    expect(finding.status).toBe('MISMATCH_DETECTED');
    expect(finding.severity).toBe('HIGH');
    expect(finding.proof.computation.result).toBe(56.1);
  });

  test('Job Model: creates job with idempotencyKey and default QUEUED status', async () => {
    const job = await Job.create({
      type: 'ANALYZE_DOC',
      payload: { docId: 'doc_123', sha256: 'abc123hash' },
      idempotencyKey: 'analyze:doc_123:abc123hash'
    });

    expect(job.status).toBe('QUEUED');
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(3);
  });

  test('Rulepack Model: stores YAML rulepack with sha256 checksum', async () => {
    const rulepack = await Rulepack.create({
      version: '2026.1-test',
      yamlText: 'rules:\n  - id: TEST-001\n',
      sha256: 'test_hash_rulepack',
      active: true,
      createdBy: user._id
    });

    expect(rulepack.version).toBe('2026.1-test');
    expect(rulepack.active).toBe(true);
  });

  test('Checklist Model: stores checklist items with required flag', async () => {
    const checklist = await Checklist.create({
      category: 'EOA_INTAKE_INCREASE',
      version: '2026.1-test',
      active: true,
      items: [
        { id: 'CHK-01', label: 'Fire Safety NOC', docTypes: ['FIRE_NOC'], required: true, clauseRef: 'REF-01', placeholder: false }
      ]
    });

    expect(checklist.items.length).toBe(1);
    expect(checklist.items[0].docTypes[0]).toBe('FIRE_NOC');
  });

  test('AuditEvent Model: stores monotonic sequence and hash for chain verification', async () => {
    const event = await AuditEvent.create({
      seq: 1,
      actor: { id: user._id.toString(), role: 'SCRUTINY_OFFICER' },
      action: 'LOGIN',
      entity: { type: 'User', id: user._id.toString() },
      payload: { email: user.email },
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: 'genesis_hash_test_123456789'
    });

    expect(event.seq).toBe(1);
    expect(event.action).toBe('LOGIN');
    expect(event.prevHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
  });

  test('Counter Model: tracks monotonic counter value', async () => {
    const counter = await Counter.create({
      name: 'audit_seq',
      value: 1
    });

    expect(counter.name).toBe('audit_seq');
    expect(counter.value).toBe(1);
  });
});

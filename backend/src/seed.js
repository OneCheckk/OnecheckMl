const mongoose = require('mongoose');
const crypto = require('crypto');
const { connectDB, disconnectDB } = require('./config/database');
const {
  User,
  Institution,
  Application,
  Rulepack,
  Checklist,
  AicteRecord,
  IssuerRegistry
} = require('./models');
const logger = require('./config/logger');

const DEFAULT_RULEPACK_YAML = `rulepack_id: onecheck-demo
version: 2026.1-demo
params:
  area_tolerance_pct: 2
  ocr_conf_min: 0.80
  expiry_warn_days: 90
  fsr_max_students_per_faculty: 20
placeholder_params: [fsr_max_students_per_faculty]
rules:
  - id: AREA-CONSIST-001
    title: Laboratory area differs between application form and building plan
    clause_ref: HANDBOOK-REF-TBD
    placeholder: true
    severity: HIGH
    applies_to: [EOA_CONTINUATION, EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [lab_area_sqm_total]
    inputs:
      form: { predicate: lab_area_sqm_total, doc_types: [SELF_DISCLOSURE_FORM] }
      plan: { predicate: lab_area_sqm_total, doc_types: [BUILDING_PLAN] }
    check: { op: approx_equal, a: form, b: plan, tolerance_pct: $area_tolerance_pct }
    on_fail: MISMATCH_DETECTED
    message: 'Laboratory area is {form.value} sqm in the form but {plan.value} sqm in the plan (difference {delta_pct}%).'

  - id: INTAKE-CONT-002
    title: Requested intake differs from the previous approved intake
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: HIGH
    applies_to: [EOA_CONTINUATION]
    reads: [intake_requested, intake_prev_approved]
    inputs:
      intake: { predicate: intake_requested, doc_types: [SELF_DISCLOSURE_FORM] }
      prev: { predicate: intake_prev_approved, origin: RECORD }
    check: { op: equal, a: intake, b: prev }
    on_fail: MISMATCH_DETECTED
    message: 'Requested intake {intake.value} does not match previous approved intake {prev.value}.'

  - id: INTAKE-GROWTH-003
    title: Requested intake is not above the previous approved intake
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: MEDIUM
    applies_to: [EOA_INTAKE_INCREASE]
    reads: [intake_requested, intake_prev_approved]
    inputs:
      intake: { predicate: intake_requested, doc_types: [SELF_DISCLOSURE_FORM] }
      prev: { predicate: intake_prev_approved, origin: RECORD }
    check: { op: gt, a: intake, b: prev }
    on_fail: MISMATCH_DETECTED
    message: 'Intake increase application requested {intake.value} which is not greater than previous approved intake {prev.value}.'

  - id: FSR-004
    title: Declared intake is not supported by the listed faculty
    clause_ref: HANDBOOK-REF-TBD
    placeholder: true
    severity: HIGH
    applies_to: [EOA_INTAKE_INCREASE]
    reads: [intake_requested, faculty_count_listed]
    inputs:
      intake: { predicate: intake_requested, doc_types: [SELF_DISCLOSURE_FORM] }
      faculty: { predicate: faculty_count_listed, doc_types: [FACULTY_LIST] }
    check: { op: expr, formula: 'intake / faculty <= $fsr_max_students_per_faculty' }
    on_fail: MISMATCH_DETECTED
    message: 'Requested intake {intake.value} over {faculty.value} listed faculty gives {computed} students per faculty; the configured maximum is {param.fsr_max_students_per_faculty}.'

  - id: FACULTY-COUNT-005
    title: Declared faculty count differs from the listed count
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: MEDIUM
    applies_to: [EOA_CONTINUATION, EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [faculty_count_declared, faculty_count_listed]
    inputs:
      declared: { predicate: faculty_count_declared, doc_types: [SELF_DISCLOSURE_FORM] }
      listed: { predicate: faculty_count_listed, doc_types: [FACULTY_LIST] }
    check: { op: equal, a: declared, b: listed }
    on_fail: MISMATCH_DETECTED
    message: 'Declared faculty count ({declared.value}) does not match listed faculty count ({listed.value}).'

  - id: TER-STATUS-006
    title: TER payment status mismatch between form and AICTE record
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: HIGH
    applies_to: [EOA_CONTINUATION, EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [ter_payment_status_claimed, ter_payment_status_record]
    inputs:
      claimed: { predicate: ter_payment_status_claimed, doc_types: [SELF_DISCLOSURE_FORM] }
      record: { predicate: ter_payment_status_record, origin: RECORD }
    check: { op: equal, a: claimed, b: record }
    on_fail: MISMATCH_DETECTED
    message: 'Application claims TER status {claimed.value} but AICTE regulatory record indicates {record.value}.'

  - id: DEFICIENCY-007
    title: Application claims deficiencies cleared but regulatory record shows open deficiencies
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: HIGH
    applies_to: [EOA_CONTINUATION, EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [deficiency_declared_cleared, deficiency_open_count_record]
    inputs:
      cleared: { predicate: deficiency_declared_cleared, doc_types: [SELF_DISCLOSURE_FORM] }
      openCount: { predicate: deficiency_open_count_record, origin: RECORD }
    check: { op: expr, formula: 'openCount == 0 || !cleared' }
    on_fail: MISMATCH_DETECTED
    message: 'Application declares all past deficiencies cleared, but official record lists {openCount.value} unresolved deficiency items.'

  - id: NOC-VALIDITY-008
    title: Fire NOC validity lapses before approval period ends
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: MEDIUM
    applies_to: [EOA_CONTINUATION, EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [noc_valid_until]
    inputs:
      validUntil: { predicate: noc_valid_until, doc_types: [FIRE_NOC] }
    check: { op: date_gte, a: validUntil, b: '$approvalPeriod.end' }
    on_fail: MANUAL_REVIEW_REQUIRED
    message: 'Fire Safety NOC expires on {validUntil.value}, which lapses before the conclusion of the academic approval period.'

  - id: ACCRED-VALIDITY-009
    title: Accreditation certificate lapses within approval period
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: MEDIUM
    applies_to: [EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [accreditation_valid_until]
    inputs:
      validUntil: { predicate: accreditation_valid_until, doc_types: [ACCREDITATION_CERT] }
    check: { op: date_gte, a: validUntil, b: '$approvalPeriod.end' }
    on_fail: MANUAL_REVIEW_REQUIRED
    message: 'NBA/NAAC Accreditation valid until {validUntil.value}, which lapses during the requested approval window.'

  - id: FACULTY-TIMELINE-010
    title: Faculty claimed experience exceeds career timeline
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: MEDIUM
    applies_to: [EOA_CONTINUATION, EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [faculty_degree_year, faculty_experience_years_claimed, faculty_as_of_year]
    foreach: subject
    inputs:
      degreeYear: { predicate: faculty_degree_year, doc_types: [FACULTY_CV] }
      expClaimed: { predicate: faculty_experience_years_claimed, doc_types: [FACULTY_CV] }
      asOfYear: { predicate: faculty_as_of_year, doc_types: [FACULTY_CV] }
    check: { op: expr, formula: 'expClaimed <= (asOfYear - degreeYear)' }
    on_fail: MISMATCH_DETECTED
    message: 'Faculty claimed {expClaimed.value} years of post-qualification experience, but earliest degree year is {degreeYear.value}.'

  - id: ID-CONSIST-011
    title: Institution identifier or name inconsistency across documents
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: HIGH
    applies_to: [EOA_CONTINUATION, EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [institution_id, institution_name]
    inputs:
      idClaims: { predicate: institution_id }
      nameClaims: { predicate: institution_name }
    check: { op: all_equal, a: idClaims }
    on_fail: MISMATCH_DETECTED
    message: 'Inconsistent permanent AICTE institution ID detected across submitted documents.'

  - id: NOC-DATES-012
    title: Irregular NOC issue and expiry date timeline
    clause_ref: HANDBOOK-REF-TBD
    placeholder: false
    severity: MEDIUM
    applies_to: [EOA_CONTINUATION, EOA_INTAKE_INCREASE, EOA_NEW_COURSE]
    reads: [noc_issue_date, noc_valid_until]
    inputs:
      issueDate: { predicate: noc_issue_date, doc_types: [FIRE_NOC] }
      validUntil: { predicate: noc_valid_until, doc_types: [FIRE_NOC] }
    check: { op: date_gte, a: validUntil, b: issueDate }
    on_fail: MANUAL_REVIEW_REQUIRED
    message: 'Fire Safety NOC issue date ({issueDate.value}) is recorded after expiration date ({validUntil.value}).'
`;

async function seedDatabase(uri) {
  try {
    await connectDB(uri);
    logger.info('Starting comprehensive database seeding...');

    // 1. Seed Users for every role
    const adminPassword = await User.hashPassword('Admin@123456');
    const officerPassword = await User.hashPassword('Officer@123456');
    const directorPassword = await User.hashPassword('Director@123456');
    const auditorPassword = await User.hashPassword('Auditor@123456');
    const institutionUserPassword = await User.hashPassword('Institution@123456');

    let admin = await User.findOne({ email: 'admin@onecheck.gov.in' });
    if (!admin) {
      admin = await User.create({
        name: 'System Administrator',
        email: 'admin@onecheck.gov.in',
        passwordHash: adminPassword,
        role: 'ADMIN',
        isActive: true
      });
      logger.info('Created seed ADMIN user');
    }

    let officer = await User.findOne({ email: 'officer@onecheck.gov.in' });
    if (!officer) {
      officer = await User.create({
        name: 'Senior Scrutiny Officer',
        email: 'officer@onecheck.gov.in',
        passwordHash: officerPassword,
        role: 'OFFICER',
        isActive: true
      });
      logger.info('Created seed OFFICER user');
    }

    let regionalDirector = await User.findOne({ email: 'director.regional@onecheck.gov.in' });
    if (!regionalDirector) {
      regionalDirector = await User.create({
        name: 'Northern Regional Director',
        email: 'director.regional@onecheck.gov.in',
        passwordHash: directorPassword,
        role: 'REGIONAL_DIRECTOR',
        isActive: true
      });
      logger.info('Created seed REGIONAL_DIRECTOR user');
    }

    let auditor = await User.findOne({ email: 'auditor@onecheck.gov.in' });
    if (!auditor) {
      auditor = await User.create({
        name: 'Regulatory Compliance Auditor',
        email: 'auditor@onecheck.gov.in',
        passwordHash: auditorPassword,
        role: 'AUDITOR',
        isActive: true
      });
      logger.info('Created seed AUDITOR user');
    }

    let institutionUser = await User.findOne({ email: 'director@apex-tech.edu.in' });
    if (!institutionUser) {
      institutionUser = await User.create({
        name: 'Dr. Ramesh Sharma',
        email: 'director@apex-tech.edu.in',
        passwordHash: institutionUserPassword,
        role: 'INSTITUTION_USER',
        isActive: true
      });
      logger.info('Created seed INSTITUTION_USER');
    }

    // 2. Seed 3 synthetic institutions with site locations
    let inst1 = await Institution.findOne({ registrationId: 'AICTE-DEL-2026-01' });
    if (!inst1) {
      inst1 = await Institution.create({
        name: 'Apex Institute of Technology (Synthetic)',
        registrationId: 'AICTE-DEL-2026-01',
        aicteId: 'AICTE-DEL-2026-01',
        address: 'Sector 62, Institutional Area, Noida',
        state: 'Uttar Pradesh',
        region: 'NORTH',
        latitude: 28.628,
        longitude: 77.3649,
        site: { lat: 28.628, lng: 77.3649, radiusM: 500 },
        verificationStatus: 'VERIFIED',
        createdBy: institutionUser._id
      });
      logger.info('Created seed Institution: Apex Institute of Technology');
    }

    let inst2 = await Institution.findOne({ registrationId: 'AICTE-MAH-2026-02' });
    if (!inst2) {
      inst2 = await Institution.create({
        name: 'Bharti Institute of Science & Research (Synthetic)',
        registrationId: 'AICTE-MAH-2026-02',
        aicteId: 'AICTE-MAH-2026-02',
        address: 'Shivaji Nagar, Pune',
        state: 'Maharashtra',
        region: 'WEST',
        latitude: 18.5204,
        longitude: 73.8567,
        site: { lat: 18.5204, lng: 73.8567, radiusM: 500 },
        verificationStatus: 'VERIFIED',
        createdBy: admin._id
      });
      logger.info('Created seed Institution: Bharti Institute of Science & Research');
    }

    let inst3 = await Institution.findOne({ registrationId: 'AICTE-KAR-2026-03' });
    if (!inst3) {
      inst3 = await Institution.create({
        name: 'Chanakya Engineering College (Synthetic)',
        registrationId: 'AICTE-KAR-2026-03',
        aicteId: 'AICTE-KAR-2026-03',
        address: 'Whitefield, Bengaluru',
        state: 'Karnataka',
        region: 'SOUTH',
        latitude: 12.9716,
        longitude: 77.5946,
        site: { lat: 12.9716, lng: 77.5946, radiusM: 500 },
        verificationStatus: 'VERIFIED',
        createdBy: admin._id
      });
      logger.info('Created seed Institution: Chanakya Engineering College');
    }

    // Link institution to user if not linked
    if (!institutionUser.institution) {
      institutionUser.institution = inst1._id;
      institutionUser.institutionId = inst1._id;
      await institutionUser.save();
    }

    // 3. Seed Rulepack
    let rulepack = await Rulepack.findOne({ version: '2026.1-demo' });
    if (!rulepack) {
      const sha256 = crypto.createHash('sha256').update(DEFAULT_RULEPACK_YAML).digest('hex');
      rulepack = await Rulepack.create({
        version: '2026.1-demo',
        yamlText: DEFAULT_RULEPACK_YAML,
        sha256,
        active: true,
        createdBy: admin._id,
        notes: 'Initial seeded demo rulepack matching 12 regulatory rules'
      });
      logger.info('Created active seed Rulepack: 2026.1-demo');
    }

    // 4. Seed Checklists for all 3 categories
    const commonChecklistItems = [
      { id: 'CHK-01', label: 'Self-Disclosure Application Form', docTypes: ['SELF_DISCLOSURE_FORM'], required: true, clauseRef: 'AICTE-APH-CH2-01', placeholder: false },
      { id: 'CHK-02', label: 'Fire Safety NOC', docTypes: ['FIRE_NOC'], required: true, clauseRef: 'AICTE-APH-CH2-04', placeholder: false },
      { id: 'CHK-03', label: 'Approved Building Plan & Area Statement', docTypes: ['BUILDING_PLAN'], required: true, clauseRef: 'AICTE-APH-CH2-05', placeholder: false },
      { id: 'CHK-04', label: 'Complete Faculty List with Cadre Ratios', docTypes: ['FACULTY_LIST'], required: true, clauseRef: 'AICTE-APH-CH2-07', placeholder: false },
      { id: 'CHK-05', label: 'TER Regulatory Processing Fee Receipt', docTypes: ['TER_PAYMENT_RECEIPT'], required: true, clauseRef: 'AICTE-APH-CH2-09', placeholder: false }
    ];

    const categories = ['EOA_CONTINUATION', 'EOA_INTAKE_INCREASE', 'EOA_NEW_COURSE', 'NEW_INSTITUTION', 'EXTENSION_OF_APPROVAL'];
    for (const cat of categories) {
      let chk = await Checklist.findOne({ category: cat, version: '2026.1' });
      if (!chk) {
        const items = [...commonChecklistItems];
        if (cat === 'EOA_INTAKE_INCREASE' || cat === 'EOA_NEW_COURSE') {
          items.push({
            id: 'CHK-06',
            label: 'NBA / NAAC Accreditation Certificate',
            docTypes: ['ACCREDITATION_CERT'],
            required: true,
            clauseRef: 'AICTE-APH-CH2-12',
            placeholder: false
          });
        }
        await Checklist.create({
          category: cat,
          version: '2026.1',
          active: true,
          items
        });
      }
    }
    logger.info('Created active seed Checklists');

    // 5. Seed AICTE Records (Ground Truth)
    let aicteRec1 = await AicteRecord.findOne({ institutionId: 'AICTE-DEL-2026-01' });
    if (!aicteRec1) {
      await AicteRecord.create({
        institutionId: 'AICTE-DEL-2026-01',
        sourceLabel: 'DEMO ADAPTER - simulated AICTE record',
        bundle: {
          institutionId: 'AICTE-DEL-2026-01',
          institutionName: 'Apex Institute of Technology (Synthetic)',
          prevEoa: {
            academicYear: '2025-2026',
            courses: [
              { name: 'Computer Science and Engineering', level: 'UG', approvedIntake: 120 }
            ]
          },
          ter: {
            status: 'PENDING' // Planted fault: record says pending!
          },
          deficiencies: [
            { id: 'DEF-01', text: 'Cadre ratio shortfall in Department of Mechanical Engineering', status: 'OPEN' } // Planted fault: open deficiency!
          ],
          faculty: [
            { key: 'dr-ramesh-sharma', name: 'Dr. Ramesh Sharma', designation: 'Professor & Director', idHmac: 'hmac_sharma_98765' }
          ],
          site: { lat: 28.628, lng: 77.3649, radiusM: 500 },
          history: [
            { year: '2025-2026', type: 'EOA_CONTINUATION', outcome: 'APPROVED' }
          ]
        }
      });
      logger.info('Created seed AicteRecord for Apex Institute');
    }

    // 6. Seed Issuer Registry (Fire NOC lookup)
    const registryEntries = [
      {
        docType: 'FIRE_NOC',
        referenceNo: 'NOC-UP-2024-9988',
        behavior: 'MATCH',
        data: {
          certificateNo: 'NOC-UP-2024-9988',
          issueDate: '2024-01-15',
          validUntil: '2027-01-14',
          authority: 'Chief Fire Officer Noida'
        }
      },
      {
        docType: 'FIRE_NOC',
        referenceNo: 'NOC-MAH-2024-1122',
        behavior: 'MISMATCH',
        data: {
          certificateNo: 'NOC-MAH-2024-1122',
          issueDate: '2023-01-15',
          validUntil: '2025-01-14',
          authority: 'Pune Municipal Fire Service'
        }
      },
      {
        docType: 'FIRE_NOC',
        referenceNo: 'NOC-KAR-2024-7744',
        behavior: 'TIMEOUT',
        data: {}
      }
    ];

    for (const entry of registryEntries) {
      let reg = await IssuerRegistry.findOne({ docType: entry.docType, referenceNo: entry.referenceNo });
      if (!reg) {
        await IssuerRegistry.create(entry);
      }
    }
    logger.info('Created seed IssuerRegistry entries (MATCH, MISMATCH, TIMEOUT)');

    // 7. Seed Primary Demo Application (Apex Institute)
    let app = await Application.findOne({ applicationNumber: 'APP-2026-000101' });
    if (!app) {
      app = await Application.create({
        applicationNumber: 'APP-2026-000101',
        appNo: 'APP-2026-000101',
        institution: inst1._id,
        institutionId: inst1._id,
        category: 'EOA_INTAKE_INCREASE',
        academicYear: '2026-2027',
        status: 'SUBMITTED',
        synthetic: true,
        submittedAt: new Date(),
        decisionDate: new Date('2026-06-30T00:00:00Z'),
        approvalPeriod: { start: '2026-07-01', end: '2027-06-30' },
        checklistVersion: '2026.1',
        rulepackVersion: '2026.1-demo',
        assignedOfficer: officer._id,
        assignedOfficerId: officer._id,
        summary: {
          band: 'RED',
          maxSeverity: 'HIGH',
          openFindings: 4,
          needsConfirmation: 0,
          pendingSources: 0,
          sortKey: '04-04-20260630'
        },
        riskScore: 82,
        riskLevel: 'GREEN',
        totalDocuments: 4,
        flaggedDocuments: 0
      });
      logger.info('Created seed Application: APP-2026-000101');
    }

    logger.info('Database seeding completed successfully.');
    return { admin, officer, regionalDirector, auditor, institutionUser, institution: inst1, app };
  } catch (error) {
    logger.error('Seeding failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedDatabase, DEFAULT_RULEPACK_YAML };

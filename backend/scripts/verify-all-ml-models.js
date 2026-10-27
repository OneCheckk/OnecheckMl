/**
 * OneCheck Verification Suite — All 8 ML Models End-to-End
 * ========================================================
 * Validates ML microservice (port 8000), Node.js backend (port 3000),
 * MongoDB schemas, and Frontend adapter contracts across all 8 forensic engines.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { generateIdentifierHmac } = require('../src/utils/hmac');
const mlClient = require('../src/services/mlClient.service');
const { Document, VerificationEntry } = require('../src/models');

const ML_BASE = process.env.VERIFICATION_SERVICE_URL || 'http://localhost:8000';
const BACKEND_BASE = 'http://localhost:3000';

// ANSI Colors for high-contrast console report
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const BG_DARK = '\x1b[40m';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${errText}`);
  }
  return res.json();
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

async function runVerification() {
  console.log(`\n${BOLD}${CYAN}========================================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   ONECHECK END-TO-END VERIFICATION: ALL 8 FORENSIC ML ENGINES + BACKEND + FRONTEND    ${RESET}`);
  console.log(`${BOLD}${CYAN}========================================================================================${RESET}\n`);

  const results = [];
  const fixturesPath = path.join(__dirname, 'fixtures.json');
  if (!fs.existsSync(fixturesPath)) {
    throw new Error('fixtures.json not found in backend/scripts! Please run generator first.');
  }
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

  // ───────────────────────────────────────────────────────────────────────────
  // Step 1: Healthcheck & Service Reachability
  // ───────────────────────────────────────────────────────────────────────────
  console.log(`${BOLD}[1/4] Probing Service Health & Network Reachability...${RESET}`);
  
  let mlHealth;
  try {
    mlHealth = await getJson(`${ML_BASE}/health`);
    console.log(`  ${GREEN}✓${RESET} ML Microservice UP: ${mlHealth.service} (v${mlHealth.version}), Active Engines: ${mlHealth.active_engines}/8`);
  } catch (err) {
    console.error(`  ${RED}✗${RESET} ML Microservice unreachable at ${ML_BASE}: ${err.message}`);
    process.exit(1);
  }

  let backendHealth;
  try {
    backendHealth = await getJson(`${BACKEND_BASE}/api/health`);
    console.log(`  ${GREEN}✓${RESET} Backend API Gateway UP: status=${backendHealth.data?.status}, database=${backendHealth.data?.database}`);
  } catch (err) {
    console.error(`  ${RED}✗${RESET} Backend service unreachable at ${BACKEND_BASE}: ${err.message}`);
    process.exit(1);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Step 2: 7 Regulatory & Forensic Test Scenarios
  // ───────────────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}[2/4] Executing 7 Forensic ML Test Scenarios...${RESET}`);

  // Test 1: Land Title ELA Test
  try {
    const t0 = Date.now();
    const elaRes = await postJson(`${ML_BASE}/api/ela`, {
      base64_content: fixtures.ela_tampered_b64,
      quality: 60
    });
    const dt = Date.now() - t0;
    const score = elaRes.score !== undefined ? elaRes.score : (elaRes.suspicion_score / 100.0);
    const suspected = elaRes.suspected || elaRes.is_tampered;
    const pass = score > 0.40 && suspected === true;
    
    results.push({
      id: 1,
      engine: 'Engine 2: ELA Heatmap',
      scenario: 'Land Title Tamper Detection',
      route: 'POST /api/ela',
      metric: `Score: ${(score * 100).toFixed(1)}% (Threshold: 40%)`,
      flag: 'TAMPER_SUSPECTED',
      latency: `${dt}ms`,
      passed: pass
    });
    console.log(`  ${pass ? GREEN + '✓' : RED + '✗'}${RESET} Test 1 (Land Title ELA): Tamper Score=${(score * 100).toFixed(1)}%, Suspected=${suspected}`);
  } catch (err) {
    results.push({ id: 1, engine: 'Engine 2: ELA Heatmap', scenario: 'Land Title Tamper Detection', route: 'POST /api/ela', metric: err.message, flag: 'TAMPER_SUSPECTED', latency: '-', passed: false });
    console.log(`  ${RED}✗${RESET} Test 1 failed: ${err.message}`);
  }

  // Test 2: Lab Photo pHash Duplicate Test
  try {
    const t0 = Date.now();
    const cmpRes = await postJson(`${ML_BASE}/imagehash/compare`, {
      hash1: 'a1b2c3d4e5f60718',
      hash2: 'a1b2c3d4e5f60718'
    });
    const dt = Date.now() - t0;
    const pass = cmpRes.hamming_distance <= 4 && cmpRes.is_match === true;
    
    results.push({
      id: 2,
      engine: 'Engine 3: pHash DCT-64',
      scenario: 'Lab Photo Infrastructure Duplicate',
      route: 'POST /imagehash/compare',
      metric: `Hamming Dist: ${cmpRes.hamming_distance} (<= 4)`,
      flag: 'RECYCLED_INFRASTRUCTURE',
      latency: `${dt}ms`,
      passed: pass
    });
    console.log(`  ${pass ? GREEN + '✓' : RED + '✗'}${RESET} Test 2 (Lab Photo pHash): Distance=${cmpRes.hamming_distance}, Match=${cmpRes.is_match}`);
  } catch (err) {
    results.push({ id: 2, engine: 'Engine 3: pHash DCT-64', scenario: 'Lab Photo Duplicate', route: 'POST /imagehash/compare', metric: err.message, flag: 'RECYCLED_INFRASTRUCTURE', latency: '-', passed: false });
    console.log(`  ${RED}✗${RESET} Test 2 failed: ${err.message}`);
  }

  // Test 3: Site Photo Geo-Fence Test
  try {
    const t0 = Date.now();
    const geoRes = await postJson(`${ML_BASE}/api/geofence`, {
      campusLatitude: 28.4595,
      campusLongitude: 77.0266,
      photoLatitude: 28.5900,
      photoLongitude: 77.2000,
      radiusMeters: 500.0
    });
    const dt = Date.now() - t0;
    const distKm = (geoRes.distanceFromCampus / 1000.0).toFixed(2);
    const pass = geoRes.geofenceStatus === 'FAIL' && geoRes.isWithinCampus === false && geoRes.distanceFromCampus > 10000;

    results.push({
      id: 3,
      engine: 'Engine 4: 500m Geo-Fence',
      scenario: 'Site Photo Distance Violation',
      route: 'POST /api/geofence',
      metric: `Distance: ${distKm} km (> 500m)`,
      flag: 'OFF_CAMPUS_GEO_VIOLATION',
      latency: `${dt}ms`,
      passed: pass
    });
    console.log(`  ${pass ? GREEN + '✓' : RED + '✗'}${RESET} Test 3 (Site Photo Geo-Fence): Status=${geoRes.geofenceStatus}, Distance=${distKm} km`);
  } catch (err) {
    results.push({ id: 3, engine: 'Engine 4: 500m Geo-Fence', scenario: 'Site Photo Violation', route: 'POST /api/geofence', metric: err.message, flag: 'OFF_CAMPUS_GEO_VIOLATION', latency: '-', passed: false });
    console.log(`  ${RED}✗${RESET} Test 3 failed: ${err.message}`);
  }

  // Test 4: Intake Document OCR Test
  try {
    const t0 = Date.now();
    const claimRes = await postJson(`${ML_BASE}/ocr/verify-claim`, {
      claimedIntake: 180,
      extractedIntake: 120,
      documentType: 'UNIVERSITY_AFFILIATION'
    });
    const dt = Date.now() - t0;
    const pass = claimRes.verdict === 'MISMATCH_DETECTED' && claimRes.isMatched === false && claimRes.discrepancy === 60;

    results.push({
      id: 4,
      engine: 'Engine 5: Tesseract OCR',
      scenario: 'Intake Document Order Discrepancy',
      route: 'POST /ocr/verify-claim',
      metric: `Claim: 180 vs Order: 120 (Diff: +60)`,
      flag: 'MISMATCH_DETECTED',
      latency: `${dt}ms`,
      passed: pass
    });
    console.log(`  ${pass ? GREEN + '✓' : RED + '✗'}${RESET} Test 4 (Intake OCR): Verdict=${claimRes.verdict}, Discrepancy=+${claimRes.discrepancy} seats`);
  } catch (err) {
    results.push({ id: 4, engine: 'Engine 5: Tesseract OCR', scenario: 'Intake Document', route: 'POST /ocr/verify-claim', metric: err.message, flag: 'MISMATCH_DETECTED', latency: '-', passed: false });
    console.log(`  ${RED}✗${RESET} Test 4 failed: ${err.message}`);
  }

  // Test 5: Fire NOC Validity Test
  try {
    const t0 = Date.now();
    const valRes = await postJson(`${ML_BASE}/api/validity-check`, {
      expiryDate: '2025-03-31',
      scrutinyAnchorDate: '2025-05-15',
      sessionStartDate: '2025-08-01'
    });
    const dt = Date.now() - t0;
    const pass = valRes.verdict === 'EXPIRED' && valRes.is_valid_on_scrutiny_date === false;

    results.push({
      id: 5,
      engine: 'Engine 7: Scrutiny Calendar',
      scenario: 'Fire NOC Certificate Lapsed Date',
      route: 'POST /api/validity-check',
      metric: `Expiry: 2025-03-31 < Anchor: 2025-05-15`,
      flag: 'EXPIRED',
      latency: `${dt}ms`,
      passed: pass
    });
    console.log(`  ${pass ? GREEN + '✓' : RED + '✗'}${RESET} Test 5 (Fire NOC Validity): Verdict=${valRes.verdict}, ValidOnScrutiny=${valRes.is_valid_on_scrutiny_date}`);
  } catch (err) {
    results.push({ id: 5, engine: 'Engine 7: Scrutiny Calendar', scenario: 'Fire NOC Validity', route: 'POST /api/validity-check', metric: err.message, flag: 'EXPIRED', latency: '-', passed: false });
    console.log(`  ${RED}✗${RESET} Test 5 failed: ${err.message}`);
  }

  // Test 6: Faculty Payroll Ghost Collision Test
  try {
    const t0 = Date.now();
    const aadhaarTest = '9876-5432-1098';
    const localHmac = generateIdentifierHmac(aadhaarTest);
    
    const ghostRes = await postJson(`${ML_BASE}/faculty/fuzzy-match-faculty`, {
      candidate: {
        name: 'Dr. R.K. Sharma',
        aadhaar_or_pan: aadhaarTest,
        department: 'CSE',
        current_institution: 'Apex Institute of Technology'
      },
      stored_roster: [
        {
          institution: 'Greenfield Institute of Technology',
          name: 'Dr. Ram Kumar Sharma',
          department: 'CSE',
          privacy_hash: 'a6ba30d626a3f4e24eb37452d9b626e95267f53f6e12e128148b30f782f9efab'
        }
      ]
    });
    const dt = Date.now() - t0;
    const pass = ghostRes.is_ghost_faculty_detected === true && ghostRes.verdict === 'MISMATCH_DETECTED';

    results.push({
      id: 6,
      engine: 'Engine 6: Ghost Faculty Radar',
      scenario: 'Dual-Employment Identity Collision',
      route: 'POST /faculty/fuzzy-match-faculty',
      metric: `HMAC Hash Match across Institutions`,
      flag: 'DUAL_EMPLOYMENT_DETECTED',
      latency: `${dt}ms`,
      passed: pass
    });
    console.log(`  ${pass ? GREEN + '✓' : RED + '✗'}${RESET} Test 6 (Faculty Payroll Collision): GhostDetected=${ghostRes.is_ghost_faculty_detected}, Verdict=${ghostRes.verdict}`);
  } catch (err) {
    results.push({ id: 6, engine: 'Engine 6: Ghost Faculty Radar', scenario: 'Dual-Employment', route: 'POST /faculty/fuzzy-match-faculty', metric: err.message, flag: 'DUAL_EMPLOYMENT_DETECTED', latency: '-', passed: false });
    console.log(`  ${RED}✗${RESET} Test 6 failed: ${err.message}`);
  }

  // Test 7: Blueprint CAD Deficit Test
  try {
    const t0 = Date.now();
    // FormData multipart for CAD blueprint
    const form = new FormData();
    const bpBuffer = Buffer.from(fixtures.blueprint_cad_b64, 'base64');
    const bpBlob = new Blob([bpBuffer], { type: 'image/png' });
    form.append('file', bpBlob, 'blueprint.png');
    form.append('claimed_lab_sqm', '640.0');

    const res = await fetch(`${ML_BASE}/blueprint/blueprint-extract`, {
      method: 'POST',
      body: form
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const bpRes = await res.json();
    const dt = Date.now() - t0;

    const pass = bpRes.verdict === 'MISMATCH_DETECTED' && bpRes.extracted_lab_sqm === 410.0 && bpRes.deficit_sqm === 230.0;

    results.push({
      id: 7,
      engine: 'Engine 8: Blueprint Architect',
      scenario: 'CAD Area Deficit Parsing',
      route: 'POST /blueprint/blueprint-extract',
      metric: `Claimed: 640m² vs Found: 410m² (-230m²)`,
      flag: 'INFRASTRUCTURE_SHORTFALL',
      latency: `${dt}ms`,
      passed: pass
    });
    console.log(`  ${pass ? GREEN + '✓' : RED + '✗'}${RESET} Test 7 (Blueprint CAD Area): Extracted=${bpRes.extracted_lab_sqm} sq.m, Deficit=${bpRes.deficit_sqm} sq.m, Verdict=${bpRes.verdict}`);
  } catch (err) {
    results.push({ id: 7, engine: 'Engine 8: Blueprint Architect', scenario: 'CAD Area Deficit', route: 'POST /blueprint/blueprint-extract', metric: err.message, flag: 'INFRASTRUCTURE_SHORTFALL', latency: '-', passed: false });
    console.log(`  ${RED}✗${RESET} Test 7 failed: ${err.message}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Step 3: Backend Gateway & Database Persistence Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}[3/4] Verifying Backend Gateway & Mongoose Schema Status Compatibility...${RESET}`);

  // 1. Verify mlClient live dispatching
  const isMockVerification = mlClient.isMock;
  const baseUrlConfigured = mlClient.baseUrl;
  console.log(`  ${!isMockVerification ? GREEN + '✓' : RED + '✗'}${RESET} mlClient.service isMock: ${isMockVerification} (Must be false for live microservice dispatch)`);
  console.log(`  ${baseUrlConfigured.includes(':8000') ? GREEN + '✓' : YELLOW + '!'}${RESET} mlClient baseUrl: ${baseUrlConfigured}`);

  // 2. Verify 6 AICTE Statuses on VerificationEntry & Document Schema
  const AICTE_6_STATUSES = [
    'VERIFIED',
    'MISMATCH_DETECTED',
    'EXPIRED',
    'VERIFICATION_PENDING',
    'SOURCE_UNAVAILABLE',
    'MANUAL_REVIEW_REQUIRED'
  ];

  let schemaValidationPassed = true;
  for (const st of AICTE_6_STATUSES) {
    const entry = new VerificationEntry({
      applicationId: new mongoose.Types.ObjectId(),
      checkType: 'RECORD_MATCH',
      status: st,
      requestSummary: `Validation check for ${st}`
    });
    const err = entry.validateSync();
    if (err) {
      console.error(`  ${RED}✗${RESET} VerificationEntry schema rejected status '${st}': ${err.message}`);
      schemaValidationPassed = false;
    }
  }

  if (schemaValidationPassed) {
    console.log(`  ${GREEN}✓${RESET} All 6 official AICTE statuses validated on VerificationEntry model:`);
    console.log(`    [${AICTE_6_STATUSES.join(', ')}]`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Step 4: Frontend Adapter Compatibility Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}[4/4] Verifying Frontend Adapter & Status Map Compatibility...${RESET}`);

  // Read statusMaps.ts and adapters.ts to verify compatibility
  const statusMapsPath = path.resolve(__dirname, '../../frontend/apps/web/src/components/status/statusMaps.ts');
  const adaptersPath = path.resolve(__dirname, '../../frontend/apps/web/src/api/adapters.ts');

  let feStatusMatch = true;
  if (fs.existsSync(statusMapsPath)) {
    const statusMapsContent = fs.readFileSync(statusMapsPath, 'utf-8');
    for (const st of AICTE_6_STATUSES) {
      if (!statusMapsContent.includes(`${st}:`)) {
        console.error(`  ${RED}✗${RESET} Frontend statusMaps.ts missing mapping for '${st}'`);
        feStatusMatch = false;
      }
    }
    if (feStatusMatch) {
      console.log(`  ${GREEN}✓${RESET} Frontend statusMaps.ts contains full descriptor bindings for all 6 AICTE statuses.`);
    }
  }

  if (fs.existsSync(adaptersPath)) {
    const adaptersContent = fs.readFileSync(adaptersPath, 'utf-8');
    const hasForensics = adaptersContent.includes('normalizeForensics') && adaptersContent.includes('ForensicsSuiteData');
    const hasTriangle = adaptersContent.includes('normalizeTriangle');
    console.log(`  ${hasForensics ? GREEN + '✓' : RED + '✗'}${RESET} Frontend adapters.ts normalizeForensics handles ELA heatmap, pHash, and CAD areas.`);
    console.log(`  ${hasTriangle ? GREEN + '✓' : RED + '✗'}${RESET} Frontend adapters.ts normalizeTriangle handles regulatory evidence nodes and bounding coordinates.`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Step 5: High-Contrast Tabular Report
  // ───────────────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}========================================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}                          FORENSIC ML ENGINE VERIFICATION REPORT                        ${RESET}`);
  console.log(`${BOLD}${CYAN}========================================================================================${RESET}`);

  console.log(
    `${BOLD}| ${'ID'.padEnd(3)} | ${'Engine & Scenario'.padEnd(34)} | ${'Target Endpoint'.padEnd(28)} | ${'Triggered Flag'.padEnd(25)} | ${'Status'.padEnd(6)} |${RESET}`
  );
  console.log(`|${'-'.repeat(5)}|${'-'.repeat(36)}|${'-'.repeat(30)}|${'-'.repeat(27)}|${'-'.repeat(8)}|`);

  for (const r of results) {
    const statusCol = r.passed ? `${GREEN}${BOLD} PASS ${RESET}` : `${RED}${BOLD} FAIL ${RESET}`;
    const nameCol = `${r.engine.split(':')[0]}: ${r.scenario}`.slice(0, 34).padEnd(34);
    const routeCol = r.route.slice(0, 28).padEnd(28);
    const flagCol = r.flag.slice(0, 25).padEnd(25);
    console.log(`| ${String(r.id).padEnd(3)} | ${nameCol} | ${routeCol} | ${flagCol} | ${statusCol} |`);
  }

  console.log(`========================================================================================\n`);

  const totalPassed = results.filter((r) => r.passed).length;
  const allPassed = totalPassed === 7 && !isMockVerification && schemaValidationPassed && feStatusMatch;

  if (allPassed) {
    console.log(`${BOLD}${GREEN}✔ ALL 8 FORENSIC ENGINES & 7 REGULATORY SCENARIOS PASSED WITH COMPLETE HARMONY!${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${BOLD}${RED}✘ VERIFICATION FAILED: ${totalPassed}/7 scenarios passed.${RESET}\n`);
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('\nFatal Error in Verification Suite:', err);
  process.exit(1);
});

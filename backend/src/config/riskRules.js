/**
 * Deterministic Risk Scoring Configuration
 * PDF Reference: Section 8 (Scoring contract example)
 */

const PILLAR_WEIGHTS = {
  documentCompleteness: 0.20,
  anomalyFlags: 0.25,
  sourceVerification: 0.20,
  historicalCompliance: 0.15,
  infrastructureEvidence: 0.20
};

// Validate that weights sum precisely to 1.00
const weightSum = Object.values(PILLAR_WEIGHTS).reduce((acc, w) => acc + w, 0);
if (Math.abs(weightSum - 1.0) > 0.0001) {
  throw new Error(`[Config Error] Pillar weights must sum to 1.00, got ${weightSum}`);
}

const RISK_RULES_VERSION = 'v1.0';

const RISK_RULES = [
  // Document Completeness Rules
  {
    ruleId: 'DOC_MISSING',
    pillar: 'documentCompleteness',
    severity: 'HIGH',
    points: 25,
    explanation: 'Mandatory statutory document is missing or not uploaded.'
  },
  {
    ruleId: 'DOC_EXPIRED',
    pillar: 'documentCompleteness',
    severity: 'MEDIUM',
    points: 15,
    explanation: 'Uploaded compliance certificate or affiliation has expired.'
  },

  // Anomaly Flags Rules
  {
    ruleId: 'TAMPER_DETECTED',
    pillar: 'anomalyFlags',
    severity: 'CRITICAL',
    points: 35,
    explanation: 'Error Level Analysis (ELA) detected statistical anomalies indicative of digital tampering.'
  },
  {
    ruleId: 'FACULTY_COLLISION',
    pillar: 'anomalyFlags',
    severity: 'CRITICAL',
    points: 40,
    explanation: 'Faculty identifier collision detected across concurrent institution applications (potential ghost faculty).'
  },

  // Source Verification Rules
  {
    ruleId: 'AUTHORITY_UNCONFIGURED',
    pillar: 'sourceVerification',
    severity: 'LOW',
    points: 10,
    explanation: 'Official authority integration adapter is pending credentials; source verification unconfirmed.'
  },
  {
    ruleId: 'SOURCE_MISMATCH',
    pillar: 'sourceVerification',
    severity: 'HIGH',
    points: 30,
    explanation: 'Document details do not match state or national regulatory source registry.'
  },

  // Historical Compliance Rules
  {
    ruleId: 'PREVIOUS_DEFICIENCY',
    pillar: 'historicalCompliance',
    severity: 'MEDIUM',
    points: 20,
    explanation: 'Institution had unresolved deficiencies in prior inspection cycles.'
  },

  // Infrastructure Evidence Rules
  {
    ruleId: 'GEOFENCE_FAIL',
    pillar: 'infrastructureEvidence',
    severity: 'HIGH',
    points: 35,
    explanation: 'Infrastructure photo coordinates exceed the configured 500m radius from registered campus coordinates.'
  },
  {
    ruleId: 'NO_GPS_DATA',
    pillar: 'infrastructureEvidence',
    severity: 'LOW',
    points: 10,
    explanation: 'Infrastructure photo lacks EXIF GPS metadata for geographic validation.'
  }
];

function getRiskLevel(totalScore) {
  if (totalScore >= 80) return 'GREEN';
  if (totalScore >= 50) return 'YELLOW';
  return 'RED';
}

module.exports = {
  PILLAR_WEIGHTS,
  RISK_RULES,
  RISK_RULES_VERSION,
  getRiskLevel
};

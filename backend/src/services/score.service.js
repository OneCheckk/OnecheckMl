const { PILLAR_WEIGHTS, RISK_RULES_VERSION, getRiskLevel } = require('../config/riskRules');
const { Application, Document, InfraPhoto, Alert, RiskScore } = require('../models');

/**
 * Computes deterministic risk score from persisted backend facts
 */
async function computeRiskScore(applicationId, runId) {
  const application = await Application.findByIdOrNumber(applicationId);
  if (!application) {
    throw new Error('Application not found');
  }

  const deductions = [];
  const evidenceRefs = [];

  // 1. Pillar: Document Completeness (Base: 100)
  let docSubscore = 100;
  const docs = await Document.find({ application: application._id, uploadStatus: 'STORED' });
  const requiredTypes = ['LAND_DOC', 'AFFILIATION_DOC', 'BUILDING_PLAN', 'FACULTY_LIST'];
  const uploadedTypes = docs.map((d) => d.documentType);

  for (const reqType of requiredTypes) {
    if (!uploadedTypes.includes(reqType)) {
      docSubscore -= 25;
      deductions.push({
        ruleId: 'DOC_MISSING',
        pillar: 'documentCompleteness',
        points: 25,
        explanation: `Mandatory compliance document of type '${reqType}' is missing.`,
        evidenceRef: reqType
      });
    }
  }

  // Check expired documents
  for (const doc of docs) {
    if (doc.isExpired || (doc.expiryDate && new Date(doc.expiryDate) < new Date())) {
      docSubscore -= 15;
      deductions.push({
        ruleId: 'DOC_EXPIRED',
        pillar: 'documentCompleteness',
        points: 15,
        explanation: `Document '${doc.originalName}' (${doc.documentType}) has expired.`,
        evidenceRef: doc._id.toString()
      });
    }
  }
  docSubscore = Math.max(0, Math.min(100, docSubscore));

  // 2. Pillar: Anomaly Flags (Base: 100)
  let anomalySubscore = 100;
  const activeAlerts = await Alert.find({
    application: application._id,
    status: { $in: ['OPEN', 'ACKNOWLEDGED'] }
  });

  for (const alert of activeAlerts) {
    if (alert.type === 'FACULTY_COLLISION') {
      anomalySubscore -= 40;
      deductions.push({
        ruleId: 'FACULTY_COLLISION',
        pillar: 'anomalyFlags',
        points: 40,
        explanation: alert.message,
        evidenceRef: alert._id.toString()
      });
    } else if (alert.type === 'TAMPER_SUSPECTED') {
      anomalySubscore -= 35;
      deductions.push({
        ruleId: 'TAMPER_DETECTED',
        pillar: 'anomalyFlags',
        points: 35,
        explanation: alert.message,
        evidenceRef: alert._id.toString()
      });
    }
  }
  anomalySubscore = Math.max(0, Math.min(100, anomalySubscore));

  // 3. Pillar: Source Verification (Base: 100)
  let sourceSubscore = 100;
  // Authority verification is currently UNCONFIGURED per government integration rules
  sourceSubscore -= 10;
  deductions.push({
    ruleId: 'AUTHORITY_UNCONFIGURED',
    pillar: 'sourceVerification',
    points: 10,
    explanation: 'National authority integration pending production credentials; marked UNAVAILABLE.',
    evidenceRef: 'AUTHORITY_ADAPTER'
  });

  const mismatchDocs = docs.filter((d) => d.verificationStatus === 'MISMATCH_DETECTED');
  if (mismatchDocs.length > 0) {
    sourceSubscore -= 30;
    deductions.push({
      ruleId: 'SOURCE_MISMATCH',
      pillar: 'sourceVerification',
      points: 30,
      explanation: 'Discrepancy detected between uploaded document and regulatory registry.',
      evidenceRef: mismatchDocs[0]._id.toString()
    });
  }
  sourceSubscore = Math.max(0, Math.min(100, sourceSubscore));

  // 4. Pillar: Historical Compliance (Base: 100)
  let historySubscore = 100;
  if (application.status === 'DEFICIENCY_RAISED') {
    historySubscore -= 20;
    deductions.push({
      ruleId: 'PREVIOUS_DEFICIENCY',
      pillar: 'historicalCompliance',
      points: 20,
      explanation: 'Application previously had unresolved deficiencies flagged by scrutiny officers.',
      evidenceRef: application._id.toString()
    });
  }
  historySubscore = Math.max(0, Math.min(100, historySubscore));

  // 5. Pillar: Infrastructure Evidence (Base: 100)
  let infraSubscore = 100;
  const photos = await InfraPhoto.find({ application: application._id });

  if (photos.length === 0) {
    infraSubscore -= 20;
    deductions.push({
      ruleId: 'NO_GPS_DATA',
      pillar: 'infrastructureEvidence',
      points: 20,
      explanation: 'No infrastructure photos uploaded for campus verification.',
      evidenceRef: 'INFRA_PHOTOS_NONE'
    });
  } else {
    for (const photo of photos) {
      if (photo.geofenceStatus === 'FAIL') {
        infraSubscore -= 35;
        deductions.push({
          ruleId: 'GEOFENCE_FAIL',
          pillar: 'infrastructureEvidence',
          points: 35,
          explanation: `Photo (${photo.photoType}) was taken ${photo.distanceFromCampus}m from campus (> 500m radius).`,
          evidenceRef: photo._id.toString()
        });
      } else if (photo.geofenceStatus === 'NO_GPS_DATA') {
        infraSubscore -= 10;
        deductions.push({
          ruleId: 'NO_GPS_DATA',
          pillar: 'infrastructureEvidence',
          points: 10,
          explanation: `Photo (${photo.photoType}) lacks GPS coordinates for geographic validation.`,
          evidenceRef: photo._id.toString()
        });
      }
    }
  }
  infraSubscore = Math.max(0, Math.min(100, infraSubscore));

  // Weighted total score calculation
  const weightedTotal =
    docSubscore * PILLAR_WEIGHTS.documentCompleteness +
    anomalySubscore * PILLAR_WEIGHTS.anomalyFlags +
    sourceSubscore * PILLAR_WEIGHTS.sourceVerification +
    historySubscore * PILLAR_WEIGHTS.historicalCompliance +
    infraSubscore * PILLAR_WEIGHTS.infrastructureEvidence;

  const totalScore = Math.max(0, Math.min(100, Math.round(weightedTotal)));
  const riskLevel = getRiskLevel(totalScore);

  const pillarScores = {
    documentCompleteness: docSubscore,
    anomalyFlags: anomalySubscore,
    sourceVerification: sourceSubscore,
    historicalCompliance: historySubscore,
    infrastructureEvidence: infraSubscore
  };

  // Persist RiskScore record
  const scoreRecord = await RiskScore.create({
    application: application._id,
    runId,
    totalScore,
    riskLevel,
    pillarScores,
    deductions,
    evidenceRefs,
    rulesVersion: RISK_RULES_VERSION
  });

  // Update Application score fields
  application.riskScore = totalScore;
  application.riskLevel = riskLevel;
  application.currentRunId = runId;
  await application.save();

  return scoreRecord;
}

module.exports = {
  computeRiskScore
};

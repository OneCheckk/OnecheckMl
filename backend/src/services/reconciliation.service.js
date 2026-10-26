/**
 * Reconciliation Service
 * Manages regulatory rule evaluation, record snapshots, findings upserting,
 * disposition preservation, and deterministic summary recomputation.
 */

const crypto = require('crypto');
const { Application, Claim, Finding, RecordSnapshot, Institution } = require('../models');
const mlClient = require('./mlClient.service');
const { getInstitutionRecords } = require('../adapters/records/syntheticRecords');
const { computeApplicationSummary } = require('./summary.service');
const { logEvent } = require('./audit.service');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Computes canonical SHA-256 for record bundle
 */
function computeBundleHash(bundle) {
  const json = JSON.stringify(bundle, Object.keys(bundle).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Computes deterministic claimsKey for a finding to carry forward dispositions across re-runs
 */
function computeClaimsKey(ruleId, claimIds = []) {
  const sorted = claimIds.slice().sort().join(':');
  return crypto.createHash('sha256').update(`${ruleId}:${sorted}`).digest('hex');
}

/**
 * Executes full reconciliation pipeline for an application
 */
async function reconcileApplication(applicationId, user = null, requestId = null) {
  const application = await Application.findByIdOrNumber(applicationId).populate('institution');
  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // 1. Scoping check if triggered by user
  if (user && (user.role === 'INSTITUTION' || user.role === 'INSTITUTION_USER')) {
    const userInstId = user.institutionId || user.institution?._id || user.institution;
    const appInstId = application.institutionId || application.institution?._id || application.institution;
    if (!userInstId || !appInstId || userInstId.toString() !== appInstId.toString()) {
      throw ApiError.forbidden('Access denied: You cannot reconcile another institution\'s application.');
    }
  }

  // 2. Fetch claims
  const claims = await Claim.find({ applicationId: application._id });

  // 3. Fetch synthetic AICTE regulatory records & save RecordSnapshot
  const instAicteId = application.institution?.aicteId || application.institution?.registrationId || 'AICTE-DEMO-01';
  const recordsRes = await getInstitutionRecords(instAicteId);

  const bundleSha256 = computeBundleHash(recordsRes.bundle);
  const snapshot = await RecordSnapshot.create({
    applicationId: application._id,
    bundle: recordsRes.bundle,
    source: recordsRes.source,
    sha256: bundleSha256
  });

  await logEvent({
    actorUser: user?._id || null,
    action: 'RECORDS_CHECKED',
    entityType: 'RecordSnapshot',
    entityId: snapshot._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: { aicteId: instAicteId, sha256: bundleSha256 }
  });

  // 4. Invoke ML reconciliation endpoint
  const decisionYear = new Date().getFullYear();
  const reconcilePayload = {
    applicationId: application._id.toString(),
    category: application.category,
    rulepackVersion: '2026.1-demo',
    claims: claims.map((c) => ({
      claimId: c.claimId,
      predicate: c.predicate,
      value: c.value,
      unit: c.unit,
      confidence: c.confidence,
      status: c.status,
      source: c.source
    })),
    records: recordsRes.bundle,
    recordsSource: recordsRes.source.label,
    decisionDate: `${decisionYear}-06-30`,
    approvalPeriod: {
      start: `${decisionYear}-07-01`,
      end: `${decisionYear + 1}-06-30`
    }
  };

  const reconcileRes = await mlClient.reconcile(reconcilePayload, requestId);
  const rawFindings = reconcileRes.findings || [];

  // 5. Upsert findings while strictly preserving existing officer dispositions!
  const savedFindings = [];

  for (const raw of rawFindings) {
    const claimsKey = computeClaimsKey(raw.ruleId, raw.claimIds || []);

    let finding = await Finding.findOne({
      applicationId: application._id,
      ruleId: raw.ruleId,
      claimsKey
    });

    if (finding) {
      // Preserve officer disposition and current status if already dispositioned
      const isAlreadyDispositioned = finding.disposition?.state && finding.disposition.state !== 'OPEN';
      if (!isAlreadyDispositioned) {
        finding.status = raw.status || 'MISMATCH_DETECTED';
      }
      finding.title = raw.title;
      finding.message = raw.message;
      finding.severity = raw.severity;
      finding.proof = raw.proof;
      finding.clauseRef = raw.clauseRef || finding.clauseRef;
      finding.ruleVersion = raw.ruleVersion || finding.ruleVersion;
      finding.rulepackVersion = raw.rulepackVersion || finding.rulepackVersion;
      finding.claimIds = raw.claimIds || finding.claimIds;
      if (raw.alertAt) finding.alertAt = new Date(raw.alertAt);

      await finding.save();
      savedFindings.push(finding);
    } else {
      // Create new finding with OPEN disposition state
      const findingId = `find_${application._id}_${raw.ruleId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      finding = await Finding.create({
        findingId,
        applicationId: application._id,
        ruleId: raw.ruleId,
        ruleVersion: raw.ruleVersion || '1',
        rulepackVersion: raw.rulepackVersion || '2026.1-demo',
        clauseRef: raw.clauseRef || 'HANDBOOK-REF-TBD',
        placeholder: raw.placeholder || false,
        status: raw.status || 'MISMATCH_DETECTED',
        severity: raw.severity || 'MEDIUM',
        title: raw.title,
        message: raw.message,
        claimIds: raw.claimIds || [],
        proof: raw.proof || { statement: raw.message, evidence: [] },
        claimsKey,
        alertAt: raw.alertAt ? new Date(raw.alertAt) : null,
        disposition: {
          state: 'OPEN',
          dispositionedBy: null,
          dispositionedAt: null,
          reason: null
        }
      });
      savedFindings.push(finding);
    }
  }

  // 6. Save execution trace and validity timeline onto application
  application.lastTrace = reconcileRes.trace || [];
  application.lastValidity = reconcileRes.validity || [];
  await application.save();

  // 7. Recompute deterministic summary (RED/YELLOW/GREEN band)
  const summary = await computeApplicationSummary(application._id);

  await logEvent({
    actorUser: user?._id || null,
    action: 'RULES_APPLIED',
    entityType: 'Application',
    entityId: application._id,
    application: application._id,
    requestId,
    outcome: 'SUCCESS',
    metadata: {
      rulepackVersion: reconcileRes.rulepackVersion || '2026.1-demo',
      rulesRun: reconcileRes.rulesRun?.length || 0,
      findingsGenerated: savedFindings.length,
      band: summary.band
    }
  });

  return {
    applicationId: application._id,
    rulepackVersion: reconcileRes.rulepackVersion || '2026.1-demo',
    rulesRun: reconcileRes.rulesRun || [],
    findings: savedFindings,
    trace: reconcileRes.trace || [],
    validity: reconcileRes.validity || [],
    summary
  };
}

module.exports = {
  reconcileApplication,
  computeClaimsKey,
  computeBundleHash
};

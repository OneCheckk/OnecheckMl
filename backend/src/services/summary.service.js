/**
 * Summary Service
 * Non-negotiable: Purely deterministic band computation (RED / YELLOW / GREEN)
 * Replaces any arbitrary weighted score with regulatory gating rules.
 */

const { Finding, Claim, VerificationEntry, Application } = require('../models');

/**
 * Computes deterministic summary band and sortKey for an application
 */
async function computeApplicationSummary(applicationId) {
  // 1. Fetch active findings
  const findings = await Finding.find({ applicationId });

  // Filter open findings (not ACCEPTED, DISMISSED, or RESOLVED)
  const openFindings = findings.filter((f) => {
    const dispState = f.disposition?.state || 'OPEN';
    return !['ACCEPTED', 'DISMISSED', 'RESOLVED'].includes(dispState);
  });

  const countsBySeverity = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };

  for (const f of openFindings) {
    const sev = (f.severity || 'MEDIUM').toUpperCase();
    if (countsBySeverity[sev] !== undefined) {
      countsBySeverity[sev] += 1;
    }
  }

  // 2. Fetch claims status
  const claims = await Claim.find({ applicationId });
  const needsConfirmationCount = claims.filter((c) => c.status === 'NEEDS_CONFIRMATION').length;

  // 3. Check blocked findings
  const blockedLowConfidence = findings.some((f) => f.status === 'BLOCKED_LOW_CONFIDENCE');

  // 4. Check verification ledger entries
  const ledgerEntries = await VerificationEntry.find({ applicationId });
  const pendingSourceVerifications = ledgerEntries.filter(
    (e) => e.status === 'VERIFICATION_PENDING' || e.status === 'SOURCE_UNAVAILABLE'
  ).length;

  // 5. Determine deterministic band:
  // RED: Any open finding with HIGH or CRITICAL severity
  // YELLOW: Any open finding with MEDIUM or LOW, any claim needing confirmation,
  //         any BLOCKED_LOW_CONFIDENCE finding, or any pending/unavailable source verification
  // GREEN: No open findings, no low-confidence blockers, and all sources verified
  let band = 'GREEN';

  if (countsBySeverity.CRITICAL > 0 || countsBySeverity.HIGH > 0) {
    band = 'RED';
  } else if (
    countsBySeverity.MEDIUM > 0 ||
    countsBySeverity.LOW > 0 ||
    needsConfirmationCount > 0 ||
    blockedLowConfidence ||
    pendingSourceVerifications > 0
  ) {
    band = 'YELLOW';
  }

  // 6. Compute sortKey for queue prioritization:
  // Rank: CRITICAL(1) > HIGH(2) > MEDIUM(3) > LOW(4) > NONE(5)
  let severityRank = 5;
  if (countsBySeverity.CRITICAL > 0) severityRank = 1;
  else if (countsBySeverity.HIGH > 0) severityRank = 2;
  else if (countsBySeverity.MEDIUM > 0) severityRank = 3;
  else if (countsBySeverity.LOW > 0) severityRank = 4;

  const findingCountPad = String(999 - Math.min(openFindings.length, 999)).padStart(3, '0');
  const app = await Application.findByIdOrNumber(applicationId).select('submittedAt createdAt');
  const subTs = app?.submittedAt ? app.submittedAt.getTime() : (app?.createdAt ? app.createdAt.getTime() : Date.now());

  const sortKey = `${severityRank}_${findingCountPad}_${subTs}`;

  const summary = {
    band,
    openFindingsCount: openFindings.length,
    countsBySeverity,
    needsConfirmationCount,
    pendingSourceVerifications,
    lastCalculated: new Date().toISOString(),
    sortKey
  };

  // Update application with computed summary
  await Application.findByIdAndUpdate(applicationId, { summary });

  return summary;
}

module.exports = {
  computeApplicationSummary
};

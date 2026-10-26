/**
 * Synthetic Records Adapter
 * Adheres to Section 0.8 & Part 2:
 * "Never fabricate results. Label simulated sources: 'DEMO ADAPTER - simulated AICTE record'"
 */

const { AicteRecord } = require('../../models');

async function getInstitutionRecords(aicteId) {
  if (!aicteId) {
    return {
      bundle: {},
      source: {
        label: 'DEMO ADAPTER - simulated AICTE record',
        kind: 'SYNTHETIC_DEMO',
        fetchedAt: new Date().toISOString()
      }
    };
  }

  const record = await AicteRecord.findOne({ institutionId: aicteId });

  if (record && record.bundle) {
    return {
      bundle: record.bundle,
      source: {
        label: record.sourceLabel || 'DEMO ADAPTER - simulated AICTE record',
        kind: 'SYNTHETIC_DEMO',
        fetchedAt: new Date().toISOString()
      }
    };
  }

  // Fallback demo record bundle if specific institution not pre-seeded
  const defaultBundle = {
    aicteId,
    institutionName: 'Demo Institution',
    ter: { status: 'PENDING', amountDue: 150000, receiptNo: null },
    deficiencies: { openCount: 0, items: [] },
    approvedIntake: { total: 180, courses: [] },
    land: { ownedAreaSqm: 10000, requiredAreaSqm: 8000 }
  };

  return {
    bundle: defaultBundle,
    source: {
      label: 'DEMO ADAPTER - simulated AICTE record',
      kind: 'SYNTHETIC_DEMO',
      fetchedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  getInstitutionRecords
};

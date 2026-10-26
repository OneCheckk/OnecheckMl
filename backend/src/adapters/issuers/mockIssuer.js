/**
 * Mock Issuer Adapter
 * Queries IssuerRegistry for official regulatory certificates (e.g. Fire NOC, State PWD)
 * Non-negotiable: Always labels source as "DEMO ADAPTER - simulated source"
 */

const { IssuerRegistry } = require('../../models');

async function lookupIssuer({ docType, referenceNo }) {
  if (!referenceNo) {
    return {
      status: 'VERIFICATION_PENDING',
      outcome: 'PENDING',
      error: 'No reference number available to query issuer registry',
      sourceLabel: 'DEMO ADAPTER - simulated issuer query'
    };
  }

  const record = await IssuerRegistry.findOne({
    docType: docType.toUpperCase(),
    referenceNo: referenceNo.trim()
  });

  if (record) {
    if (record.behavior === 'MATCH') {
      return {
        status: 'VERIFIED',
        outcome: 'MATCH',
        data: record.data,
        sourceLabel: 'DEMO ADAPTER - simulated issuer query'
      };
    }

    if (record.behavior === 'MISMATCH') {
      return {
        status: 'MISMATCH_DETECTED',
        outcome: 'MISMATCH',
        error: 'Registry records differ from submitted certificate values',
        data: record.data,
        sourceLabel: 'DEMO ADAPTER - simulated issuer query'
      };
    }

    if (record.behavior === 'TIMEOUT') {
      return {
        status: 'SOURCE_UNAVAILABLE',
        outcome: 'TIMEOUT',
        error: 'External issuing authority gateway timed out after 10000ms',
        sourceLabel: 'DEMO ADAPTER - simulated issuer query'
      };
    }

    if (record.behavior === 'PENDING') {
      return {
        status: 'VERIFICATION_PENDING',
        outcome: 'PENDING',
        error: 'Verification pending batch issuance confirmation from authority',
        sourceLabel: 'DEMO ADAPTER - simulated issuer query'
      };
    }

    if (record.behavior === 'NOT_FOUND') {
      return {
        status: 'MISMATCH_DETECTED',
        outcome: 'NOT_FOUND',
        error: 'Certificate reference number not found in issuing authority registry',
        sourceLabel: 'DEMO ADAPTER - simulated issuer query'
      };
    }
  }

  // Default behavior if not pre-seeded: simulate successful verification
  return {
    status: 'VERIFIED',
    outcome: 'MATCH',
    data: { referenceNo, verifiedAt: new Date().toISOString() },
    sourceLabel: 'DEMO ADAPTER - simulated issuer query'
  };
}

module.exports = {
  lookupIssuer
};

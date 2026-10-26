import { describe, it, expect } from 'vitest';
import {
  describeStatus,
  VERIFICATION_STATUS,
  DOCUMENT_VERIFICATION_STATUS,
  APPLICATION_STATUS,
  CHECK_RUN_STATUS,
} from '../../components/status/statusMaps';
import type { VerificationStatus } from '@contracts';

const ALL_VERIFICATION: VerificationStatus[] = [
  'VERIFIED',
  'MISMATCH_DETECTED',
  'EXPIRED',
  'VERIFICATION_PENDING',
  'SOURCE_UNAVAILABLE',
  'MANUAL_REVIEW_REQUIRED',
  'NOT_CHECKED',
  'BLOCKED_LOW_CONFIDENCE',
];

describe('Verification status mapping', () => {
  it('covers every contract VerificationStatus value', () => {
    for (const s of ALL_VERIFICATION) expect(VERIFICATION_STATUS[s]).toBeDefined();
  });

  it('only VERIFIED is shown with a success tone', () => {
    for (const s of ALL_VERIFICATION) {
      const d = describeStatus('verification', s);
      if (s === 'VERIFIED') expect(d.tone).toBe('ok');
      else expect(d.tone).not.toBe('ok');
    }
  });

  it('never presents an unavailable source or a pending check as verified', () => {
    expect(describeStatus('verification', 'SOURCE_UNAVAILABLE').label).toBe('Source unavailable');
    expect(describeStatus('verification', 'SOURCE_UNAVAILABLE').tone).toBe('warn');
    expect(describeStatus('verification', 'VERIFICATION_PENDING').tone).toBe('info');
  });

  it('treats unknown and missing values as neutral, never as success', () => {
    const unknown = describeStatus('verification', 'SOMETHING_NEW');
    expect(unknown.tone).toBe('muted');
    expect(unknown.label).not.toMatch(/verified/i);
    const missing = describeStatus('verification', undefined);
    expect(missing.label).toBe('Not available');
    expect(missing.tone).toBe('muted');
  });
});

describe('Document verification status mapping (backend Document.verificationStatus)', () => {
  it('maps every backend enum value explicitly', () => {
    for (const s of ['PENDING', 'VERIFIED_AT_SOURCE', 'MISMATCH_DETECTED', 'EXPIRED', 'UNAVAILABLE', 'MANUAL_REVIEW']) {
      expect(DOCUMENT_VERIFICATION_STATUS[s]).toBeDefined();
    }
  });
  it('maps UNAVAILABLE to "Source unavailable" and not to success', () => {
    expect(describeStatus('document', 'UNAVAILABLE').label).toBe('Source unavailable');
    expect(describeStatus('document', 'UNAVAILABLE').tone).not.toBe('ok');
    expect(describeStatus('document', 'VERIFIED_AT_SOURCE').tone).toBe('ok');
  });
});

describe('Lifecycle, check-run and verification concepts stay separate', () => {
  it('lifecycle VERIFIED is labelled as scrutiny completed, not as approval', () => {
    expect(APPLICATION_STATUS.VERIFIED.label).toBe('Scrutiny completed');
    expect(APPLICATION_STATUS.VERIFIED.label).not.toBe(VERIFICATION_STATUS.VERIFIED.label);
  });
  it('queued and running check runs are not shown as complete', () => {
    expect(CHECK_RUN_STATUS.QUEUED.tone).not.toBe('ok');
    expect(CHECK_RUN_STATUS.RUNNING.tone).not.toBe('ok');
    expect(CHECK_RUN_STATUS.PARTIAL.tone).not.toBe('ok');
    expect(describeStatus('checkStep', 'UNAVAILABLE').tone).toBe('warn');
  });
});

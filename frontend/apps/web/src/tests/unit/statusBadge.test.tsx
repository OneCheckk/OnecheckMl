import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../components/status';
import type { VerificationStatus } from '@contracts';

describe('StatusBadge Component', () => {
  const statuses: { status: VerificationStatus; expectedLabel: string }[] = [
    { status: 'VERIFIED', expectedLabel: 'Verified' },
    { status: 'MISMATCH_DETECTED', expectedLabel: 'Mismatch detected' },
    { status: 'EXPIRED', expectedLabel: 'Expired' },
    { status: 'VERIFICATION_PENDING', expectedLabel: 'Verification pending' },
    { status: 'SOURCE_UNAVAILABLE', expectedLabel: 'Source unavailable' },
    { status: 'MANUAL_REVIEW_REQUIRED', expectedLabel: 'Manual review required' },
    { status: 'NOT_CHECKED', expectedLabel: 'Not checked' },
    { status: 'BLOCKED_LOW_CONFIDENCE', expectedLabel: 'Needs confirmation' },
  ];

  statuses.forEach(({ status, expectedLabel }) => {
    it(`renders correct text label and icon for ${status}`, () => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByTestId('status-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-status', status);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });
  });
});

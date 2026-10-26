import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClaimTable } from '../../components/data/ClaimTable';
import type { Claim } from '@contracts';

describe('ClaimTable Component', () => {
  const mockClaims: Claim[] = [
    {
      claimId: 'C101',
      applicationId: 'app-1',
      docId: 'D1',
      predicate: 'lab_area_sqm',
      predicateLabel: 'Total Laboratory Area',
      value: 640,
      confidence: 0.95,
      status: 'VERIFIED',
      source: { docId: 'D1', page: 4, bbox: [0.1, 0.2, 0.3, 0.4] },
    },
    {
      claimId: 'C102',
      applicationId: 'app-1',
      docId: 'D1',
      predicate: 'land_survey',
      predicateLabel: 'Land Survey Number',
      value: '48/2A',
      confidence: 0.62, // Low confidence
      needsConfirmation: true,
      status: 'BLOCKED_LOW_CONFIDENCE',
      source: { docId: 'D1', page: 3, bbox: [0.1, 0.2, 0.3, 0.4] },
    },
  ];

  it('highlights low-confidence claims with "Please confirm" action', () => {
    render(<ClaimTable claims={mockClaims} />);

    expect(screen.getByText('Please confirm')).toBeInTheDocument();
    expect(screen.getByText('Land Survey Number')).toBeInTheDocument();
  });

  it('validates mandatory reason when editing extracted claim', async () => {
    render(<ClaimTable claims={mockClaims} />);

    // Click Edit on first claim
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    // Modal should be open
    expect(screen.getByText('Edit Extracted Data: Total Laboratory Area')).toBeInTheDocument();

    // Click submit without entering reason
    const submitBtn = screen.getByText('Confirm Correction & Re-verify');
    fireEvent.click(submitBtn);

    // Error message should appear
    expect(
      screen.getByText('A mandatory explanation (min 5 chars) is required for correcting extracted data.')
    ).toBeInTheDocument();
  });
});

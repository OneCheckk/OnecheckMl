import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RequireRole } from '../../auth/RequireRole';
import * as AuthContext from '../../auth/AuthProvider';

describe('RequireRole Route Guard', () => {
  it('blocks unauthorized roles and renders the 403 forbidden screen', () => {
    // Mock user authenticated with role 'INSTITUTION' trying to access 'ADMIN' partition
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-1',
        name: 'Applicant Institution',
        email: 'applicant@college.edu.in',
        role: 'INSTITUTION',
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      isDevSession: false,
      login: vi.fn(),
      devBypassLogin: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RequireRole roles={['ADMIN']}>
          <div>Secret Admin Panel</div>
        </RequireRole>
      </MemoryRouter>
    );

    // Should NOT show children
    expect(screen.queryByText('Secret Admin Panel')).not.toBeInTheDocument();

    // Should show 403 Forbidden Screen
    expect(screen.getByTestId('forbidden-screen')).toBeInTheDocument();
    expect(screen.getByText('403 — Access Forbidden')).toBeInTheDocument();
    expect(screen.getByText(/INSTITUTION/)).toBeInTheDocument();
  });

  it('renders children when the user has the authorized role', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-admin',
        name: 'AICTE Admin',
        email: 'admin@aicte.gov.in',
        role: 'ADMIN',
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      isDevSession: false,
      login: vi.fn(),
      devBypassLogin: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RequireRole roles={['ADMIN']}>
          <div>Secret Admin Panel</div>
        </RequireRole>
      </MemoryRouter>
    );

    expect(screen.getByText('Secret Admin Panel')).toBeInTheDocument();
  });
});

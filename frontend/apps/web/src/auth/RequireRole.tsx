import React from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { ShieldAlert } from 'lucide-react';
import type { UserRole } from '@contracts';
import { homePathForRole } from './routeAccess';

interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" data-testid="auth-loading" role="status">
        <div className="text-center text-sm text-ink-soft">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          Checking your session…
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const hasAccess = roles.includes(user.role);

  if (!hasAccess) {
    const home = homePathForRole(user.role);
    return (
      <div data-testid="forbidden-screen" className="page py-10">
        <div className="mx-auto max-w-lg rounded border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line bg-bad-bg px-4 py-2.5">
            <ShieldAlert className="h-4 w-4 text-bad" aria-hidden="true" />
            <h1 className="text-[15px] font-semibold text-ink">403 — Access Forbidden</h1>
          </div>
          <div className="space-y-3 px-4 py-4 text-sm text-ink-soft">
            <p>
              Your signed-in role (<strong className="font-mono text-ink">{user.role}</strong>) is not permitted to open
              this page. Access is decided by your account role and cannot be changed from here.
            </p>
            <p>If you believe you need access, contact your OneCheck administrator.</p>
            <Link
              to={home}
              className="inline-flex h-9 items-center rounded border border-brand-700 bg-brand-700 px-3.5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Go to my workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

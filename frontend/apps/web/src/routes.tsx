import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { RequireRole } from './auth/RequireRole';
import { ROUTE_ROLES } from './auth/routeAccess';

// Public Pages
import { LandingPage } from './pages/Landing';
import { LoginPage } from './pages/login/Login';
import { SignupPage } from './pages/login/Signup';
import { ForgotPasswordPage } from './pages/login/ForgotPassword';

// Institution Pages
import { InstitutionApplicationsPage } from './pages/institution/Applications';
import { NewApplicationPage } from './pages/institution/NewApplication';
import { InstitutionWorkspacePage } from './pages/institution/Workspace';

// Officer Pages
import { OfficerQueuePage } from './pages/officer/Queue';
import { OfficerCasePacketPage } from './pages/officer/CasePacket';
import { DeficiencyLettersPage } from './pages/officer/Letters';
import { AlertsQueuePage } from './pages/officer/AlertsQueue';

// Admin & Audit & Benchmark Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboard';
import { AdminInstitutionsPage } from './pages/admin/Institutions';
import { AdminRulepacksPage } from './pages/admin/Rulepacks';
import { AdminChecklistsPage, AdminUsersPage } from './pages/admin/AdminManage';
import { AuditPage } from './pages/audit/Audit';
import { BenchmarkPage } from './pages/benchmark/Benchmark';
import { NetworkSyndicatePage } from './pages/syndicate/NetworkSyndicatePage';

const NotFound: React.FC = () => (
  <div className="page py-12">
    <div className="mx-auto max-w-lg rounded border border-line bg-white px-5 py-6">
      <h1 className="text-lg font-semibold text-brand-900">Page not found</h1>
      <p className="mt-1 text-sm text-ink-soft">The address you followed does not match any page in OneCheck.</p>
      <Link to="/" className="mt-4 inline-block link text-sm">
        Return to the home page
      </Link>
    </div>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Authenticated routes */}
      <Route element={<AppLayout />}>
        {/* Institution */}
        <Route
          path="/portal"
          element={
            <RequireRole roles={[...ROUTE_ROLES.institutionPortal]}>
              <InstitutionApplicationsPage />
            </RequireRole>
          }
        />
        <Route
          path="/portal/new"
          element={
            <RequireRole roles={[...ROUTE_ROLES.institutionPortal]}>
              <NewApplicationPage />
            </RequireRole>
          }
        />
        <Route
          path="/portal/applications/:id"
          element={
            <RequireRole roles={[...ROUTE_ROLES.institutionPortal]}>
              <InstitutionWorkspacePage />
            </RequireRole>
          }
        />

        {/* Officers */}
        <Route
          path="/review"
          element={
            <RequireRole roles={[...ROUTE_ROLES.review]}>
              <OfficerQueuePage />
            </RequireRole>
          }
        />
        <Route
          path="/review/:id"
          element={
            <RequireRole roles={[...ROUTE_ROLES.review]}>
              <OfficerCasePacketPage />
            </RequireRole>
          }
        />
        <Route
          path="/review/:id/letters"
          element={
            <RequireRole roles={[...ROUTE_ROLES.review]}>
              <DeficiencyLettersPage />
            </RequireRole>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireRole roles={[...ROUTE_ROLES.alerts]}>
              <AlertsQueuePage />
            </RequireRole>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RequireRole roles={[...ROUTE_ROLES.admin]}>
              <AdminDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/institutions"
          element={
            <RequireRole roles={[...ROUTE_ROLES.admin]}>
              <AdminInstitutionsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/rulepacks"
          element={
            <RequireRole roles={[...ROUTE_ROLES.admin]}>
              <AdminRulepacksPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/checklists"
          element={
            <RequireRole roles={[...ROUTE_ROLES.admin]}>
              <AdminChecklistsPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireRole roles={[...ROUTE_ROLES.admin]}>
              <AdminUsersPage />
            </RequireRole>
          }
        />

        {/* Network Syndicate Visualization (Feature 1) */}
        <Route path="/syndicate" element={<NetworkSyndicatePage />} />


        {/* Audit */}
        <Route
          path="/audit"
          element={
            <RequireRole roles={[...ROUTE_ROLES.audit]}>
              <AuditPage />
            </RequireRole>
          }
        />

        {/* Benchmark */}
        <Route
          path="/benchmark"
          element={
            <RequireRole roles={[...ROUTE_ROLES.benchmark]}>
              <BenchmarkPage />
            </RequireRole>
          }
        />
      </Route>

      {/* 404 */}
      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

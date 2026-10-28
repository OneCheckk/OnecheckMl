import React from 'react';
import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';
import { useDashboardSummary, useHealth } from '../../api/queries';
import { ErrorState, PageHeader, PageSkeleton, Panel, StatStrip, DataTable, Notice, Button } from '../../components/ui';
import { ApplicationStatusBadge, BandChip, CheckRunBadge, DemoBanner, SeverityChip } from '../../components/status';
import { APPLICATION_STATUS } from '../../components/status/statusMaps';
import { IntegrityAuditControl } from '../../components/audit/IntegrityAuditControl';
import type { Band, Severity } from '@contracts';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export const AdminDashboardPage: React.FC = () => {
  const summary = useDashboardSummary();
  const health = useHealth();

  if (summary.isLoading) return <PageSkeleton />;

  const d = summary.data;
  const byStatus = d?.applicationsByStatus ?? {};
  const byRisk = d?.applicationsByRiskLevel ?? {};
  const bySeverity = d?.openAlertsBySeverity ?? {};

  return (
    <div className="page py-6">
      <PageHeader
        title="Administration overview"
        description="Platform-wide figures aggregated by the server, with shortcuts to management pages."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Overview' }]}
        actions={
          <Link
            to="/syndicate"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-700 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-800 transition"
          >
            <Network className="h-4 w-4" /> Syndicate Network Web
          </Link>
        }
      />
      <DemoBanner className="mb-4" />

      {/* Feature 3: Bureau Director Integrity Audit Control & Breach Alert */}
      <IntegrityAuditControl className="mb-5" />

      {summary.isError ? (
        <ErrorState error={summary.error} title="Overview figures could not be loaded" onRetry={() => summary.refetch()} />
      ) : (
        <div className="space-y-5">
          <StatStrip
            items={[
              { label: 'Registered institutions', value: d?.overview?.totalInstitutions, to: '/admin/institutions' },
              { label: 'Applications', value: d?.overview?.totalApplications },
              { label: 'Open alerts', value: d?.overview?.totalOpenAlerts, tone: (d?.overview?.totalOpenAlerts ?? 0) > 0 ? 'bad' : 'default', to: '/alerts' },
              {
                label: 'API status',
                value: health.isLoading ? '…' : health.isError ? 'Unreachable' : health.data?.status === 'UP' ? 'Up' : health.data?.status ?? '—',
                tone: health.isError ? 'bad' : health.data?.status === 'UP' ? 'ok' : 'default',
                hint: health.data?.database ? `Database: ${health.data.database.toLowerCase()}` : health.isError ? 'GET /api/health failed' : undefined,
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Applications by lifecycle status" bodyClassName="">
              <table className="data-table">
                <tbody>
                  {Object.keys(byStatus).length === 0 ? (
                    <tr><td className="text-ink-soft">No data returned.</td></tr>
                  ) : (
                    Object.entries(byStatus).map(([status, count]) => (
                      <tr key={status}>
                        <td>{APPLICATION_STATUS[status] ? <ApplicationStatusBadge status={status} /> : status}</td>
                        <td className="text-right tabular-nums font-semibold">{count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel title="Applications by risk band" subtitle="Only applications with a computed score" bodyClassName="">
              <table className="data-table">
                <tbody>
                  {(['RED', 'YELLOW', 'GREEN'] as Band[]).map((b) => (
                    <tr key={b}>
                      <td><BandChip band={b} /></td>
                      <td className="text-right tabular-nums font-semibold">{byRisk[b] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel title="Open alerts by severity" actions={<Link to="/alerts" className="link text-meta">Open alerts</Link>} bodyClassName="">
              <table className="data-table">
                <tbody>
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map((s) => (
                    <tr key={s}>
                      <td><SeverityChip severity={s} /></td>
                      <td className="text-right tabular-nums font-semibold">{bySeverity[s] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel title="Recent verification check runs" subtitle="Latest five runs recorded by the server" bodyClassName="">
            <DataTable
              columns={[
                { key: 'app', header: 'Application', render: (r) => <span className="ident">{r.applicationNumber ?? '—'}</span> },
                { key: 'run', header: 'Run ID', render: (r) => <span className="ident text-ink-soft">{r.runId}</span> },
                { key: 'status', header: 'Status', render: (r) => <CheckRunBadge status={r.status} /> },
                { key: 'start', header: 'Started', render: (r) => fmt(r.startedAt) },
                { key: 'end', header: 'Completed', render: (r) => fmt(r.completedAt) },
              ]}
              data={d?.recentRuns ?? []}
              keyExtractor={(r) => r.runId}
              emptyState={<p className="p-5 text-center text-sm text-ink-soft">No check runs have been recorded yet.</p>}
            />
          </Panel>

          <Panel title="Management">
            <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['/admin/institutions', 'Institutions', 'Registered institution profiles'],
                ['/admin/users', 'Users', 'Accounts, roles and activation'],
                ['/admin/checklists', 'Checklists', 'Required documents per category'],
                ['/admin/rulepacks', 'Rulepacks', 'Versioned verification rules'],
                ['/syndicate', 'Syndicate Network', 'Interactive Graph DB anomaly network'],
                ['/audit', 'Audit trail', 'Logged actions and chain verification'],
                ['/benchmark', 'Benchmark', 'Synthetic evaluation runs'],
              ].map(([to, t, desc]) => (
                <li key={to}>
                  <Link to={to} className="link font-semibold">{t}</Link>
                  <span className="block text-meta text-ink-faint">{desc}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Notice tone="muted">
            Status counts come from <span className="font-mono text-[12px]">GET /api/dashboard/summary</span>. Lifecycle
            statuses that the server does not count are not shown.
          </Notice>
        </div>
      )}
    </div>
  );
};

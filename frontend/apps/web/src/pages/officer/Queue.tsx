import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Network } from 'lucide-react';
import { useApplicationsPage, useOfficerDashboard } from '../../api/queries';
import type { ApplicationView } from '../../api/adapters';
import { IntegrityAuditControl } from '../../components/audit/IntegrityAuditControl';
import {
  DataTable,
  ErrorState,
  FilterBar,
  FilterSelect,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  StatStrip,
} from '../../components/ui';
import { ApplicationStatusBadge, BandChip, DemoBanner } from '../../components/status';
import { APPLICATION_STATUS, RISK_BAND, categoryLabel } from '../../components/status/statusMaps';
import { fmtAge, fmtDate } from '../../lib/format';

// Statuses the backend list endpoint accepts as a filter (application.service.listApplications)
const STATUS_FILTERS = ['SUBMITTED', 'UNDER_SCRUTINY', 'DEFICIENCY_RAISED', 'VERIFIED', 'APPROVED', 'REJECTED', 'DRAFT'];

const SORTS: Record<string, { label: string; sortBy: string; sortOrder: 'asc' | 'desc' }> = {
  newest: { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  oldest: { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  risk: { label: 'Lowest risk score first', sortBy: 'riskScore', sortOrder: 'asc' },
  number: { label: 'Application number', sortBy: 'applicationNumber', sortOrder: 'asc' },
};

const OpenFindingsCell: React.FC<{ app: ApplicationView }> = ({ app }) => {
  if (app.hasSeverityBreakdown) {
    const c = app.openFindingsCount;
    const total = (c.critical || 0) + (c.high || 0) + (c.medium || 0) + (c.low || 0) + (c.info || 0);
    if (total === 0) return <span className="text-ink-faint">None</span>;
    const parts = [
      c.critical ? `${c.critical} critical` : null,
      c.high ? `${c.high} high` : null,
      c.medium ? `${c.medium} medium` : null,
      c.low ? `${c.low} low` : null,
    ].filter(Boolean);
    return (
      <span>
        <span className="font-semibold tabular-nums">{total}</span>
        <span className="block text-[11.5px] text-ink-soft">{parts.join(', ')}</span>
      </span>
    );
  }
  if (typeof app.openFindingsTotal === 'number') {
    return (
      <span>
        <span className="font-semibold tabular-nums">{app.openFindingsTotal}</span>
        {app.maxSeverity && <span className="block text-[11.5px] text-ink-soft">Highest: {app.maxSeverity.toLowerCase()}</span>}
      </span>
    );
  }
  return <span className="text-ink-faint">—</span>;
};

const countCell = (n?: number) =>
  typeof n === 'number' ? (n > 0 ? <span className="font-semibold tabular-nums">{n}</span> : <span className="text-ink-faint">0</span>) : <span className="text-ink-faint">—</span>;

export const OfficerQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [band, setBand] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');

  const dashboard = useOfficerDashboard();
  const list = useApplicationsPage({
    status: status || undefined,
    riskLevel: band || undefined,
    page,
    limit,
    sortBy: SORTS[sort].sortBy,
    sortOrder: SORTS[sort].sortOrder,
  });

  const rows = list.data?.items ?? [];
  const pagination = list.data?.pagination;
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) => a.applicationNumber.toLowerCase().includes(q) || a.institutionName.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const d = dashboard.data;
  const next = d?.prioritizedQueue?.[0];

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div className="page py-6 space-y-4">
      <PageHeader
        title="Scrutiny review queue"
        description="Applications accessible to you for scrutiny. Open a case to inspect findings and cited evidence."
        breadcrumbs={[{ label: 'Scrutiny' }, { label: 'Review queue' }]}
        actions={
          <Link
            to="/syndicate"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-700 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-800 transition"
          >
            <Network className="h-4 w-4" /> Syndicate Network Web
          </Link>
        }
      />
      <DemoBanner />

      {/* Feature 3: Bureau Director Integrity Audit Control & Breach Alert */}
      <IntegrityAuditControl />

      {dashboard.isError ? (
        <Notice tone="warn" className="mb-4" title="Queue summary unavailable">
          The summary figures could not be loaded. The list below is unaffected.
        </Notice>
      ) : (
        <StatStrip
          className="mb-4"
          isLoading={dashboard.isLoading}
          items={[
            { label: RISK_BAND.RED.label, value: d?.bandCounts?.RED, tone: 'bad', hint: 'Risk band: red' },
            { label: RISK_BAND.YELLOW.label, value: d?.bandCounts?.YELLOW, tone: 'warn', hint: 'Risk band: yellow' },
            { label: RISK_BAND.GREEN.label, value: d?.bandCounts?.GREEN, hint: 'Risk band: green' },
            { label: 'Not yet scored', value: d?.bandCounts?.UNCALCULATED, hint: 'No risk band computed' },
            { label: 'Pending source checks', value: d?.pendingSourceVerifications, tone: 'info', hint: 'Pending or source unavailable' },
            { label: 'Open alerts', value: d?.alerts?.total, tone: (d?.alerts?.total ?? 0) > 0 ? 'bad' : 'default', to: '/alerts' },
          ]}
        />
      )}

      {next && (
        <div className="mb-4 flex flex-col gap-2 rounded border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="text-meta font-semibold text-brand-800">First in the server's priority order</p>
            <p className="mt-0.5">
              <span className="ident font-semibold">{next.applicationNumber}</span>
              {next.institutionName && <span className="text-ink-soft"> · {next.institutionName}</span>}
              <span className="ml-2 inline-block align-middle"><ApplicationStatusBadge status={next.status} /></span>
            </p>
          </div>
          <Link
            to={`/review/${next.id}`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-brand-700 bg-brand-700 px-3.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Open case <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      <Panel bodyClassName="">
        <FilterBar
          className="rounded-none border-0 border-b"
          searchLabel="Filter this page"
          searchPlaceholder="Application number or institution"
          searchQuery={search}
          onSearchChange={setSearch}
          onSearchClear={() => setSearch('')}
          totalCount={pagination?.totalItems}
          totalLabel="applications in total"
          filtersSlot={
            <>
              <FilterSelect
                label="Status"
                value={status}
                onChange={resetPage(setStatus)}
                options={[{ value: '', label: 'All statuses' }, ...STATUS_FILTERS.map((s) => ({ value: s, label: APPLICATION_STATUS[s].label }))]}
              />
              <FilterSelect
                label="Risk band"
                value={band}
                onChange={resetPage(setBand)}
                options={[
                  { value: '', label: 'All bands' },
                  { value: 'RED', label: RISK_BAND.RED.label },
                  { value: 'YELLOW', label: RISK_BAND.YELLOW.label },
                  { value: 'GREEN', label: RISK_BAND.GREEN.label },
                ]}
              />
              <FilterSelect
                label="Sort by"
                value={sort}
                onChange={resetPage(setSort)}
                options={Object.entries(SORTS).map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </>
          }
          activeTags={[
            ...(status ? [{ id: 's', label: `Status: ${APPLICATION_STATUS[status].label}`, onRemove: () => resetPage(setStatus)('') }] : []),
            ...(band ? [{ id: 'b', label: `Risk band: ${RISK_BAND[band].label}`, onRemove: () => resetPage(setBand)('') }] : []),
            ...(search ? [{ id: 'q', label: `Page filter: “${search}”`, onRemove: () => setSearch('') }] : []),
          ]}
          onClearAll={() => {
            setStatus('');
            setBand('');
            setSearch('');
            setPage(1);
          }}
        />
        {search && (
          <p className="border-b border-line-soft bg-[#fafbfc] px-3 py-1.5 text-meta text-ink-faint">
            Text filtering applies to the rows on this page only; the API does not provide a search parameter.
          </p>
        )}

        {list.isError ? (
          <div className="p-4">
            <ErrorState error={list.error} title="The review queue could not be loaded" onRetry={() => list.refetch()} />
          </div>
        ) : (
          <>
            <DataTable<ApplicationView>
              caption="Scrutiny review queue"
              isLoading={list.isLoading}
              data={visibleRows}
              keyExtractor={(a) => a.id}
              onRowClick={(a) => navigate(`/review/${a.id}`)}
              columns={[
                {
                  key: 'app',
                  header: 'Application',
                  render: (a) => (
                    <div className="min-w-[180px]">
                      <Link to={`/review/${a.id}`} onClick={(e) => e.stopPropagation()} className="link ident font-semibold">
                        {a.applicationNumber}
                      </Link>
                      <span className="block text-[12.5px] text-ink-soft">{a.institutionName || '—'}</span>
                    </div>
                  ),
                },
                { key: 'cat', header: 'Category', render: (a) => <span className="text-[12.5px]">{categoryLabel(a.category)}</span> },
                { key: 'status', header: 'Status', render: (a) => <ApplicationStatusBadge status={a.status} /> },
                {
                  key: 'band',
                  header: 'Risk band',
                  render: (a) =>
                    a.band ? (
                      <span className="flex flex-col items-start gap-0.5">
                        <BandChip band={a.band} />
                        {typeof a.riskScore === 'number' && <span className="text-[11.5px] text-ink-faint">Score {a.riskScore}/100</span>}
                      </span>
                    ) : (
                      <span className="text-meta text-ink-faint">Not scored</span>
                    ),
                },
                { key: 'findings', header: 'Open findings', render: (a) => <OpenFindingsCell app={a} /> },
                { key: 'pending', header: 'Pending sources', render: (a) => countCell(a.pendingSourcesCount) },
                { key: 'confirm', header: 'Needs confirmation', render: (a) => countCell(a.claimsNeedingConfirmationCount) },
                {
                  key: 'submitted',
                  header: 'Submitted',
                  render: (a) => (
                    <span className="whitespace-nowrap">
                      {fmtDate(a.submittedAt)}
                      {a.submittedAt && <span className="block text-[11.5px] text-ink-faint">{fmtAge(a.submittedAt)}</span>}
                    </span>
                  ),
                },
              ]}
              emptyState={
                <p className="p-8 text-center text-sm text-ink-soft">
                  {status || band || search ? 'No applications match the current filters.' : 'There are no applications in your queue.'}
                </p>
              }
            />
            {pagination && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalRecords={pagination.totalItems}
                pageSize={pagination.limit}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setLimit(n);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </Panel>
    </div>
  );
};

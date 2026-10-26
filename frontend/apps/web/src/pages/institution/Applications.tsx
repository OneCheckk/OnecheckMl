import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus2, ChevronRight } from 'lucide-react';
import { useInstitutionDashboard } from '../../api/queries';
import type { ApplicationView } from '../../api/adapters';
import { useAuth } from '../../auth/AuthProvider';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterSelect,
  PageHeader,
  PageSkeleton,
  Panel,
  StatStrip,
} from '../../components/ui';
import { ApplicationStatusBadge, BandChip, DemoBanner } from '../../components/status';
import { APPLICATION_STATUS, categoryLabel } from '../../components/status/statusMaps';
import { fmtDate } from '../../lib/format';

const IN_REVIEW = ['SUBMITTED', 'PROCESSING', 'READY_FOR_REVIEW', 'UNDER_SCRUTINY'];
const NEEDS_ACTION = ['DRAFT', 'DEFICIENCY_RAISED', 'CLARIFICATION_REQUESTED', 'DEFICIENCY_LETTER_ISSUED'];
const DECIDED = ['VERIFIED', 'DECIDED', 'APPROVED', 'REJECTED'];

const nextStep = (app: ApplicationView) => {
  switch (String(app.status)) {
    case 'DRAFT':
      return 'Upload the required documents and submit.';
    case 'DEFICIENCY_RAISED':
    case 'CLARIFICATION_REQUESTED':
    case 'DEFICIENCY_LETTER_ISSUED':
      return 'Read the deficiency letter and upload corrected documents.';
    default:
      return '';
  }
};

export const InstitutionApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useInstitutionDashboard();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  const apps = data?.applications ?? [];

  const counts = useMemo(() => {
    const c = { draft: 0, review: 0, action: 0, decided: 0 };
    for (const a of apps) {
      if (a.status === 'DRAFT') c.draft++;
      if (IN_REVIEW.includes(a.status)) c.review++;
      if (NEEDS_ACTION.includes(a.status)) c.action++;
      if (DECIDED.includes(a.status)) c.decided++;
    }
    return c;
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter(
      (a) =>
        (status === 'ALL' || a.status === status) &&
        (!q ||
          a.applicationNumber.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          categoryLabel(a.category).toLowerCase().includes(q))
    );
  }, [apps, search, status]);

  const attention = apps.filter((a) => NEEDS_ACTION.includes(a.status));
  const statusesPresent = Array.from(new Set(apps.map((a) => a.status)));

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="page py-6">
      <PageHeader
        title="Institution dashboard"
        description={
          user?.institutionName
            ? `Applications filed by ${user.institutionName}.`
            : 'Applications filed by your institution.'
        }
        breadcrumbs={[{ label: 'Institution' }, { label: 'Dashboard' }]}
        actions={
          <Button onClick={() => navigate('/portal/new')}>
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Create application
          </Button>
        }
      />
      <DemoBanner className="mb-4" />

      {isError ? (
        <ErrorState error={error} title="Your applications could not be loaded" onRetry={() => refetch()} />
      ) : apps.length === 0 ? (
        <Panel>
          <EmptyState
            title="No applications yet"
            description="Create an application to see the documents required for its category. You can upload documents and run a self-check before submitting."
            actionText="Create application"
            onAction={() => navigate('/portal/new')}
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          <StatStrip
            items={[
              { label: 'Total applications', value: data?.totalApplications },
              { label: 'Drafts', value: counts.draft },
              { label: 'Submitted or under scrutiny', value: counts.review, tone: 'info' },
              { label: 'Require your action', value: counts.action, tone: counts.action > 0 ? 'warn' : 'default', hint: 'Drafts and deficiency letters' },
              { label: 'Completed or decided', value: counts.decided },
            ]}
          />

          {attention.length > 0 && (
            <Panel title="Requires your attention" subtitle="Applications waiting for an action from your institution" bodyClassName="">
              <ul className="divide-y divide-line-soft">
                {attention.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/portal/applications/${a.id}`} className="link ident font-semibold">
                          {a.applicationNumber}
                        </Link>
                        <ApplicationStatusBadge status={a.status} />
                      </div>
                      <p className="mt-0.5 text-meta text-ink-soft">
                        {categoryLabel(a.category)} · {nextStep(a)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/portal/applications/${a.id}`)}>
                      Open application
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="All applications" bodyClassName="">
            <FilterBar
              className="rounded-none border-0 border-b"
              searchLabel="Search applications"
              searchPlaceholder="Application number or category"
              searchQuery={search}
              onSearchChange={setSearch}
              onSearchClear={() => setSearch('')}
              totalCount={filtered.length}
              totalLabel={filtered.length === 1 ? 'application' : 'applications'}
              filtersSlot={
                <FilterSelect
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'ALL', label: 'All statuses' },
                    ...statusesPresent.map((s) => ({ value: s, label: APPLICATION_STATUS[s]?.label ?? s })),
                  ]}
                />
              }
              activeTags={[
                ...(status !== 'ALL' ? [{ id: 'status', label: `Status: ${APPLICATION_STATUS[status]?.label ?? status}`, onRemove: () => setStatus('ALL') }] : []),
                ...(search ? [{ id: 'q', label: `Search: “${search}”`, onRemove: () => setSearch('') }] : []),
              ]}
              onClearAll={() => {
                setSearch('');
                setStatus('ALL');
              }}
            />
            <DataTable<ApplicationView>
              caption="Applications filed by your institution"
              data={filtered}
              keyExtractor={(a) => a.id}
              onRowClick={(a) => navigate(`/portal/applications/${a.id}`)}
              columns={[
                {
                  key: 'no',
                  header: 'Application no.',
                  render: (a) => (
                    <Link to={`/portal/applications/${a.id}`} className="link ident font-semibold" onClick={(e) => e.stopPropagation()}>
                      {a.applicationNumber}
                    </Link>
                  ),
                },
                { key: 'cat', header: 'Category', render: (a) => categoryLabel(a.category) },
                { key: 'year', header: 'Academic year', render: (a) => a.academicYear ?? '—' },
                { key: 'status', header: 'Status', render: (a) => <ApplicationStatusBadge status={a.status} /> },
                {
                  key: 'band',
                  header: 'Risk band',
                  render: (a) => (a.band ? <BandChip band={a.band} /> : <span className="text-meta text-ink-faint">Not assessed</span>),
                },
                { key: 'sub', header: 'Submitted', render: (a) => fmtDate(a.submittedAt) },
                { key: 'upd', header: 'Last updated', render: (a) => fmtDate(a.updatedAt) },
                {
                  key: 'go',
                  header: '',
                  headerClassName: 'w-8',
                  render: () => <ChevronRight className="h-4 w-4 text-ink-faint" aria-hidden="true" />,
                },
              ]}
              emptyState={<p className="p-6 text-center text-sm text-ink-soft">No applications match the current filters.</p>}
            />
          </Panel>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlertsPage, useUpdateAlertStatus } from '../../api/queries';
import type { AlertView } from '../../api/adapters';
import { describeApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import { hasPermission } from '../../auth/permissions';
import { isOfficerRole } from '../../auth/routeAccess';
import {
  Button,
  DataTable,
  ErrorState,
  FilterBar,
  FilterSelect,
  FormField,
  Modal,
  Notice,
  PageHeader,
  Pagination,
  Panel,
} from '../../components/ui';
import { AlertStatusBadge, DemoBanner, SeverityChip } from '../../components/status';
import { ALERT_STATUS, humanize } from '../../components/status/statusMaps';
import { fmtDateTime } from '../../lib/format';

const NEXT_STATUSES = ['ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE'] as const;

export const AlertsQueuePage: React.FC = () => {
  const { user } = useAuth();
  const canUpdate = hasPermission(user?.role, 'UPDATE_ALERT');
  const canOpenCase = isOfficerRole(user?.role);

  const [status, setStatus] = useState('OPEN');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const q = useAlertsPage({ status: status || undefined, severity: severity || undefined, page, limit });
  const update = useUpdateAlertStatus();

  const [selected, setSelected] = useState<AlertView | null>(null);
  const [nextStatus, setNextStatus] = useState<string>('ACKNOWLEDGED');
  const [reason, setReason] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The mock layer ignores server-side filters; apply them to what is shown as well.
  const rows = (q.data?.items ?? []).filter((a) => (!status || a.status === status) && (!severity || a.severity === severity));
  const pagination = q.data?.pagination;

  const openDialog = (a: AlertView) => {
    setSelected(a);
    setNextStatus(a.status === 'OPEN' ? 'ACKNOWLEDGED' : 'RESOLVED');
    setReason('');
    setDialogError(null);
  };

  const submit = async () => {
    if (!selected) return;
    if (reason.trim().length < 5) {
      setDialogError('A reason of at least 5 characters is required.');
      return;
    }
    try {
      await update.mutateAsync({ id: selected.id, status: nextStatus, reason: reason.trim() });
      setNotice(`Alert updated to “${ALERT_STATUS[nextStatus]?.label ?? nextStatus}”.`);
      setSelected(null);
    } catch (err) {
      setDialogError(describeApiError(err, 'The alert could not be updated.').message);
    }
  };

  return (
    <div className="page py-6">
      <PageHeader
        title="Alerts"
        description="Signals raised by verification runs and scheduled checks, such as pending source responses and certificates nearing expiry."
        breadcrumbs={[{ label: 'Scrutiny' }, { label: 'Alerts' }]}
      />
      <DemoBanner className="mb-4" />
      {notice && <Notice tone="ok" className="mb-4" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      <Panel bodyClassName="">
        <FilterBar
          className="rounded-none border-0 border-b"
          totalCount={pagination?.totalItems ?? rows.length}
          totalLabel="alerts"
          filtersSlot={
            <>
              <FilterSelect
                label="Status"
                value={status}
                onChange={(v) => { setStatus(v); setPage(1); }}
                options={[{ value: '', label: 'All statuses' }, ...Object.entries(ALERT_STATUS).map(([k, d]) => ({ value: k, label: d.label }))]}
              />
              <FilterSelect
                label="Severity"
                value={severity}
                onChange={(v) => { setSeverity(v); setPage(1); }}
                options={[{ value: '', label: 'All severities' }, ...['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({ value: s, label: humanize(s) }))]}
              />
            </>
          }
          activeTags={[
            ...(status ? [{ id: 's', label: `Status: ${ALERT_STATUS[status]?.label}`, onRemove: () => setStatus('') }] : []),
            ...(severity ? [{ id: 'v', label: `Severity: ${humanize(severity)}`, onRemove: () => setSeverity('') }] : []),
          ]}
          onClearAll={() => { setStatus(''); setSeverity(''); setPage(1); }}
        />
        {q.isError ? (
          <div className="p-4"><ErrorState error={q.error} title="Alerts could not be loaded" onRetry={() => q.refetch()} /></div>
        ) : (
          <>
            <DataTable<AlertView>
              caption="Alerts"
              isLoading={q.isLoading}
              data={rows}
              keyExtractor={(a) => a.id}
              columns={[
                { key: 'sev', header: 'Severity', render: (a) => <SeverityChip severity={a.severity} /> },
                {
                  key: 'alert',
                  header: 'Alert',
                  render: (a) => (
                    <div className="min-w-[240px]">
                      <span className="block font-semibold text-ink">{a.title ?? humanize(a.type)}</span>
                      <span className="text-[12.5px] text-ink-soft">{a.message}</span>
                    </div>
                  ),
                },
                {
                  key: 'app',
                  header: 'Application',
                  render: (a) =>
                    a.applicationId ? (
                      canOpenCase ? (
                        <Link to={`/review/${a.applicationId}`} className="link ident">{a.applicationNumber ?? a.applicationId}</Link>
                      ) : (
                        <span className="ident">{a.applicationNumber ?? a.applicationId}</span>
                      )
                    ) : (
                      <span className="text-ink-faint">—</span>
                    ),
                },
                { key: 'status', header: 'Status', render: (a) => <AlertStatusBadge status={a.status} /> },
                { key: 'raised', header: 'Raised', render: (a) => <span className="whitespace-nowrap">{fmtDateTime(a.raisedAt)}</span> },
                { key: 'due', header: 'Due', render: (a) => <span className="whitespace-nowrap">{fmtDateTime(a.dueAt)}</span> },
                {
                  key: 'act',
                  header: '',
                  render: (a) =>
                    canUpdate && a.status !== 'RESOLVED' && a.status !== 'FALSE_POSITIVE' ? (
                      <Button variant="outline" size="sm" onClick={() => openDialog(a)}>Update status</Button>
                    ) : null,
                },
              ]}
              emptyState={<p className="p-8 text-center text-sm text-ink-soft">No alerts match the current filters.</p>}
            />
            {pagination && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalRecords={pagination.totalItems}
                pageSize={pagination.limit}
                onPageChange={setPage}
                onPageSizeChange={(n) => { setLimit(n); setPage(1); }}
              />
            )}
          </>
        )}
      </Panel>
      {!canUpdate && <p className="mt-2 text-meta text-ink-faint">Your role can view alerts but not change their status.</p>}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Update alert status"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSelected(null)} disabled={update.isPending}>Cancel</Button>
            <Button size="sm" onClick={submit} isLoading={update.isPending}>Save status</Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded border border-line-soft bg-[#fafbfc] px-3 py-2">
              <p className="font-semibold text-ink">{selected.title ?? humanize(selected.type)}</p>
              <p className="text-ink-soft">{selected.message}</p>
              <p className="mt-1 text-meta text-ink-faint">Current status: {ALERT_STATUS[selected.status]?.label ?? selected.status}</p>
            </div>
            <fieldset>
              <legend className="field-label">New status</legend>
              <div className="space-y-1.5">
                {NEXT_STATUSES.filter((s) => s !== selected.status).map((s) => (
                  <label key={s} className="flex items-center gap-2">
                    <input type="radio" name="alert-status" checked={nextStatus === s} onChange={() => setNextStatus(s)} className="accent-[#174a85]" />
                    {ALERT_STATUS[s].label}
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField label="Reason" htmlFor="alert-reason" required helperText="Recorded with the status change.">
              <textarea id="alert-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="field-textarea" />
            </FormField>
            {dialogError && <Notice tone="bad">{dialogError}</Notice>}
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { useAuditPage, useVerifyAuditChain } from '../../api/queries';
import type { AuditVerifyView } from '../../api/adapters';
import { describeApiError } from '../../api/errors';
import {
  Button,
  ErrorState,
  FilterBar,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  Skeleton,
} from '../../components/ui';
import { DemoBanner } from '../../components/status';
import { humanize } from '../../components/status/statusMaps';
import { fmtDateTime } from '../../lib/format';
import { IntegrityAuditControl } from '../../components/audit/IntegrityAuditControl';

export const AuditPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [applied, setApplied] = useState<{ action?: string; entityType?: string; entityId?: string }>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [verifyResult, setVerifyResult] = useState<AuditVerifyView | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const q = useAuditPage({ ...applied, page, limit });
  const verify = useVerifyAuditChain();

  const events = q.data?.items ?? [];
  const pagination = q.data?.pagination;

  const runVerify = async () => {
    setVerifyError(null);
    try {
      setVerifyResult(await verify.mutateAsync());
    } catch (err) {
      setVerifyError(describeApiError(err, 'Verification could not be run.').message);
    }
  };

  const applyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    setApplied({ action: action.trim() || undefined, entityType: entityType.trim() || undefined, entityId: entityId.trim() || undefined });
    setPage(1);
  };

  return (
    <div className="page py-6">
      <PageHeader
        title="Audit trail"
        description="Logged actions recorded by the server, with each event's hash and the hash of the event before it."
        breadcrumbs={[{ label: 'Oversight' }, { label: 'Audit trail' }]}
        actions={
          <Button variant="outline" onClick={runVerify} isLoading={verify.isPending}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Verify chain integrity
          </Button>
        }
      />
      <DemoBanner className="mb-4" />

      {verifyError && <Notice tone="bad" className="mb-4">{verifyError}</Notice>}
      {verifyResult && (
        <Notice
          tone={verifyResult.intact ? 'ok' : 'bad'}
          className="mb-4"
          title={verifyResult.intact ? 'Chain verification passed' : 'Chain verification failed'}
          onDismiss={() => setVerifyResult(null)}
        >
          {verifyResult.intact
            ? `The server recomputed the hash chain${typeof verifyResult.totalEvents === 'number' ? ` across ${verifyResult.totalEvents} events` : ''} and found no breaks.`
            : `The chain breaks at event #${verifyResult.brokenAtSeq ?? '?'}${verifyResult.reason ? `: ${verifyResult.reason}` : ''}.`}
          {verifyResult.verifiedAt && <span className="block text-[11.5px] text-ink-faint">Checked {fmtDateTime(verifyResult.verifiedAt)}</span>}
        </Notice>
      )}

      {/* Feature 3: Bureau Director Integrity Audit Control & Breach Alert */}
      <IntegrityAuditControl className="mb-5" />

      <Panel bodyClassName="">
        <form onSubmit={applyFilters}>
          <FilterBar
            className="rounded-none border-0 border-b"
            totalCount={pagination?.totalItems}
            totalLabel="events"
            filtersSlot={
              <>
                <div>
                  <label htmlFor="audit-action" className="field-label">Action</label>
                  <input id="audit-action" className="field-input w-48" placeholder="e.g. LOGIN_SUCCESS" value={action} onChange={(e) => setAction(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="audit-etype" className="field-label">Entity type</label>
                  <input id="audit-etype" className="field-input w-40" placeholder="e.g. Application" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="audit-eid" className="field-label">Entity ID</label>
                  <input id="audit-eid" className="field-input w-56" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
                </div>
                <Button type="submit" variant="outline">Apply filters</Button>
              </>
            }
            activeTags={[
              ...(applied.action ? [{ id: 'a', label: `Action: ${applied.action}`, onRemove: () => { setAction(''); setApplied((p) => ({ ...p, action: undefined })); } }] : []),
              ...(applied.entityType ? [{ id: 't', label: `Entity type: ${applied.entityType}`, onRemove: () => { setEntityType(''); setApplied((p) => ({ ...p, entityType: undefined })); } }] : []),
              ...(applied.entityId ? [{ id: 'i', label: `Entity ID: ${applied.entityId}`, onRemove: () => { setEntityId(''); setApplied((p) => ({ ...p, entityId: undefined })); } }] : []),
            ]}
            onClearAll={() => { setAction(''); setEntityType(''); setEntityId(''); setApplied({}); setPage(1); }}
          />
        </form>

        {q.isError ? (
          <div className="p-4"><ErrorState error={q.error} title="Audit events could not be loaded" onRetry={() => q.refetch()} /></div>
        ) : q.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        ) : events.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-soft">No audit events match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Audit events</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-8"><span className="sr-only">Expand</span></th>
                  <th scope="col">#</th>
                  <th scope="col">Time</th>
                  <th scope="col">Action</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Event hash</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const isOpen = expanded === ev.seq;
                  return (
                    <Fragment key={ev.seq}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : ev.seq)}
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} details for event ${ev.seq}`}
                            className="rounded p-0.5 text-ink-faint hover:bg-brand-50 hover:text-ink"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="tabular-nums">{ev.seq}</td>
                        <td className="whitespace-nowrap">{fmtDateTime(ev.ts)}</td>
                        <td>{humanize(ev.action)}<span className="block font-mono text-[11px] text-ink-faint">{ev.action}</span></td>
                        <td>{ev.entity.type || '—'}<span className="block font-mono text-[11px] text-ink-faint">{ev.entity.id}</span></td>
                        <td>{ev.actor.name || <span className="font-mono text-[12px]">{ev.actor.id || '—'}</span>}<span className="block text-[11px] text-ink-faint">{ev.actor.role}</span></td>
                        <td className="font-mono text-[11.5px] text-ink-faint">{ev.hash ? `${ev.hash.slice(0, 12)}…` : '—'}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="!bg-[#fafbfc]">
                            <dl className="grid gap-2 text-[12px] md:grid-cols-2">
                              <div><dt className="text-ink-faint">Event hash</dt><dd className="break-all font-mono">{ev.hash || '—'}</dd></div>
                              <div><dt className="text-ink-faint">Previous hash</dt><dd className="break-all font-mono">{ev.prevHash || '—'}</dd></div>
                            </dl>
                            <p className="mt-2 text-[12px] text-ink-faint">Payload</p>
                            <pre className="mt-1 max-h-64 overflow-auto rounded border border-line-soft bg-white p-2 font-mono text-[11.5px]">{JSON.stringify(ev.payload, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
      </Panel>
      <p className="mt-2 text-meta text-ink-faint">
        Events are listed as returned by the server. Integrity is established only by running chain verification.
      </p>
    </div>
  );
};

import React, { useState } from 'react';
import { useTriangleFindings } from '../../api/queries';
import type { TriangleView } from '../../api/adapters';
import { Skeleton, ErrorState, FilterSelect } from '../ui';
import { PlaceholderTag, StatusBadge } from '../status';
import { VERIFICATION_STATUS } from '../status/statusMaps';

const NODE_LABELS: Record<string, string> = {
  COLLEGE_CLAIM: 'Institution claim',
  DOCUMENT_OCR: 'Document evidence',
  AICTE_RECORDS: 'AICTE records',
};

/**
 * Three-source comparison. When the server returns explicit nodes
 * (claim / document / record), they are shown side by side. The backend's
 * current /triangle response carries finding data without nodes; in that case
 * the finding statement and its cited evidence are shown instead — nothing is
 * reconstructed or inferred.
 */
export const TrianglePanel: React.FC<{ applicationId: string }> = ({ applicationId }) => {
  const { data: findings = [], isLoading, isError, error, refetch } = useTriangleFindings(applicationId);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} title="Comparison results could not be loaded" onRetry={() => refetch()} />;
  }

  if (findings.length === 0) {
    return <p className="text-sm text-ink-soft">No comparison results have been recorded for this application.</p>;
  }

  const statuses = Array.from(new Set(findings.map((f) => f.status)));
  const filtered = findings.filter((f) => statusFilter === 'ALL' || f.status === statusFilter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'ALL', label: `All (${findings.length})` },
            ...statuses.map((s) => ({ value: s, label: VERIFICATION_STATUS[s]?.label ?? s })),
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">No results match the selected status.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((f: TriangleView) => (
            <li key={f.id} className="rounded border border-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{f.title}</p>
                  {f.claimKey && <p className="font-mono text-[11.5px] text-ink-faint">{f.claimKey}</p>}
                </div>
                <StatusBadge status={f.status} size="sm" />
              </div>

              {f.nodes ? (
                <div className="grid divide-y divide-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {f.nodes.map((n, i) => (
                    <div key={i} className="px-3 py-2.5">
                      <p className="text-meta text-ink-faint">{NODE_LABELS[n.source] ?? n.source}</p>
                      <p className="mt-0.5 font-medium text-ink">{n.value}</p>
                    </div>
                  ))}
                </div>
              ) : f.evidence && f.evidence.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Evidence</th>
                      <th scope="col">Value</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.evidence.map((e: any, i: number) => (
                      <tr key={i}>
                        <td>{e.label}</td>
                        <td className="font-mono">
                          {String(e.value)} {e.unit ?? ''}
                        </td>
                        <td className="text-meta text-ink-soft">
                          {e.recordRef?.sourceLabel ?? (e.source?.docId ? `Doc ${e.source.docId}, p.${e.source.page}` : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

              <div className="space-y-1 px-3 py-2.5 text-sm">
                {f.explanation && <p className="text-ink-soft">{f.explanation}</p>}
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-faint">
                  {f.evidencePage && <span>Evidence: {f.evidencePage}</span>}
                  {f.handbookClause && f.handbookClause !== 'HANDBOOK-REF-TBD' ? (
                    <span>
                      Clause: <span className="font-mono">{f.handbookClause}</span>
                    </span>
                  ) : (
                    <PlaceholderTag />
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

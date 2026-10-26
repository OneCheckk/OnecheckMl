import React from 'react';
import { useRiskScoreBreakdown } from '../../api/queries';
import { Skeleton, ErrorState, Notice } from '../ui';
import { BandChip, PlaceholderTag } from '../status';
import { fmtDateTime } from '../../lib/format';

// Labels and weights from the backend scoring contract (README §5, docs/contract_freeze.md §3).
const PILLARS: Record<string, { label: string; weight: number }> = {
  documentCompleteness: { label: 'Document completeness', weight: 20 },
  anomalyFlags: { label: 'Anomaly flags', weight: 25 },
  sourceVerification: { label: 'Source verification', weight: 20 },
  historicalCompliance: { label: 'Historical compliance', weight: 15 },
  infrastructureEvidence: { label: 'Infrastructure evidence', weight: 20 },
};

export const RiskScorePanel: React.FC<{ applicationId: string }> = ({ applicationId }) => {
  const { data: score, isLoading, isError, error, refetch } = useRiskScoreBreakdown(applicationId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} title="The risk score could not be loaded" onRetry={() => refetch()} />;
  }

  if (!score || !score.isComputed) {
    return (
      <Notice tone="muted" title="No risk score has been computed for this application">
        A score is produced when verification checks are run. The server's placeholder value is not shown because it is
        not the result of an evaluation.
      </Notice>
    );
  }

  const pillarEntries = Object.entries(score.pillarScores ?? {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-line bg-white px-4 py-3">
        <div>
          <p className="text-meta text-ink-faint">Total score</p>
          <p className="text-[24px] font-semibold leading-tight tabular-nums text-brand-900">
            {score.totalScore}
            <span className="text-sm font-normal text-ink-faint"> / 100</span>
          </p>
        </div>
        <div>
          <p className="text-meta text-ink-faint">Risk band</p>
          {score.riskLevel ? <BandChip band={score.riskLevel} /> : <span className="text-ink-faint">—</span>}
        </div>
        <div className="text-meta text-ink-faint">
          <p>Rules version: <span className="font-mono text-ink">{score.rulesVersion ?? '—'}</span></p>
          {score.calculatedAt && <p>Computed {fmtDateTime(score.calculatedAt)}</p>}
        </div>
        <p className="w-full text-[11.5px] text-ink-faint sm:ml-auto sm:w-auto">Bands: red below 50 · yellow 50–79 · green 80 and above</p>
      </div>

      <div className="overflow-x-auto rounded border border-line bg-white">
        <table className="data-table">
          <caption className="sr-only">Pillar sub-scores</caption>
          <thead>
            <tr>
              <th scope="col">Pillar</th>
              <th scope="col" className="text-right">Weight</th>
              <th scope="col">Sub-score (0–100)</th>
            </tr>
          </thead>
          <tbody>
            {pillarEntries.length === 0 ? (
              <tr><td colSpan={3} className="text-ink-soft">The server returned no pillar breakdown.</td></tr>
            ) : (
              pillarEntries.map(([key, val]) => (
                <tr key={key}>
                  <td>{PILLARS[key]?.label ?? key}</td>
                  <td className="text-right tabular-nums text-ink-soft">{PILLARS[key] ? `${PILLARS[key].weight}%` : '—'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-sm bg-line-soft" aria-hidden="true">
                        <div className="h-full bg-brand-600" style={{ width: `${Math.max(0, Math.min(100, Number(val)))}%` }} />
                      </div>
                      <span className="w-10 text-right tabular-nums font-semibold">{val as number}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded border border-line bg-white">
        <table className="data-table">
          <caption className="border-b border-line bg-[#f6f8fa] px-3 py-2 text-left text-[13px] font-semibold text-ink">
            Deductions ({score.deductions.length})
          </caption>
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col">Pillar</th>
              <th scope="col" className="text-right">Points</th>
              <th scope="col">Explanation</th>
              <th scope="col">Handbook reference</th>
            </tr>
          </thead>
          <tbody>
            {score.deductions.length === 0 ? (
              <tr><td colSpan={5} className="text-ink-soft">No deductions were recorded.</td></tr>
            ) : (
              score.deductions.map((d, i) => (
                <tr key={`${d.ruleId}-${i}`}>
                  <td className="font-mono text-[12px]">{d.ruleId}</td>
                  <td>{PILLARS[d.pillar]?.label ?? d.pillar}</td>
                  <td className="text-right tabular-nums font-semibold text-bad">−{d.points}</td>
                  <td className="text-ink-soft">{d.explanation}</td>
                  <td>{d.handbookRef ? <span className="font-mono text-[12px]">{d.handbookRef}</span> : <PlaceholderTag />}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Notice tone="muted">
        The risk score is a decision-support signal computed by the server. It does not approve or reject an application;
        authorised officers make that decision.
      </Notice>
    </div>
  );
};

import React, { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { Finding, Severity } from '@contracts';
import { StatusBadge, StateChip, SeverityChip } from '../status';

interface PassedTrace {
  ruleId?: string;
  title?: string;
  comparedValues?: { field: string; valueA: string | number; valueB: string | number; status: string }[];
}

interface FindingListProps {
  findings: Finding[];
  selectedFindingId?: string;
  onSelectFinding: (finding: Finding) => void;
  /** Passed-check trace returned by the server (application.lastTrace). Omitted when not available. */
  passedChecks?: PassedTrace[];
  passedChecksCount?: number;
}

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export const FindingList: React.FC<FindingListProps> = ({ findings, selectedFindingId, onSelectFinding, passedChecks }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [openOnly, setOpenOnly] = useState<boolean>(false);
  const [showPassed, setShowPassed] = useState<boolean>(false);

  const filtered = findings.filter(
    (f) => (filterSeverity === 'ALL' || f.severity === filterSeverity) && (!openOnly || f.state === 'OPEN')
  );
  const openCount = findings.filter((f) => f.state === 'OPEN').length;

  return (
    <div data-testid="finding-list" className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-line bg-white">
      <div className="border-b border-line bg-[#f6f8fa] px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13.5px] font-semibold text-ink">Findings ({findings.length})</h2>
          <span className="text-[11.5px] text-ink-faint">{openCount} awaiting disposition</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label="Filter by severity">
          {['ALL', ...SEVERITY_ORDER].map((sev) => {
            const count = sev === 'ALL' ? findings.length : findings.filter((f) => f.severity === sev).length;
            if (sev !== 'ALL' && count === 0) return null;
            const active = filterSeverity === sev;
            return (
              <button
                key={sev}
                type="button"
                aria-pressed={active}
                onClick={() => setFilterSeverity(sev)}
                className={clsx(
                  'rounded-sm border px-1.5 py-0.5 text-[12px]',
                  active ? 'border-brand-700 bg-brand-700 text-white' : 'border-line-strong bg-white text-ink-soft hover:bg-brand-50'
                )}
              >
                {sev === 'ALL' ? 'All' : sev.charAt(0) + sev.slice(1).toLowerCase()} <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        <label className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-soft">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-3.5 w-3.5 accent-[#174a85]" />
          Show only findings awaiting disposition
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {findings.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-soft">
            No findings have been recorded for this application. Run checks to evaluate it.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-soft">No findings match the current filters.</p>
        ) : (
          SEVERITY_ORDER.map((sev) => {
            const items = filtered.filter((f) => f.severity === sev);
            if (items.length === 0) return null;
            return (
              <section key={sev} aria-label={`${sev.toLowerCase()} severity findings`}>
                <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-line-soft bg-white/95 px-3 py-1.5">
                  <SeverityChip severity={sev} />
                  <span className="text-[11.5px] text-ink-faint">{items.length}</span>
                </div>
                <ul>
                  {items.map((finding) => {
                    const isSelected = selectedFindingId === finding.findingId;
                    return (
                      <li key={finding.findingId}>
                        <button
                          type="button"
                          onClick={() => onSelectFinding(finding)}
                          aria-current={isSelected ? 'true' : undefined}
                          className={clsx(
                            'w-full border-b border-l-[3px] border-b-line-soft px-3 py-2.5 text-left',
                            isSelected ? 'border-l-brand-700 bg-brand-50' : 'border-l-transparent hover:bg-[#f6f8fa]'
                          )}
                        >
                          <span className="block text-[13px] font-semibold leading-snug text-ink">{finding.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1">
                            <StatusBadge status={finding.status} size="sm" />
                            <StateChip state={finding.state} />
                          </span>
                          <span className="mt-1 block font-mono text-[11px] text-ink-faint">{finding.ruleId}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        {passedChecks && passedChecks.length > 0 && (
          <div className="border-t border-line p-2">
            <button
              type="button"
              onClick={() => setShowPassed((v) => !v)}
              aria-expanded={showPassed}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[12.5px] font-semibold text-ok hover:bg-ok-bg"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Checks passed ({passedChecks.length})
              </span>
              {showPassed ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {showPassed && (
              <ul className="mt-1 divide-y divide-line-soft rounded border border-line-soft text-[12px]">
                {passedChecks.map((t, i) => (
                  <li key={t.ruleId ?? i} className="px-2 py-1.5">
                    <span className="block text-ink">{t.title ?? t.ruleId}</span>
                    {t.ruleId && <span className="font-mono text-[11px] text-ink-faint">{t.ruleId}</span>}
                    {t.comparedValues?.map((c, j) => (
                      <span key={j} className="block text-[11.5px] text-ink-soft">
                        {c.field}: {String(c.valueA)} = {String(c.valueB)}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

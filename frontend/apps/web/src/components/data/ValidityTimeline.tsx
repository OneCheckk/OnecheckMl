import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ValidityRecord } from '@contracts';
import { apiClient } from '../../api/client';
import { demoOffsetPayload } from '../../api/queries';
import { errorMessage } from '../../api/errors';
import { StatusPill } from '../status';
import { Button, Notice } from '../ui';
import { fmtDate } from '../../lib/format';

interface ValidityTimelineProps {
  applicationId: string;
  records: ValidityRecord[];
  /** Show the demonstration decision-date control (officer/admin, demo deployments). */
  isDemoMode?: boolean;
}

const pos = (date: string, start: number, span: number) => {
  const t = new Date(date).getTime();
  if (Number.isNaN(t) || span <= 0) return null;
  return Math.max(0, Math.min(100, ((t - start) / span) * 100));
};

export const ValidityTimeline: React.FC<ValidityTimelineProps> = ({ applicationId, records, isDemoMode = false }) => {
  const queryClient = useQueryClient();
  const [offsetDays, setOffsetDays] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  // Applies the demo decision-date offset only when the officer chooses to.
  const apply = async () => {
    setIsUpdating(true);
    setMsg(null);
    try {
      await apiClient.put('/demo/settings', demoOffsetPayload(offsetDays));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['validity', applicationId] }),
        queryClient.invalidateQueries({ queryKey: ['findings', applicationId] }),
      ]);
      setMsg({ tone: 'ok', text: `Evaluation date moved ${offsetDays} days forward. Validity is re-read from the server.` });
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err, 'The evaluation date could not be changed.') });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div data-testid="validity-timeline" className="space-y-4">
      {isDemoMode && (
        <div className="rounded border border-line bg-white p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="validity-offset" className="field-label">Demonstration: evaluate validity at a later date</label>
              <div className="flex items-center gap-3">
                <input
                  id="validity-offset"
                  type="range"
                  min={0}
                  max={180}
                  step={5}
                  value={offsetDays}
                  onChange={(e) => setOffsetDays(Number(e.target.value))}
                  className="w-full accent-[#174a85]"
                  aria-valuetext={`${offsetDays} days`}
                />
                <span className="w-16 text-right font-mono text-[13px]">+{offsetDays} d</span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={apply} isLoading={isUpdating}>
              Apply
            </Button>
          </div>
          <p className="field-help">Changes the server's demonstration clock for all users of this deployment.</p>
          {msg && <Notice tone={msg.tone} className="mt-2">{msg.text}</Notice>}
        </div>
      )}

      {records.length === 0 ? (
        <p className="rounded border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft">
          No certificate validity records have been computed for this application.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft rounded border border-line bg-white">
          {records.map((rec) => {
            const dates = [rec.validFrom, rec.validUntil, rec.approvalPeriod?.start, rec.approvalPeriod?.end]
              .map((d) => (d ? new Date(d).getTime() : NaN))
              .filter((t) => !Number.isNaN(t));
            const start = Math.min(...dates);
            const span = Math.max(...dates) - start;
            const v0 = rec.validFrom ? pos(rec.validFrom, start, span) : null;
            const v1 = rec.validUntil ? pos(rec.validUntil, start, span) : null;
            const a0 = rec.approvalPeriod?.start ? pos(rec.approvalPeriod.start, start, span) : null;
            const a1 = rec.approvalPeriod?.end ? pos(rec.approvalPeriod.end, start, span) : null;
            return (
              <li key={rec.docId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{rec.documentName}</p>
                    <p className="font-mono text-[11.5px] text-ink-faint">Doc {rec.docId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill domain="validity" value={rec.state} />
                    {typeof rec.daysRemaining === 'number' && (
                      <span className="text-meta text-ink-soft tabular-nums">
                        {rec.daysRemaining >= 0 ? `${rec.daysRemaining} days remaining` : `${Math.abs(rec.daysRemaining)} days past expiry`}
                      </span>
                    )}
                  </div>
                </div>

                {v0 !== null && v1 !== null && (
                  <div className="mt-3" aria-hidden="true">
                    <div className="relative h-6">
                      {a0 !== null && a1 !== null && (
                        <div className="absolute top-0 h-6 rounded-sm border border-dashed border-brand-300 bg-brand-50" style={{ left: `${a0}%`, width: `${Math.max(0.5, a1 - a0)}%` }} />
                      )}
                      <div
                        className={`absolute top-2 h-2 rounded-sm ${rec.state === 'VALID' ? 'bg-ok' : rec.state === 'EXPIRED' ? 'bg-bad' : 'bg-warn'}`}
                        style={{ left: `${v0}%`, width: `${Math.max(0.5, v1 - v0)}%` }}
                      />
                    </div>
                  </div>
                )}
                <dl className="mt-1 grid grid-cols-1 gap-x-6 text-[12px] text-ink-soft sm:grid-cols-3">
                  <div><dt className="inline text-ink-faint">Valid from: </dt><dd className="inline">{fmtDate(rec.validFrom)}</dd></div>
                  <div><dt className="inline text-ink-faint">Valid until: </dt><dd className="inline">{fmtDate(rec.validUntil)}</dd></div>
                  <div><dt className="inline text-ink-faint">Approval period: </dt><dd className="inline">{fmtDate(rec.approvalPeriod?.start)} – {fmtDate(rec.approvalPeriod?.end)}</dd></div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
      {records.length > 0 && (
        <p className="text-[11.5px] text-ink-faint">Solid bar: certificate validity. Dashed band: approval period being evaluated.</p>
      )}
    </div>
  );
};

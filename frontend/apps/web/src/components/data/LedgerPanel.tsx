import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';
import type { LedgerEntry } from '@contracts';
import { StatusBadge, SyntheticTag } from '../status';
import { humanize } from '../status/statusMaps';
import { Button, FormField, Modal, Notice } from '../ui';
import { errorMessage } from '../../api/errors';
import { fmtDateTime } from '../../lib/format';

interface LedgerPanelProps {
  entries: LedgerEntry[];
  /** When omitted, manual confirmation is not offered. */
  onManualConfirm?: (entryId: string, outcome: 'CONFIRMED' | 'REJECTED', note: string) => Promise<void>;
}

const NOTE_MIN = 10; // backend ledger.service.manualConfirmEntry

export const LedgerPanel: React.FC<LedgerPanelProps> = ({ entries, onManualConfirm }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogEntry, setDialogEntry] = useState<LedgerEntry | null>(null);
  const [outcome, setOutcome] = useState<'CONFIRMED' | 'REJECTED'>('CONFIRMED');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!dialogEntry || !onManualConfirm) return;
    if (note.trim().length < NOTE_MIN) {
      setError(`A verification note of at least ${NOTE_MIN} characters is required.`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onManualConfirm(dialogEntry.id, outcome, note.trim());
      setDialogEntry(null);
      setNote('');
    } catch (err) {
      setError(errorMessage(err, 'The confirmation could not be recorded.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (entries.length === 0) {
    return (
      <p data-testid="ledger-panel" className="rounded border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft">
        No source verification entries have been recorded for this application.
      </p>
    );
  }

  return (
    <div data-testid="ledger-panel" className="overflow-hidden rounded border border-line bg-white">
      <ul className="divide-y divide-line-soft">
        {entries.map((entry) => {
          const isOpen = !!expanded[entry.id];
          const needsOfficer = ['MANUAL_REVIEW_REQUIRED', 'BLOCKED_LOW_CONFIDENCE', 'SOURCE_UNAVAILABLE'].includes(entry.status);
          return (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={entry.status} size="sm" />
                    <span className="font-semibold text-ink">{humanize(entry.checkType)}</span>
                    {entry.docId && <span className="font-mono text-[11.5px] text-ink-faint">Doc {entry.docId}</span>}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-meta text-ink-soft">
                    Source: {entry.source?.label ?? '—'}
                    {entry.source?.kind === 'SYNTHETIC_DEMO' && <SyntheticTag />}
                  </p>
                </div>
                <p className="text-[11.5px] text-ink-faint">
                  Requested {fmtDateTime(entry.requestedAt)}
                  {entry.respondedAt && <> · Responded {fmtDateTime(entry.respondedAt)}</>}
                </p>
              </div>

              <dl className="mt-2 grid gap-2 text-[12.5px] md:grid-cols-2">
                <div>
                  <dt className="text-ink-faint">Request</dt>
                  <dd className="text-ink">{entry.requestSummary || '—'}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Response</dt>
                  <dd className="text-ink">{entry.responseSummary || (entry.respondedAt ? '—' : 'No response received')}</dd>
                </div>
              </dl>

              {entry.manual && (
                <p className="mt-2 rounded border border-line-soft bg-[#fafbfc] px-2.5 py-1.5 text-[12.5px]">
                  <span className="font-semibold">Manual {entry.manual.state === 'CONFIRMED' ? 'confirmation' : 'rejection'}</span> by officer
                  {entry.manual.timestamp && <> on {fmtDateTime(entry.manual.timestamp)}</>}: {entry.manual.note}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-3">
                {needsOfficer && onManualConfirm && !entry.manual && (
                  <Button variant="outline" size="sm" onClick={() => { setDialogEntry(entry); setError(null); setOutcome('CONFIRMED'); }}>
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    Record manual verification
                  </Button>
                )}
                {entry.earlierResults && entry.earlierResults.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [entry.id]: !p[entry.id] }))}
                    aria-expanded={isOpen}
                    className="link inline-flex items-center gap-0.5 text-[12.5px]"
                  >
                    Earlier results ({entry.earlierResults.length})
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              {isOpen && entry.earlierResults && (
                <table className="data-table mt-2 rounded border border-line-soft">
                  <thead><tr><th>When</th><th>Status</th><th>Note</th></tr></thead>
                  <tbody>
                    {entry.earlierResults.map((h, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{fmtDateTime(h.timestamp)}</td>
                        <td><StatusBadge status={h.status} size="sm" /></td>
                        <td className="text-ink-soft">{h.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          );
        })}
      </ul>

      <Modal
        isOpen={!!dialogEntry}
        onClose={() => setDialogEntry(null)}
        title="Record manual verification"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDialogEntry(null)} disabled={isSubmitting}>Cancel</Button>
            <Button size="sm" onClick={submit} isLoading={isSubmitting}>Save verification</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-ink-soft">
            For <strong className="text-ink">{humanize(dialogEntry?.checkType)}</strong>
            {dialogEntry?.docId && <> (Doc {dialogEntry.docId})</>}. Record the outcome of your verification through an
            official channel. This replaces the automated status and is logged.
          </p>
          <fieldset>
            <legend className="field-label">Outcome</legend>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2"><input type="radio" name="ledger-outcome" checked={outcome === 'CONFIRMED'} onChange={() => setOutcome('CONFIRMED')} className="accent-[#174a85]" /> Confirmed — the source verifies the document</label>
              <label className="flex items-center gap-2"><input type="radio" name="ledger-outcome" checked={outcome === 'REJECTED'} onChange={() => setOutcome('REJECTED')} className="accent-[#174a85]" /> Rejected — the source does not verify the document</label>
            </div>
          </fieldset>
          <FormField label="Verification note" htmlFor="ledger-note" required helperText={`At least ${NOTE_MIN} characters, e.g. reference of the official communication.`}>
            <textarea id="ledger-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="field-textarea" />
          </FormField>
          {error && <Notice tone="bad">{error}</Notice>}
        </div>
      </Modal>
    </div>
  );
};

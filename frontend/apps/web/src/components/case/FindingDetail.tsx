import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, HelpCircle, ArrowRight } from 'lucide-react';
import type { Finding, FindingEvidence } from '@contracts';
import { StatusBadge, SeverityChip, StateChip, PlaceholderTag } from '../status';
import { Button, FormField, Notice } from '../ui';
import { errorMessage } from '../../api/errors';

interface FindingDetailProps {
  finding?: Finding;
  onSelectEvidence?: (evidence: FindingEvidence) => void;
  onDisposition: (state: string, reason?: string) => Promise<void>;
  onRequestClarification?: () => void;
  /** Hide disposition controls (role not permitted) */
  canDecide?: boolean;
}

export const FindingDetail: React.FC<FindingDetailProps> = ({
  finding,
  onSelectEvidence,
  onDisposition,
  onRequestClarification,
  canDecide = true,
}) => {
  const [dismissReason, setDismissReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showDismissInput, setShowDismissInput] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setShowDismissInput(false);
    setDismissReason('');
    setErrorMsg(null);
    setSavedMsg(null);
  }, [finding?.findingId]);

  if (!finding) {
    return (
      <div data-testid="finding-detail-empty" className="flex h-full items-center justify-center rounded border border-line bg-white p-6 text-center text-sm text-ink-soft">
        Select a finding to see its proof, cited evidence and disposition.
      </div>
    );
  }

  const record = async (state: string, reason?: string) => {
    setErrorMsg(null);
    setSavedMsg(null);
    setIsSubmitting(true);
    try {
      await onDisposition(state, reason);
      setSavedMsg(state === 'ACCEPTED' ? 'Disposition recorded: accepted.' : state === 'DISMISSED' ? 'Disposition recorded: dismissed.' : 'Disposition recorded.');
      setShowDismissInput(false);
      setDismissReason('');
    } catch (err) {
      setErrorMsg(errorMessage(err, 'The disposition could not be recorded.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    if (dismissReason.trim().length < 10) {
      setErrorMsg('A mandatory justification of at least 10 characters is required to dismiss a regulatory finding.');
      return;
    }
    record('DISMISSED', dismissReason.trim());
  };

  const clauseKnown = finding.clauseRef && finding.clauseRef !== 'HANDBOOK-REF-TBD' && !finding.placeholder;

  return (
    <div data-testid="finding-detail" className="flex h-full min-h-0 flex-col overflow-y-auto rounded border border-line bg-white text-sm">
      <div className="border-b border-line bg-[#f6f8fa] px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <SeverityChip severity={finding.severity} />
          <StatusBadge status={finding.status} size="sm" />
          <StateChip state={finding.state} />
        </div>
        <h2 className="mt-2 text-[15px] font-semibold leading-snug text-ink">{finding.title}</h2>
        <p className="mt-1 text-ink-soft">{finding.message}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-faint">
          <span>
            Rule <span className="font-mono">{finding.ruleId}</span>
            {finding.ruleVersion && <> v{finding.ruleVersion}</>}
          </span>
          {finding.rulepackVersion && <span>Rulepack {finding.rulepackVersion}</span>}
          {clauseKnown ? (
            <span>
              Clause <span className="font-mono">{finding.clauseRef}</span>
            </span>
          ) : (
            <PlaceholderTag />
          )}
        </p>
      </div>

      <div className="flex-1 space-y-4 px-4 py-3">
        {finding.proof.statement && (
          <section>
            <h3 className="text-[12.5px] font-semibold text-ink">Proof statement</h3>
            <p className="mt-1 rounded border border-line-soft bg-[#fafbfc] px-2.5 py-2 font-mono text-[12px] text-ink">{finding.proof.statement}</p>
          </section>
        )}

        {finding.proof.computation && (
          <section>
            <h3 className="text-[12.5px] font-semibold text-ink">Computation (as returned by the server)</h3>
            <dl className="mt-1 grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 rounded border border-line-soft px-2.5 py-2 text-[12.5px]">
              <dt className="text-ink-faint">Formula</dt>
              <dd className="font-mono">{finding.proof.computation.formula}</dd>
              <dt className="text-ink-faint">Inputs</dt>
              <dd className="break-all font-mono">{JSON.stringify(finding.proof.computation.inputs)}</dd>
              <dt className="text-ink-faint">Result</dt>
              <dd className="font-mono font-semibold">{String(finding.proof.computation.result)}</dd>
            </dl>
          </section>
        )}

        <section>
          <h3 className="text-[12.5px] font-semibold text-ink">Cited evidence ({finding.proof.evidence.length})</h3>
          {finding.proof.evidence.length === 0 ? (
            <p className="mt-1 text-meta text-ink-faint">No evidence items were attached to this finding.</p>
          ) : (
            <ul className="mt-1 divide-y divide-line-soft rounded border border-line-soft">
              {finding.proof.evidence.map((ev, idx) => (
                <li key={idx} className="px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink">{ev.label}</span>
                    <span className="whitespace-nowrap font-mono text-[12.5px]">
                      {String(ev.value)} {ev.unit ?? ''}
                    </span>
                  </div>
                  {ev.source?.snippet && <p className="mt-0.5 text-[12px] text-ink-soft">“{ev.source.snippet}”</p>}
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-faint">
                    <span>
                      {ev.source?.docId ? `Doc ${ev.source.docId}, page ${ev.source.page}` : 'No document reference'}
                      {typeof ev.confidence === 'number' && ` · confidence ${Math.round(ev.confidence * 100)}%`}
                    </span>
                    {ev.source?.docId && onSelectEvidence && (
                      <button type="button" onClick={() => onSelectEvidence(ev)} className="link inline-flex items-center gap-0.5 text-[12px]">
                        Show in document <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-t border-line pt-3">
          <h3 className="text-[12.5px] font-semibold text-ink">Officer disposition</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            A disposition records your assessment of this system finding. It is not the decision on the application.
          </p>

          {finding.dismissalReason && (
            <p className="mt-2 rounded border border-line-soft bg-[#fafbfc] px-2.5 py-2 text-[12.5px]">
              <span className="font-semibold">Recorded reason: </span>
              {finding.dismissalReason}
            </p>
          )}
          {finding.officerNotes && (
            <p className="mt-2 text-[12.5px] text-ink-soft">
              <span className="font-semibold text-ink">Officer notes: </span>
              {finding.officerNotes}
            </p>
          )}

          {errorMsg && <Notice tone="bad" className="mt-2">{errorMsg}</Notice>}
          {savedMsg && <Notice tone="ok" className="mt-2">{savedMsg}</Notice>}

          {!canDecide ? (
            <p className="mt-2 text-meta text-ink-faint">Your role cannot record dispositions.</p>
          ) : !showDismissInput ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => record('ACCEPTED')} disabled={isSubmitting || finding.state === 'ACCEPTED'} isLoading={isSubmitting}>
                <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Accept Finding
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowDismissInput(true)} disabled={isSubmitting || finding.state === 'DISMISSED'}>
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Dismiss…
              </Button>
              {onRequestClarification && (
                <Button variant="outline" size="sm" onClick={onRequestClarification} disabled={isSubmitting}>
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Include in deficiency letter
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2 rounded border border-line p-2.5">
              <FormField label="Reason for dismissal" htmlFor="dismiss-reason" required helperText="At least 10 characters. Recorded in the audit trail.">
                <textarea
                  id="dismiss-reason"
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  rows={3}
                  className="field-textarea text-[13px]"
                  placeholder="State the basis, for example the document that resolves the discrepancy."
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowDismissInput(false); setErrorMsg(null); }} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={handleDismiss} isLoading={isSubmitting}>
                  Confirm dismissal
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

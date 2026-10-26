import React from 'react';
import type { Finding, FindingEvidence } from '@contracts';
import { StatusBadge, SyntheticTag } from '../status';

type EvidenceWithRecord = FindingEvidence & {
  recordRef?: { recordType?: string | null; sourceLabel?: string | null; kind?: string | null; fetchedAt?: string | null };
};

const originOf = (ev: EvidenceWithRecord) => {
  if (ev.recordRef?.sourceLabel || ev.recordRef?.recordType) {
    return { kind: 'record' as const, label: ev.recordRef.sourceLabel ?? ev.recordRef.recordType ?? 'Record' };
  }
  // Declarations filed by the institution (self-disclosure / affidavit) are its claims.
  if (['APPLICATION_FORM', 'SELF_DISCLOSURE_FORM', 'AFFIDAVIT_UNDERTAKING'].includes(ev.source?.docType ?? '')) {
    return { kind: 'claim' as const, label: ev.source?.docId ? `Doc ${ev.source.docId}, p.${ev.source.page}` : 'Application' };
  }
  return { kind: 'document' as const, label: ev.source?.docId ? `Doc ${ev.source.docId}, p.${ev.source.page}` : '—' };
};

const ORIGIN_LABEL = { claim: 'Institution claim', document: 'Document evidence', record: 'AICTE record' };

/**
 * Evidence-linked comparison of every value cited by a finding. Values are shown
 * exactly as returned by the server; no comparison is recomputed here.
 */
export const EvidenceCompare: React.FC<{
  finding: Finding;
  onSelectEvidence?: (ev: FindingEvidence) => void;
}> = ({ finding, onSelectEvidence }) => {
  const evidence = finding.proof.evidence as EvidenceWithRecord[];
  return (
    <div data-testid="evidence-compare" className="overflow-hidden rounded border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-[#f6f8fa] px-3 py-2">
        <h3 className="text-[13.5px] font-semibold text-ink">Values compared for this finding</h3>
        <StatusBadge status={finding.status} size="sm" />
      </div>
      {evidence.length === 0 ? (
        <p className="px-3 py-4 text-sm text-ink-soft">The server did not attach evidence values to this finding.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Source type</th>
                <th scope="col">Evidence</th>
                <th scope="col">Value</th>
                <th scope="col">Where it comes from</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((ev, i) => {
                const origin = originOf(ev);
                return (
                  <tr key={i}>
                    <td className="whitespace-nowrap text-[12.5px] font-semibold text-brand-900">{ORIGIN_LABEL[origin.kind]}</td>
                    <td>
                      <span className="block text-ink">{ev.label}</span>
                      {ev.source?.snippet && <span className="block text-[12px] text-ink-soft">“{ev.source.snippet}”</span>}
                    </td>
                    <td className="whitespace-nowrap font-mono text-[13.5px] font-semibold">
                      {String(ev.value)} {ev.unit ?? ''}
                      {typeof ev.confidence === 'number' && origin.kind !== 'record' && (
                        <span className="block font-sans text-[11.5px] font-normal text-ink-faint">
                          Extraction confidence {Math.round(ev.confidence * 100)}%
                        </span>
                      )}
                    </td>
                    <td className="text-[12.5px]">
                      {origin.kind === 'record' ? (
                        <span className="flex flex-col items-start gap-1">
                          {origin.label}
                          {ev.recordRef?.kind === 'SYNTHETIC_DEMO' && <SyntheticTag />}
                        </span>
                      ) : ev.source?.docId && onSelectEvidence ? (
                        <button type="button" className="link" onClick={() => onSelectEvidence(ev)}>
                          {origin.label}
                        </button>
                      ) : (
                        origin.label
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="space-y-1 border-t border-line-soft px-3 py-2.5 text-sm">
        <p>
          <span className="font-semibold text-ink">Result: </span>
          <span className="text-ink-soft">{finding.message}</span>
        </p>
        {finding.proof.computation && (
          <p className="text-[12.5px] text-ink-soft">
            Rule computation (from server): <span className="font-mono">{finding.proof.computation.formula}</span> with inputs{' '}
            <span className="font-mono">{JSON.stringify(finding.proof.computation.inputs)}</span> ={' '}
            <span className="font-mono font-semibold text-ink">{String(finding.proof.computation.result)}</span>
          </p>
        )}
      </div>
    </div>
  );
};

interface RecordEvidenceCardProps {
  label: string;
  value: string | number;
  sourceLabel?: string;
  timestamp?: string;
  isDemo?: boolean;
}

/** Displays a record value exactly as supplied by the caller. */
export const RecordEvidenceCard: React.FC<RecordEvidenceCardProps> = ({ label, value, sourceLabel, timestamp, isDemo }) => (
  <div data-testid="record-evidence-card" className="rounded border border-line bg-white px-3 py-2.5 text-sm">
    <div className="flex items-center justify-between gap-2">
      <span className="font-semibold text-ink">{label}</span>
      {isDemo && <SyntheticTag />}
    </div>
    <p className="mt-0.5 font-mono font-semibold">{value}</p>
    {(sourceLabel || timestamp) && (
      <p className="mt-1 text-[11.5px] text-ink-faint">
        {sourceLabel}
        {timestamp && ` · ${new Date(timestamp).toLocaleDateString('en-IN')}`}
      </p>
    )}
  </div>
);

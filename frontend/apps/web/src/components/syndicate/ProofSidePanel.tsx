import React, { useState } from 'react';
import {
  X,
  Building2,
  UserCheck,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Fingerprint,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Button, Notice, Skeleton } from '../ui';
import { useSyndicateNodeProof } from '../../api/queries';

interface ProofSidePanelProps {
  nodeId: string | null;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

export const ProofSidePanel: React.FC<ProofSidePanelProps> = ({
  nodeId,
  onClose,
  onSelectNode,
}) => {
  const { data: proof, isLoading, isError } = useSyndicateNodeProof(nodeId);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  if (!nodeId) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-white shadow-2xl transition-all duration-300 md:w-[440px]"
      role="dialog"
      aria-labelledby="proof-panel-title"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-slate-50/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-900 text-white shadow-sm">
            {proof?.type === 'faculty' ? (
              <Fingerprint className="h-4 w-4 text-rose-400" />
            ) : (
              <Building2 className="h-4 w-4 text-blue-400" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {proof?.type === 'faculty' ? 'Faculty Hash Dossier' : 'Institutional Node Dossier'}
            </span>
            <h2 id="proof-panel-title" className="text-sm font-bold text-ink">
              Definitive Regulatory Proof
            </h2>
          </div>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="rounded-lg p-1.5 text-ink-faint hover:bg-slate-200 hover:text-ink"
          aria-label="Close panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : isError || !proof ? (
          <Notice tone="bad">Could not retrieve node evidence dossier from the graph engine.</Notice>
        ) : proof.type === 'college' ? (
          /* College Dossier */
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-800">
                  {proof.id}
                </span>
                {proof.isCartelMember && (
                  <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                    <ShieldAlert className="h-3 w-3" />
                    CARTEL RING PARTICIPANT
                  </span>
                )}
              </div>
              <h3 className="mt-1.5 text-base font-bold text-slate-900 leading-snug">
                {proof.name}
              </h3>
              <p className="text-xs text-ink-faint">
                {proof.city}, {proof.state} • Reg ID: <span className="font-mono">{proof.registrationId}</span>
              </p>
            </div>

            {/* Risk & Severity Metrics */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-slate-50/60 p-3">
              <div className="rounded-lg bg-white p-2.5 shadow-xs border border-line-soft">
                <span className="text-[11px] text-ink-faint">Risk Assessment</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl font-black text-rose-600 tabular-nums">
                    {proof.riskScore}
                  </span>
                  <span className="text-[11px] font-semibold text-rose-700">/ 100 ({proof.riskLevel})</span>
                </div>
              </div>
              <div className="rounded-lg bg-white p-2.5 shadow-xs border border-line-soft">
                <span className="text-[11px] text-ink-faint">Ghost Faculty Overlaps</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl font-black text-brand-900 tabular-nums">
                    {proof.sharedFacultyCount}
                  </span>
                  <span className="text-[11px] text-ink-soft">of {proof.facultyCount} rostered</span>
                </div>
              </div>
            </div>

            {/* Definitive Proof Box */}
            <div className={`rounded-xl border p-4 ${
              proof.isCartelMember
                ? 'border-rose-200 bg-rose-50/50 text-rose-950'
                : 'border-blue-200 bg-blue-50/50 text-blue-950'
            }`}>
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className={`h-4 w-4 ${proof.isCartelMember ? 'text-rose-600' : 'text-blue-600'}`} />
                Autonomous Graph Finding
              </div>
              <p className="mt-1.5 text-xs leading-relaxed font-medium">
                {proof.definitiveProof.statement}
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-rose-200/60">
                <span className="text-ink-soft">Recommended Protocol:</span>
                <span className="font-bold font-mono text-rose-700">
                  {proof.definitiveProof.recommendedAction}
                </span>
              </div>
            </div>

            {/* Colluding Institutions */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-brand-700" />
                Colluding Syndicate Institutions ({proof.colludingInstitutions?.length ?? 0})
              </h4>
              {(proof.colludingInstitutions?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>No colluding or shared syndicate links detected. Fully compliant standalone institution.</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {proof.colludingInstitutions.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => onSelectNode(c.id)}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-line bg-white p-2.5 text-left text-xs transition hover:border-brand-500 hover:bg-brand-50/50"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-ink truncate">{c.name}</p>
                        <p className="text-[11px] text-ink-faint">{c.state} • Score: {c.riskScore}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Shared Faculty Hashes */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2 flex items-center gap-1.5">
                <Fingerprint className="h-3.5 w-3.5 text-rose-600" />
                {proof.isCartelMember ? 'Shared Ghost Faculty Hashes' : 'Verified Faculty Roster Hashes'} ({proof.facultyList?.length ?? 0})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(proof.facultyList || []).map((f: any) => (
                  <div
                    key={f.id}
                    className="rounded-lg border border-line bg-white p-2.5 text-xs shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">{f.name}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        f.isGhost ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {f.identifierType} {f.isGhost ? 'GHOST' : 'VERIFIED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-faint">{f.department}</p>
                    <div className="flex items-center justify-between rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                      <span className="truncate max-w-[260px]">{f.hash}</span>
                      <button
                        onClick={() => handleCopy(f.hash)}
                        type="button"
                        className="ml-2 text-ink-faint hover:text-ink"
                        title="Copy cryptographic hash"
                      >
                        {copiedHash === f.hash ? (
                          <Check className="h-3.5 w-3.5 text-ok" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex justify-end">
                      {f.isGhost ? (
                        <button
                          onClick={() => onSelectNode(f.id)}
                          className="text-[11px] text-brand-700 font-semibold hover:underline inline-flex items-center gap-1"
                          type="button"
                        >
                          Inspect Faculty Node <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-medium inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> Unique Roster Record
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Faculty Dossier */
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-rose-100 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-800">
                  {proof.identifierType} IDENTIFIER HASH
                </span>
                {proof.isGhost && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    GHOST ROSTER FLAG
                  </span>
                )}
              </div>
              <h3 className="mt-1.5 text-base font-bold text-slate-900">
                {proof.name}
              </h3>
              <p className="text-xs text-ink-faint">
                Department: {proof.department}
              </p>
            </div>

            {/* Cryptographic Hash Card */}
            <div className="rounded-xl border border-line bg-slate-900 p-3.5 text-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>SHA-256 HMAC Hash (Privacy Preserved)</span>
                <button
                  onClick={() => handleCopy(proof.hash)}
                  type="button"
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                >
                  {copiedHash === proof.hash ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="break-all font-mono text-[11px] text-amber-300">
                {proof.hash}
              </p>
            </div>

            {/* Definitive Proof Statement */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-rose-950">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-rose-700">
                <ShieldAlert className="h-4 w-4" />
                Duplication Collision Proof
              </div>
              <p className="mt-2 text-xs leading-relaxed font-medium">
                {proof.definitiveProof.statement}
              </p>
            </div>

            {/* Colleges Sharing this Faculty */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-brand-700" />
                Claiming Institutions ({proof.associatedColleges.length})
              </h4>
              <div className="space-y-2">
                {proof.associatedColleges.map((col: any) => (
                  <div
                    key={col.id}
                    className="flex items-center justify-between rounded-lg border border-line bg-white p-3 text-xs shadow-2xs"
                  >
                    <div>
                      <p className="font-bold text-ink">{col.name}</p>
                      <p className="text-[11px] text-ink-faint">
                        {col.state} • Risk Score: {col.riskScore}
                      </p>
                    </div>
                    <button
                      onClick={() => onSelectNode(col.id)}
                      type="button"
                      className="rounded bg-brand-50 px-2 py-1 font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      View Node
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line bg-slate-50 p-4 flex items-center justify-between">
        <span className="text-[11px] text-ink-faint">
          OneCheck Graph Evidence Protocol
        </span>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close Dossier
        </Button>
      </div>
    </aside>
  );
};

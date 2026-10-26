import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
  Key,
  Wrench,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Database
} from 'lucide-react';
import { Button, Notice } from '../ui';
import {
  useRunIntegrityAudit,
  useSimulateDbaTamper,
  useRepairApplication,
  type IntegrityAuditResult
} from '../../api/queries';

interface IntegrityAuditControlProps {
  className?: string;
  variant?: 'banner' | 'card' | 'compact';
}

export const IntegrityAuditControl: React.FC<IntegrityAuditControlProps> = ({
  className = '',
  variant = 'card',
}) => {
  const auditMutation = useRunIntegrityAudit();
  const tamperMutation = useSimulateDbaTamper();
  const repairMutation = useRepairApplication();

  const [auditResult, setAuditResult] = useState<IntegrityAuditResult | null>(null);
  const [showSimulateOptions, setShowSimulateOptions] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleRunAudit = async () => {
    try {
      const res = await auditMutation.mutateAsync();
      setAuditResult(res);
    } catch (err: any) {
      // In case of error response that carries data
      if (err?.response?.data) {
        setAuditResult(err.response.data as IntegrityAuditResult);
      }
    }
  };

  const handleSimulateTamper = async () => {
    try {
      await tamperMutation.mutateAsync();
      // Automatically re-run audit to trigger the alert immediately
      const res = await auditMutation.mutateAsync();
      setAuditResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepair = async (appId: string) => {
    try {
      await repairMutation.mutateAsync(appId);
      // Re-run audit to show clean status
      const res = await auditMutation.mutateAsync();
      setAuditResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const breachDetected = auditResult?.breachDetected || auditResult?.status === 'CRYPTOGRAPHIC BREACH';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Action Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 p-5 text-white shadow-lg">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-amber-300 backdrop-blur border border-white/15 shadow-inner">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                  Zero-Trust Regulatory Defense
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                  SECRET_SERVER_SALT Protected
                </span>
              </div>
              <h2 className="text-base font-bold text-white sm:text-lg">
                Bureau Director Cryptographic Integrity Audit
              </h2>
              <p className="text-xs text-slate-300 max-w-xl">
                Recalculates immutable SHA-256 signatures against MongoDB rows to instantly expose direct DBA bypass tampering and insider threats.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="md"
              onClick={handleRunAudit}
              isLoading={auditMutation.isPending}
              className="bg-saffron hover:bg-saffron/90 text-brand-950 font-bold shadow-md"
            >
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              Run Integrity Audit
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSimulateOptions((v) => !v)}
              className="border-white/20 bg-white/5 text-slate-300 hover:bg-white/15"
            >
              <Database className="h-3.5 w-3.5 mr-1 text-rose-400" />
              Simulate DBA Bypass
              {showSimulateOptions ? (
                <ChevronUp className="h-3.5 w-3.5 ml-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Demo Simulation Drawer */}
        {showSimulateOptions && (
          <div className="relative z-10 mt-4 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-slate-200 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Unlock className="h-4 w-4 text-rose-400" />
                  Simulate Insider DBA Bribe Scenario (Spec Page 4)
                </p>
                <p className="mt-1 text-[11.5px] text-slate-300 leading-relaxed">
                  Bypasses the Node.js API and directly alters an application's Risk Score to 95 (GREEN) via raw MongoDB update.
                  Because the <code className="rounded bg-black/40 px-1 py-0.5 text-amber-300">SECRET_SERVER_SALT</code> exists exclusively in backend environment variables, the stored hash remains stagnant.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSimulateTamper}
                isLoading={tamperMutation.isPending}
                className="border-rose-400/50 bg-rose-600/30 text-rose-200 hover:bg-rose-600/50 shrink-0 font-bold"
              >
                Execute Direct DB Tamper
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* BREACH ALERT (High-Impact UI Siren) */}
      {breachDetected && (
        <div
          role="alert"
          aria-live="assertive"
          className="animate-pulse-subtle relative overflow-hidden rounded-2xl border-2 border-rose-600 bg-rose-950/90 p-6 text-white shadow-2xl backdrop-blur"
        >
          {/* Background Ambient Glow */}
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-rose-600/30 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg animate-bounce-subtle">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/30 border border-rose-400/50 px-3 py-0.5 text-xs font-black tracking-widest text-rose-200">
                    🚨 CRYPTOGRAPHIC BREACH DETECTED
                  </div>
                  <h3 className="text-xl font-black text-white mt-1">
                    UNAUTHORIZED DATABASE TAMPERING EXPOSED
                  </h3>
                </div>
              </div>

              <span className="rounded-lg bg-rose-900/60 border border-rose-500/40 px-3 py-1 font-mono text-xs font-bold text-rose-300">
                STATUS: TAMPERED
              </span>
            </div>

            <p className="text-xs text-rose-100 sm:text-sm leading-relaxed font-medium">
              The cryptographic integrity audit recalculated immutable signatures against physical MongoDB storage.
              <strong> Violent mathematical signature mismatch detected:</strong> One or more database rows were altered outside the Node.js API layer without the secret server salt.
            </p>

            {/* Tampered Records Table */}
            {auditResult?.tamperedRecords && auditResult.tamperedRecords.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Compromised Records ({auditResult.tamperedRecords.length})
                </h4>
                {auditResult.tamperedRecords.map((rec) => (
                  <div
                    key={rec.applicationId}
                    className="rounded-xl border border-rose-500/40 bg-black/50 p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/20 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {rec.applicationNumber}
                        </span>
                        <span className="text-slate-300 font-semibold">{rec.institutionName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                          Manipulated Score: {rec.riskScore} ({rec.riskLevel})
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRepair(rec.applicationId)}
                          isLoading={repairMutation.isPending}
                          className="border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/40 font-bold"
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          Re-Seal & Sign
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 text-[11.5px] font-mono">
                      <div className="rounded-lg bg-rose-950/60 p-2.5 border border-rose-500/30">
                        <span className="text-[10px] uppercase font-bold text-rose-400 block mb-0.5">
                          Stagnant Stored Hash (DB Bypass):
                        </span>
                        <div className="flex items-center justify-between gap-1 break-all text-rose-200">
                          <span className="truncate">{rec.storedHash}</span>
                          <button
                            onClick={() => handleCopy(rec.storedHash)}
                            className="text-slate-400 hover:text-white shrink-0"
                            type="button"
                          >
                            {copiedHash === rec.storedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg bg-emerald-950/60 p-2.5 border border-emerald-500/30">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                          Recalculated Authentic Hash (Server Salt):
                        </span>
                        <div className="flex items-center justify-between gap-1 break-all text-emerald-200">
                          <span className="truncate">{rec.recalculatedHash}</span>
                          <button
                            onClick={() => handleCopy(rec.recalculatedHash)}
                            className="text-slate-400 hover:text-white shrink-0"
                            type="button"
                          >
                            {copiedHash === rec.recalculatedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 italic">
                      Diagnostic: {rec.tamperedReason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLEAN AUDIT SUCCESS STATE */}
      {auditResult && !breachDetected && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-emerald-100 backdrop-blur">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-emerald-300 text-sm">
                Cryptographic Integrity Verified Intact
              </p>
              <p className="text-xs text-emerald-200/80">
                All {auditResult.summary.totalApplications} application database rows match their immutable SHA-256 signatures sealed with SECRET_SERVER_SALT.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-emerald-400/80 shrink-0">
            Checked {new Date(auditResult.auditedAt).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
};

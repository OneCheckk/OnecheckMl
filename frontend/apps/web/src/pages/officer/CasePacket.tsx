import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ShieldCheck, FileText, Gavel, ClipboardList } from 'lucide-react';
import type { Finding, FindingEvidence } from '@contracts';
import {
  useApplication,
  useFindings,
  useClaims,
  useLedger,
  useValidity,
  useAlerts,
  useAuditEvents,
  useDispositionFinding,
  useRecordDecision,
  useRunOfficerChecks,
  useCheckRunStatus,
  useRiskScoreBreakdown,
  useCorrectClaim,
  useConfirmClaim,
  useLedgerManualConfirm,
} from '../../api/queries';
import { describeApiError, type ApiErrorInfo } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import { canDecideReview, canRunScrutiny } from '../../auth/permissions';
import { FindingList } from '../../components/case/FindingList';
import { FindingDetail } from '../../components/case/FindingDetail';
import { EvidenceViewer, type DocumentTab } from '../../components/evidence/EvidenceViewer';
import { EvidenceCompare } from '../../components/evidence/EvidenceCompare';
import { LedgerPanel } from '../../components/data/LedgerPanel';
import { ValidityTimeline } from '../../components/data/ValidityTimeline';
import { ClaimTable } from '../../components/data/ClaimTable';
import { ForensicsPanel } from '../../components/case/ForensicsPanel';
import { TrianglePanel } from '../../components/case/TrianglePanel';
import { RiskScorePanel } from '../../components/case/RiskScorePanel';
import {
  AlertStatusBadge,
  ApplicationStatusBadge,
  BandChip,
  CheckRunBadge,
  DemoBanner,
  SeverityChip,
  StatusPill,
} from '../../components/status';
import { categoryLabel, humanize } from '../../components/status/statusMaps';
import {
  Button,
  ErrorState,
  FormField,
  Modal,
  Notice,
  PageBreadcrumbs,
  PageSkeleton,
  Tabs,
  TabPanel,
} from '../../components/ui';
import { IS_MOCK_MODE } from '../../config';
import { fmtDate, fmtDateTime } from '../../lib/format';

/** Decision outcomes accepted by the backend (services/decision.service.js). */
const PROPOSAL_OUTCOMES: { value: string; label: string; help: string }[] = [
  { value: 'ACCEPT_SCRUTINY', label: 'Accept scrutiny', help: 'Scrutiny is complete with no blocking findings.' },
  { value: 'RECOMMEND_APPROVAL', label: 'Recommend approval', help: 'Recommendation for the Regional Director to confirm.' },
  { value: 'REQUEST_CLARIFICATION', label: 'Request clarification', help: 'Moves the application to “Deficiency raised”.' },
  { value: 'RECOMMEND_DEFICIENCY_LETTER', label: 'Recommend a deficiency letter', help: 'Moves the application to “Deficiency raised”.' },
  { value: 'REFER_FOR_INSPECTION', label: 'Refer for physical inspection', help: 'Records a referral for on-site inspection.' },
  { value: 'RECOMMEND_REJECTION', label: 'Recommend rejection', help: 'Recommendation for the Regional Director to confirm.' },
  { value: 'RECOMMEND_ADVERSE_ACTION', label: 'Recommend adverse action', help: 'Requires all high and critical findings to be dispositioned.' },
];
const FINAL_OUTCOMES = [
  { value: 'APPROVE', label: 'Approve (final)', help: 'Final confirmation. Regional Director or Administrator only.' },
  { value: 'REJECT', label: 'Reject (final)', help: 'Final confirmation. Regional Director or Administrator only.' },
];
const APPROVAL_LIKE = ['APPROVE', 'RECOMMEND_APPROVAL', 'ACCEPT_SCRUTINY'];

const MOCK_DOCUMENTS: DocumentTab[] = [
  { docId: 'D1', name: 'Self-disclosure form (D1)', fileUrl: '/mock-docs/D1.pdf' },
  { docId: 'D2', name: 'Sanctioned building plan (D2)', fileUrl: '/mock-docs/D2.pdf' },
  { docId: 'D3', name: 'Fire NOC and challan (D3)', fileUrl: '/mock-docs/D3.pdf' },
];

type Pane = 'findings' | 'evidence' | 'detail';
type BottomTab = 'claims' | 'triangle' | 'ledger' | 'validity' | 'forensics' | 'risk' | 'alerts' | 'activity';

export const OfficerCasePacketPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const appQ = useApplication(id);
  const findingsQ = useFindings(id);
  const { data: claims = [] } = useClaims(id);
  const { data: ledger = [] } = useLedger(id);
  const { data: validity = [] } = useValidity(id);
  const { data: alerts = [] } = useAlerts({ applicationId: id });
  const { data: audit = [], isError: auditError } = useAuditEvents({ entityId: id });
  const { data: risk } = useRiskScoreBreakdown(id);

  const dispositionMutation = useDispositionFinding(id);
  const decisionMutation = useRecordDecision(id);
  const runChecksMutation = useRunOfficerChecks(id);
  const correctClaim = useCorrectClaim(id);
  const confirmClaim = useConfirmClaim(id);
  const manualConfirm = useLedgerManualConfirm(id);

  const [runId, setRunId] = useState<string | undefined>();
  const [runError, setRunError] = useState<string | null>(null);
  const runQ = useCheckRunStatus(id, runId);
  const run = runQ.data ?? runChecksMutation.data;

  const findings = findingsQ.data ?? [];
  const [selectedFindingId, setSelectedFindingId] = useState<string | undefined>();
  const [selectedEvidence, setSelectedEvidence] = useState<FindingEvidence | null>(null);
  const [pane, setPane] = useState<Pane>('findings');
  const [centreMode, setCentreMode] = useState<'document' | 'compare'>('document');
  const [bottomTab, setBottomTab] = useState<BottomTab>('claims');

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [outcome, setOutcome] = useState<string>('ACCEPT_SCRUTINY');
  const [reason, setReason] = useState('');
  const [decisionError, setDecisionError] = useState<ApiErrorInfo | { message: string; details?: any[] } | null>(null);
  const [decisionSaved, setDecisionSaved] = useState<string | null>(null);

  const selectedFinding = findings.find((f) => f.findingId === selectedFindingId);

  // Select the first finding once loaded
  useEffect(() => {
    if (!selectedFindingId && findings.length > 0) {
      setSelectedFindingId(findings[0].findingId);
      setSelectedEvidence(findings[0].proof.evidence[0] ?? null);
    }
  }, [findings, selectedFindingId]);

  const application = appQ.data;
  const documents: DocumentTab[] = useMemo(() => {
    if (application?.documents?.length) {
      return application.documents.map((d) => ({
        docId: d.id,
        name: `${d.originalName ?? humanize(d.docType) ?? 'Document'}${d.version && d.version > 1 ? ` (v${d.version})` : ''}`,
        viaApi: true,
        docType: d.docType,
      }));
    }
    return IS_MOCK_MODE ? MOCK_DOCUMENTS : [];
  }, [application]);

  const appAlerts = useMemo(
    () => alerts.filter((a) => !a.applicationId || a.applicationId === id || a.applicationId === application?.id || a.applicationId === application?.applicationNumber),
    [alerts, id, application]
  );
  const appAudit = useMemo(
    () => audit.filter((e) => !e.entity?.id || e.entity.id === id || e.entity.id === application?.id || e.entity.id === application?.applicationNumber),
    [audit, id, application]
  );

  if (appQ.isLoading || findingsQ.isLoading) return <PageSkeleton rows={2} />;

  if (appQ.isError || !application) {
    return (
      <div className="page py-6">
        <ErrorState error={appQ.error} title="This case could not be opened" onRetry={() => appQ.refetch()} />
        <Link to="/review" className="link mt-3 inline-block text-sm">Back to the review queue</Link>
      </div>
    );
  }

  const mayRun = canRunScrutiny(user);
  const mayDecide = canDecideReview(user);
  const isDirector = user?.role === 'REGIONAL_DIRECTOR' || user?.role === 'ADMIN';
  const outcomes = isDirector ? [...PROPOSAL_OUTCOMES, ...FINAL_OUTCOMES] : PROPOSAL_OUTCOMES;

  const openFindings = findings.filter((f) => f.state === 'OPEN');
  const openSevere = openFindings.filter((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL');
  const pendingSources = ledger.filter((l) => l.status === 'VERIFICATION_PENDING' || l.status === 'SOURCE_UNAVAILABLE').length;
  const claimsToConfirm = claims.filter((c) => c.needsConfirmation || c.status === 'BLOCKED_LOW_CONFIDENCE').length;
  const severityCounts = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const)
    .map((s) => [s, openFindings.filter((f) => f.severity === s).length] as const)
    .filter(([, n]) => n > 0);

  const selectFinding = (f: Finding) => {
    setSelectedFindingId(f.findingId);
    setSelectedEvidence(f.proof.evidence[0] ?? null);
    setPane('detail');
  };
  const selectEvidence = (ev: FindingEvidence) => {
    setSelectedEvidence(ev);
    setCentreMode('document');
    setPane('evidence');
  };

  const startRun = async () => {
    setRunError(null);
    try {
      const r = await runChecksMutation.mutateAsync();
      setRunId(r?.runId);
    } catch (err) {
      setRunError(describeApiError(err, 'The check run could not be started.').message);
    }
  };

  const openDecision = (preset?: string) => {
    setOutcome(preset ?? 'ACCEPT_SCRUTINY');
    setReason('');
    setDecisionError(null);
    setDecisionOpen(true);
  };

  const submitDecision = async () => {
    if (reason.trim().length < 5) {
      setDecisionError({ message: 'State the grounds for this decision (at least 5 characters).' });
      return;
    }
    if (outcome === 'RECOMMEND_ADVERSE_ACTION') {
      if (openSevere.length > 0) {
        setDecisionError({
          message: `Adverse action cannot be recommended until all HIGH and CRITICAL findings have recorded officer dispositions (${openSevere.length} open remaining).`,
        });
        return;
      }
      if (reason.trim().length < 10) {
        setDecisionError({ message: 'Adverse action recommendation requires a rationale of at least 10 characters.' });
        return;
      }
    }
    setDecisionError(null);
    try {
      await decisionMutation.mutateAsync({ outcome, reason: reason.trim() });
      setDecisionOpen(false);
      setDecisionSaved(`Decision recorded: ${outcomes.find((o) => o.value === outcome)?.label ?? outcome}.`);
    } catch (err) {
      setDecisionError(describeApiError(err, 'The decision could not be recorded.'));
    }
  };

  const centre = (
    <div className="flex h-full min-h-0 flex-col">
      {selectedFinding && selectedFinding.proof.evidence.length > 0 && (
        <div className="mb-2 flex items-center gap-1" role="group" aria-label="Evidence view">
          {(['document', 'compare'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={centreMode === m}
              onClick={() => setCentreMode(m)}
              className={clsx(
                'h-8 rounded border px-2.5 text-[12.5px]',
                centreMode === m ? 'border-brand-700 bg-brand-700 text-white' : 'border-line-strong bg-white text-ink-soft hover:bg-brand-50'
              )}
            >
              {m === 'document' ? 'Document' : 'Values compared'}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {centreMode === 'compare' && selectedFinding ? (
          <div className="h-full overflow-y-auto">
            <EvidenceCompare finding={selectedFinding} onSelectEvidence={selectEvidence} />
          </div>
        ) : (
          <EvidenceViewer
            documents={documents}
            selectedEvidence={selectedEvidence}
            evidenceList={selectedFinding?.proof.evidence ?? []}
            onSelectEvidence={setSelectedEvidence}
          />
        )}
      </div>
    </div>
  );

  return (
    <div data-testid="case-packet-screen" className="page py-5">
      <PageBreadcrumbs items={[{ label: 'Review queue', href: '/review' }, { label: application.applicationNumber || 'Case' }]} className="mb-2" />
      <DemoBanner className="mb-3" />

      {/* Case header */}
      <div className="mb-3 flex flex-col gap-3 border-b border-line pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-[20px] font-semibold text-brand-900">{application.applicationNumber}</h1>
            <ApplicationStatusBadge status={application.status} size="md" />
            {application.band && <BandChip band={application.band} />}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">{application.institutionName || 'Institution not specified'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mayRun && (
            <Button variant="outline" size="sm" onClick={startRun} isLoading={runChecksMutation.isPending} disabled={run?.status === 'QUEUED' || run?.status === 'RUNNING'}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Run verification checks
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/review/${application.id}/letters`)}>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Deficiency letters
          </Button>
          {mayDecide && (
            <>
              <Button variant="outline" size="sm" onClick={() => openDecision('REFER_FOR_INSPECTION')}>
                <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" /> Refer for inspection
              </Button>
              <Button size="sm" onClick={() => openDecision()}>
                <Gavel className="h-3.5 w-3.5" aria-hidden="true" /> Record decision
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Case summary */}
      <dl className="mb-3 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded border border-line bg-white px-4 py-3 text-sm sm:grid-cols-4 xl:grid-cols-8">
        <div className="col-span-2">
          <dt className="text-meta text-ink-faint">Category</dt>
          <dd>{categoryLabel(application.category)}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-faint">Academic year</dt>
          <dd>{application.academicYear ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-faint">Submitted</dt>
          <dd>{fmtDate(application.submittedAt)}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-faint">Risk score</dt>
          <dd>{risk?.isComputed ? <span className="tabular-nums font-semibold">{risk.totalScore}/100</span> : <span className="text-ink-faint">Not computed</span>}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-faint">Open findings</dt>
          <dd>
            <span className="font-semibold tabular-nums">{openFindings.length}</span>
            {severityCounts.length > 0 && (
              <span className="block text-[11.5px] text-ink-soft">{severityCounts.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(', ')}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-faint">Pending source checks</dt>
          <dd className="tabular-nums">{pendingSources}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-faint">Values to confirm</dt>
          <dd className="tabular-nums">{claimsToConfirm}</dd>
        </div>
      </dl>

      {/* Check run status */}
      {(run || runError) && (
        <div className="mb-3 rounded border border-line bg-white px-4 py-2.5 text-sm" aria-live="polite">
          {runError ? (
            <Notice tone="bad" onDismiss={() => setRunError(null)}>{runError}</Notice>
          ) : run ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">Verification check run</span>
                <CheckRunBadge status={run.status} />
                <span className="font-mono text-[11.5px] text-ink-faint">{run.runId}</span>
                {runQ.isError && <span className="text-meta text-warn">Status could not be refreshed from the server.</span>}
              </div>
              {Array.isArray(run.steps) && run.steps.length > 0 && (
                <ol className="flex flex-wrap gap-1.5">
                  {run.steps.map((s, i) => (
                    <li key={i} className="flex items-center gap-1 text-[12px]">
                      <span className="text-ink-soft">{s.name}</span>
                      <StatusPill domain="checkStep" value={s.status} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
        </div>
      )}
      {decisionSaved && (
        <Notice tone="ok" className="mb-3" onDismiss={() => setDecisionSaved(null)}>
          {decisionSaved} The application status shown above is refreshed from the server.
        </Notice>
      )}

      {/* Pane switcher below xl */}
      <div className="mb-2 flex gap-1 xl:hidden" role="tablist" aria-label="Case workspace panes">
        {(
          [
            ['findings', `Findings (${findings.length})`],
            ['evidence', 'Evidence'],
            ['detail', 'Finding detail'],
          ] as [Pane, string][]
        ).map(([p, label]) => (
          <button
            key={p}
            role="tab"
            type="button"
            aria-selected={pane === p}
            onClick={() => setPane(p)}
            className={clsx(
              'h-9 flex-1 rounded border text-[13px]',
              pane === p ? 'border-brand-700 bg-brand-700 font-semibold text-white' : 'border-line-strong bg-white text-ink-soft'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Three-pane workspace */}
      {findingsQ.isError && <ErrorState error={findingsQ.error} title="Findings could not be loaded" onRetry={() => findingsQ.refetch()} className="mb-3" />}
      <div className="grid gap-2 xl:h-[740px] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <div className={clsx('min-h-0 xl:block', pane === 'findings' ? 'block h-[560px] xl:h-auto' : 'hidden')}>
          <FindingList
            findings={findings}
            selectedFindingId={selectedFindingId}
            onSelectFinding={selectFinding}
            passedChecks={application.lastTrace as any}
          />
        </div>
        <div className={clsx('min-h-0 xl:block', pane === 'evidence' ? 'block h-[640px] xl:h-auto' : 'hidden')}>{centre}</div>
        <div className={clsx('min-h-0 xl:block', pane === 'detail' ? 'block h-[640px] xl:h-auto' : 'hidden')}>
          <FindingDetail
            finding={selectedFinding}
            canDecide={mayDecide}
            onSelectEvidence={selectEvidence}
            onDisposition={async (state, r) => {
              if (!selectedFinding) return;
              await dispositionMutation.mutateAsync({ findingId: selectedFinding.findingId, state, reason: r });
            }}
            onRequestClarification={() => navigate(`/review/${application.id}/letters`)}
          />
        </div>
      </div>

      {/* Supporting records */}
      <div className="mt-5">
        <Tabs
          idPrefix="case"
          aria-label="Supporting records"
          activeTab={bottomTab}
          onChange={(t) => setBottomTab(t as BottomTab)}
          tabs={[
            { id: 'claims', label: 'Extracted values', count: claims.length },
            { id: 'triangle', label: 'Claim vs record', },
            { id: 'ledger', label: 'Verification ledger', count: ledger.length },
            { id: 'validity', label: 'Certificate validity', count: validity.length },
            { id: 'forensics', label: 'Document forensics' },
            { id: 'risk', label: 'Risk score' },
            { id: 'alerts', label: 'Alerts', count: appAlerts.length },
            { id: 'activity', label: 'Activity', count: appAudit.length },
          ]}
        />
        <div className="pt-4">
          <TabPanel idPrefix="case" id="claims" active={bottomTab === 'claims'}>
            <ClaimTable
              claims={claims}
              readOnly={!mayDecide}
              onSelectClaimSource={(c) => selectEvidence({ label: c.predicateLabel, value: c.value, unit: c.unit, confidence: c.confidence, source: c.source })}
              onEditClaim={(claimId, value, r) => correctClaim.mutateAsync({ claimId, value, reason: r })}
              onConfirmClaim={async (claimId) => { await confirmClaim.mutateAsync({ claimId }); }}
            />
          </TabPanel>
          <TabPanel idPrefix="case" id="triangle" active={bottomTab === 'triangle'}>
            <TrianglePanel applicationId={application.id} />
          </TabPanel>
          <TabPanel idPrefix="case" id="ledger" active={bottomTab === 'ledger'}>
            <LedgerPanel
              entries={ledger}
              onManualConfirm={mayDecide ? async (entryId, o, note) => { await manualConfirm.mutateAsync({ entryId, outcome: o, note }); } : undefined}
            />
          </TabPanel>
          <TabPanel idPrefix="case" id="validity" active={bottomTab === 'validity'}>
            <ValidityTimeline applicationId={application.id} records={validity} isDemoMode={mayRun} />
          </TabPanel>
          <TabPanel idPrefix="case" id="forensics" active={bottomTab === 'forensics'}>
            <ForensicsPanel applicationId={application.id} />
          </TabPanel>
          <TabPanel idPrefix="case" id="risk" active={bottomTab === 'risk'}>
            <RiskScorePanel applicationId={application.id} />
          </TabPanel>
          <TabPanel idPrefix="case" id="alerts" active={bottomTab === 'alerts'}>
            {appAlerts.length === 0 ? (
              <p className="rounded border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft">No alerts are linked to this application.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-line bg-white">
                <table className="data-table">
                  <thead><tr><th>Severity</th><th>Alert</th><th>Status</th><th>Raised</th></tr></thead>
                  <tbody>
                    {appAlerts.map((a) => (
                      <tr key={a.id}>
                        <td><SeverityChip severity={a.severity} /></td>
                        <td><span className="block font-semibold">{a.title ?? humanize(a.type)}</span><span className="text-ink-soft">{a.message}</span></td>
                        <td><AlertStatusBadge status={a.status} /></td>
                        <td className="whitespace-nowrap">{fmtDateTime(a.raisedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Link to="/alerts" className="link mt-2 inline-block text-sm">Open the alerts queue</Link>
          </TabPanel>
          <TabPanel idPrefix="case" id="activity" active={bottomTab === 'activity'}>
            {auditError ? (
              <Notice tone="muted">The audit trail is not available to your role or could not be loaded.</Notice>
            ) : appAudit.length === 0 ? (
              <p className="rounded border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft">No logged activity was returned for this application.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-line bg-white">
                <table className="data-table">
                  <thead><tr><th>#</th><th>When</th><th>Action</th><th>Actor</th><th>Event hash</th></tr></thead>
                  <tbody>
                    {appAudit.map((e) => (
                      <tr key={e.seq}>
                        <td className="tabular-nums">{e.seq}</td>
                        <td className="whitespace-nowrap">{fmtDateTime(e.ts)}</td>
                        <td>{humanize(e.action)}</td>
                        <td>{e.actor.name || e.actor.id || '—'}{e.actor.role && <span className="block text-[11.5px] text-ink-faint">{e.actor.role}</span>}</td>
                        <td className="font-mono text-[11.5px] text-ink-faint">{e.hash ? `${e.hash.slice(0, 16)}…` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabPanel>
        </div>
      </div>

      {/* Decision dialog */}
      <Modal
        isOpen={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        title="Record decision"
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDecisionOpen(false)} disabled={decisionMutation.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitDecision} isLoading={decisionMutation.isPending}>
              Record decision
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-ink-soft">
            This records your administrative determination for <span className="font-mono text-ink">{application.applicationNumber}</span>.
            It is logged with your name and the reason you give.
          </p>
          <fieldset>
            <legend className="field-label">Outcome</legend>
            <div className="divide-y divide-line-soft rounded border border-line">
              {outcomes.map((o) => (
                <label key={o.value} className={clsx('flex cursor-pointer items-start gap-2.5 px-3 py-2', outcome === o.value && 'bg-brand-50')}>
                  <input type="radio" name="decision-outcome" value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="mt-1 accent-[#174a85]" />
                  <span>
                    <span className="block font-semibold text-ink">{o.label}</span>
                    <span className="block text-meta text-ink-faint">{o.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {APPROVAL_LIKE.includes(outcome) && openSevere.length > 0 && (
            <Notice tone="warn">
              {openSevere.length} high or critical finding(s) are still open. The server refuses approval-type outcomes until they are dispositioned.
            </Notice>
          )}
          <FormField label="Grounds for the decision" htmlFor="decision-reason" required helperText="Cite the findings, documents or clauses relied upon.">
            <textarea id="decision-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} className="field-textarea" />
          </FormField>
          {decisionError && (
            <Notice tone="bad">
              {decisionError.message}
              {'details' in decisionError && Array.isArray(decisionError.details) && decisionError.details.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {decisionError.details.map((d: any, i: number) => (
                    <li key={i}>{d.title ?? d.message}{d.ruleId ? ` (${d.ruleId})` : ''}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}
        </div>
      </Modal>
    </div>
  );
};

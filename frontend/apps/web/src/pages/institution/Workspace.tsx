import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Play } from 'lucide-react';
import type { ClaimRecheckResult } from '@contracts';
import {
  useApplication,
  useApplicationChecklist,
  useClaims,
  useFindings,
  useDeficiencyLetters,
  useRunSelfCheck,
  useCorrectClaim,
  useConfirmClaim,
  useUploadDocument,
  useSubmitApplication,
} from '../../api/queries';
import { describeApiError, type ApiErrorInfo } from '../../api/errors';
import { ChecklistPanel } from '../../components/data/ChecklistPanel';
import { ClaimTable } from '../../components/data/ClaimTable';
import { TrianglePanel } from '../../components/case/TrianglePanel';
import { LetterPreview } from '../../components/data/LetterPreview';
import {
  ApplicationStatusBadge,
  BandChip,
  DemoBanner,
  PlaceholderTag,
  SeverityChip,
  StatusBadge,
} from '../../components/status';
import { categoryLabel } from '../../components/status/statusMaps';
import {
  Button,
  ConfirmationDialog,
  ErrorState,
  Notice,
  PageHeader,
  PageSkeleton,
  Panel,
  Tabs,
  TabPanel,
} from '../../components/ui';
import { fmtDate, fmtDateTime } from '../../lib/format';

type TabId = 'documents' | 'extracted' | 'selfcheck' | 'letters' | 'history';
const EDITABLE_STATUSES = ['DRAFT', 'DEFICIENCY_RAISED'];

export const InstitutionWorkspacePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('documents');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'info' | 'bad'; text: React.ReactNode } | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<ApiErrorInfo | null>(null);
  const [selfCheckResult, setSelfCheckResult] = useState<any>(null);

  const appQ = useApplication(id);
  const { data: checklist = [], isLoading: checklistLoading, isError: checklistError, refetch: refetchChecklist } = useApplicationChecklist(id);
  const { data: claims = [] } = useClaims(id);
  const findingsQ = useFindings(id);
  const { data: letters = [] } = useDeficiencyLetters(id);

  const runSelfCheckMutation = useRunSelfCheck(id);
  const correctClaimMutation = useCorrectClaim(id);
  const confirmClaimMutation = useConfirmClaim(id);
  const uploadDocMutation = useUploadDocument(id);
  const submitAppMutation = useSubmitApplication(id);

  const application = appQ.data;
  const findings = findingsQ.data ?? [];
  const sentLetters = letters.filter((l) => l.status === 'SENT');

  const history = useMemo(() => {
    if (!application) return [];
    const ev: { at: string; title: string; detail?: string }[] = [];
    if (application.createdAt) ev.push({ at: application.createdAt, title: 'Application created as draft' });
    for (const d of application.documents) {
      if (d.createdAt) ev.push({ at: d.createdAt, title: 'Document uploaded', detail: `${d.originalName ?? 'File'}${d.version && d.version > 1 ? ` (version ${d.version})` : ''}` });
    }
    if (application.submittedAt) ev.push({ at: application.submittedAt, title: 'Application submitted for scrutiny' });
    for (const l of sentLetters) {
      if (l.sentAt || l.createdAt) ev.push({ at: (l.sentAt || l.createdAt)!, title: 'Deficiency letter issued' });
    }
    if (application.decision?.at) ev.push({ at: application.decision.at, title: 'Decision recorded', detail: application.decision.outcome ?? undefined });
    return ev.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [application, sentLetters]);

  if (appQ.isLoading) return <PageSkeleton />;

  if (appQ.isError || !application) {
    return (
      <div className="page py-6">
        <ErrorState error={appQ.error} title="This application could not be opened" onRetry={() => appQ.refetch()} />
      </div>
    );
  }

  const canEdit = EDITABLE_STATUSES.includes(application.status);
  const missingRequired = checklist.filter((i) => i.required && i.state === 'MISSING');

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await submitAppMutation.mutateAsync();
      setConfirmSubmit(false);
      setNotice({ tone: 'ok', text: 'The server accepted the submission. The application is now with the scrutiny team.' });
    } catch (err) {
      setSubmitError(describeApiError(err, 'The submission was not accepted.'));
    }
  };

  const handleSelfCheck = async () => {
    setNotice(null);
    try {
      const res = await runSelfCheckMutation.mutateAsync();
      setSelfCheckResult(res);
      setNotice({ tone: 'info', text: 'Self-check completed. Results are shown below; your application remains a draft.' });
    } catch (err) {
      setNotice({ tone: 'bad', text: describeApiError(err, 'Self-check could not be run.').message });
    }
  };

  const showRecheckToast = (res: ClaimRecheckResult) => {
    if (typeof res?.rulesRerun === 'number') {
      setNotice({
        tone: 'info',
        text: `Re-checked ${res.rulesRerun} of ${res.rulesTotal} rules: ${res.closed} resolved, ${res.opened} new.`,
      });
    } else {
      setNotice({ tone: 'info', text: 'Correction saved. Affected checks will be re-evaluated by the server.' });
    }
  };

  return (
    <div className="page py-6">
      <PageHeader
        title={application.applicationNumber || 'Application'}
        badge={<ApplicationStatusBadge status={application.status} size="md" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/portal' }, { label: application.applicationNumber || 'Application' }]}
        description={application.institutionName || undefined}
        actions={
          canEdit ? (
            <Button onClick={() => { setSubmitError(null); setConfirmSubmit(true); }}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {application.status === 'DRAFT' ? 'Submit application' : 'Resubmit application'}
            </Button>
          ) : undefined
        }
      />
      <DemoBanner className="mb-4" />

      {/* Summary */}
      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded border border-line bg-white px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-1 lg:col-span-2">
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
          <dt className="text-meta text-ink-faint">Last updated</dt>
          <dd>{fmtDate(application.updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-faint">Risk band</dt>
          <dd>{application.band ? <BandChip band={application.band} /> : <span className="text-ink-faint">Not assessed</span>}</dd>
        </div>
      </dl>

      {canEdit && missingRequired.length > 0 && (
        <Notice tone="warn" className="mb-4" title={`${missingRequired.length} required document${missingRequired.length > 1 ? 's' : ''} not uploaded`}>
          {missingRequired.map((m) => m.label).join(', ')}. The server will not accept the submission until these are uploaded.
        </Notice>
      )}
      {application.status === 'DEFICIENCY_RAISED' && sentLetters.length > 0 && (
        <Notice tone="warn" className="mb-4" title="A deficiency letter has been issued">
          Read the letter under <button className="link" onClick={() => setActiveTab('letters')}>Letters</button>, upload corrected documents and resubmit.
        </Notice>
      )}
      {notice && (
        <Notice tone={notice.tone} className="mb-4" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <Tabs
        aria-label="Application sections"
        idPrefix="ws"
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as TabId)}
        tabs={[
          { id: 'documents', label: 'Documents', count: checklist.length },
          { id: 'extracted', label: 'Extracted data', count: claims.length },
          { id: 'selfcheck', label: 'Self-check and findings', count: findings.length },
          { id: 'letters', label: 'Letters', count: sentLetters.length },
          { id: 'history', label: 'History' },
        ]}
      />

      <div className="pt-4">
        <TabPanel idPrefix="ws" id="documents" active={activeTab === 'documents'}>
          {checklistLoading ? (
            <Panel><p className="text-sm text-ink-soft">Loading checklist…</p></Panel>
          ) : checklistError ? (
            <ErrorState title="The checklist could not be loaded" onRetry={() => refetchChecklist()} />
          ) : (
            <ChecklistPanel
              items={checklist}
              canUpload={canEdit}
              uploadDisabledReason={`Documents cannot be changed while the application is ${application.status.toLowerCase().replace(/_/g, ' ')}.`}
              onUploadFile={async (itemId, file, docTypeHint, onProgress) => {
                await uploadDocMutation.mutateAsync({ file, docTypeHint, checklistItemId: itemId, onProgress });
              }}
            />
          )}
        </TabPanel>

        <TabPanel idPrefix="ws" id="extracted" active={activeTab === 'extracted'}>
          <p className="mb-3 text-sm text-ink-soft">
            Values read from your uploaded documents. If a value was read incorrectly, correct it and give a reason; the
            correction and reason are recorded.
          </p>
          <ClaimTable
            claims={claims}
            readOnly={!canEdit}
            onEditClaim={(claimId, value, reason) => correctClaimMutation.mutateAsync({ claimId, value, reason })}
            onConfirmClaim={async (claimId) => {
              await confirmClaimMutation.mutateAsync({ claimId });
            }}
            onShowRecheckToast={showRecheckToast}
          />
        </TabPanel>

        <TabPanel idPrefix="ws" id="selfcheck" active={activeTab === 'selfcheck'} className="space-y-5">
          <Panel
            title="Pre-submission self-check"
            subtitle="Runs the checklist and rules against what you have uploaded so far. It does not submit the application."
            actions={
              canEdit && (
                <Button size="sm" onClick={handleSelfCheck} isLoading={runSelfCheckMutation.isPending}>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" /> Run self-check
                </Button>
              )
            }
          >
            {selfCheckResult ? (
              <dl className="meta-list sm:grid-cols-[220px_1fr]">
                <dt>Checklist complete</dt>
                <dd>{selfCheckResult.isComplete === true ? 'Yes' : selfCheckResult.isComplete === false ? 'No' : '—'}</dd>
                {selfCheckResult.checklist?.missingRequired?.length > 0 && (
                  <>
                    <dt>Missing required documents</dt>
                    <dd>{selfCheckResult.checklist.missingRequired.map((m: any) => m.label).join(', ')}</dd>
                  </>
                )}
                {Array.isArray(selfCheckResult.findings) && (
                  <>
                    <dt>Findings returned</dt>
                    <dd>{selfCheckResult.findings.length}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-ink-soft">No self-check has been run in this session.</p>
            )}
          </Panel>

          <Panel title="Findings recorded for this application" bodyClassName="">
            {findingsQ.isError ? (
              <div className="p-4"><ErrorState error={findingsQ.error} onRetry={() => findingsQ.refetch()} /></div>
            ) : findings.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-soft">
                No findings are recorded for this application. This does not mean the application has been verified; checks
                may not have run yet.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {findings.map((f) => (
                  <li key={f.findingId} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityChip severity={f.severity} />
                      <StatusBadge status={f.status} size="sm" />
                      <span className="font-semibold text-ink">{f.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{f.message}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-faint">
                      <span>Rule <span className="font-mono">{f.ruleId}</span></span>
                      {f.proof.evidence.length > 0 && <span>Evidence: {f.proof.evidence.map((e) => e.label).join('; ')}</span>}
                      {f.placeholder || f.clauseRef === 'HANDBOOK-REF-TBD' ? <PlaceholderTag /> : f.clauseRef ? <span>Clause <span className="font-mono">{f.clauseRef}</span></span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Claim, document and record comparison" subtitle="How your declared values compare with your documents and with AICTE records">
            <TrianglePanel applicationId={application.id} />
          </Panel>
        </TabPanel>

        <TabPanel idPrefix="ws" id="letters" active={activeTab === 'letters'} className="space-y-4">
          {sentLetters.length === 0 ? (
            <Panel><p className="text-sm text-ink-soft">No deficiency letters have been issued for this application.</p></Panel>
          ) : (
            sentLetters.map((l) => (
              <Panel key={l.id} title="Deficiency letter" subtitle={`Issued ${fmtDateTime(l.sentAt || l.createdAt)}`}
                actions={canEdit && <Button variant="outline" size="sm" onClick={() => setActiveTab('documents')}>Upload corrected documents</Button>}>
                <LetterPreview letter={l} />
              </Panel>
            ))
          )}
        </TabPanel>

        <TabPanel idPrefix="ws" id="history" active={activeTab === 'history'}>
          <Panel title="Application history" subtitle="Events recorded on this application that are visible to your institution">
            {history.length === 0 ? (
              <p className="text-sm text-ink-soft">No dated events are available for this application.</p>
            ) : (
              <ol className="relative ml-2 border-l border-line pl-5">
                {history.map((e, i) => (
                  <li key={i} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-600" aria-hidden="true" />
                    <p className="text-meta text-ink-faint">{fmtDateTime(e.at)}</p>
                    <p className="font-semibold text-ink">{e.title}</p>
                    {e.detail && <p className="text-sm text-ink-soft">{e.detail}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </TabPanel>
      </div>

      <ConfirmationDialog
        isOpen={confirmSubmit}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={handleSubmit}
        isLoading={submitAppMutation.isPending}
        title={application.status === 'DRAFT' ? 'Submit this application?' : 'Resubmit this application?'}
        confirmText={application.status === 'DRAFT' ? 'Submit application' : 'Resubmit application'}
        message={
          <div className="space-y-2">
            <p>
              Once submitted, documents cannot be changed unless a deficiency letter is issued. The server checks that all
              required documents are present before accepting.
            </p>
            {missingRequired.length > 0 && (
              <p className="text-warn">
                {missingRequired.length} required document(s) appear to be missing, so the server is likely to refuse this
                submission.
              </p>
            )}
          </div>
        }
        error={
          submitError && (
            <div>
              <p className="font-semibold text-ink">{submitError.message}</p>
              {submitError.details && (
                <ul className="mt-1 list-disc pl-5">
                  {submitError.details.map((d, i) => (
                    <li key={i}>{d.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        }
      />
    </div>
  );
};

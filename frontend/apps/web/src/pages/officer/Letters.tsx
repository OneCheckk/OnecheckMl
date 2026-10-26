import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Send } from 'lucide-react';
import { useApplication, useFindings, useDeficiencyLetters, useSendDeficiencyLetter, useDispatchLetter } from '../../api/queries';
import type { LetterView } from '../../api/adapters';
import { describeApiError } from '../../api/errors';
import { Button, ConfirmationDialog, ErrorState, Notice, PageHeader, PageSkeleton, Panel } from '../../components/ui';
import { ApplicationStatusBadge, DemoBanner, SeverityChip, StatusBadge } from '../../components/status';
import { LetterPreview } from '../../components/data/LetterPreview';
import { fmtDateTime } from '../../lib/format';

export const DeficiencyLettersPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const appQ = useApplication(id);
  const findingsQ = useFindings(id);
  const lettersQ = useDeficiencyLetters(id);
  const createMutation = useSendDeficiencyLetter(id);
  const dispatchMutation = useDispatchLetter(id);

  const findings = findingsQ.data ?? [];
  const letters = lettersQ.data ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [initialised, setInitialised] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toDispatch, setToDispatch] = useState<LetterView | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!initialised && findings.length > 0) {
      setSelected(findings.filter((f) => f.state === 'OPEN' || f.state === 'CLARIFICATION_REQUESTED').map((f) => f.findingId));
      setInitialised(true);
    }
  }, [findings, initialised]);

  useEffect(() => {
    if (!previewId && letters.length > 0) setPreviewId(letters[0].id);
  }, [letters, previewId]);

  if (appQ.isLoading || findingsQ.isLoading || lettersQ.isLoading) return <PageSkeleton />;
  const application = appQ.data;
  if (appQ.isError || !application) {
    return (
      <div className="page py-6">
        <ErrorState error={appQ.error} title="This application could not be loaded" onRetry={() => appQ.refetch()} />
      </div>
    );
  }

  const toggle = (fid: string) => setSelected((s) => (s.includes(fid) ? s.filter((x) => x !== fid) : [...s, fid]));

  const generate = async () => {
    setCreateError(null);
    setNotice(null);
    try {
      const letter = await createMutation.mutateAsync({ findingIds: selected });
      if (letter.id) setPreviewId(letter.id);
      setNotice(letter.status === 'SENT' ? 'The letter was created and recorded as sent by the server.' : 'Draft created. Review it, then send it to the institution.');
    } catch (err) {
      setCreateError(describeApiError(err, 'The draft could not be generated.').message);
    }
  };

  const dispatch = async () => {
    if (!toDispatch) return;
    setDispatchError(null);
    try {
      await dispatchMutation.mutateAsync(toDispatch.id);
      setToDispatch(null);
      setNotice('The server recorded the letter as sent and moved the application to “Deficiency raised”.');
    } catch (err) {
      setDispatchError(describeApiError(err, 'The letter could not be sent.').message);
    }
  };

  const preview = letters.find((l) => l.id === previewId);

  return (
    <div className="page py-6">
      <PageHeader
        title="Deficiency letters"
        badge={<ApplicationStatusBadge status={application.status} size="md" />}
        description={
          <>
            <span className="font-mono">{application.applicationNumber}</span>
            {application.institutionName && <> · {application.institutionName}</>}
          </>
        }
        breadcrumbs={[
          { label: 'Review queue', href: '/review' },
          { label: application.applicationNumber || 'Case', href: `/review/${application.id}` },
          { label: 'Deficiency letters' },
        ]}
      />
      <DemoBanner className="mb-4" />
      {notice && <Notice tone="ok" className="mb-4" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Panel
          title="1. Select findings to cite"
          subtitle={`${selected.length} of ${findings.length} selected`}
          bodyClassName=""
        >
          {findings.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-soft">No findings are recorded for this application, so a deficiency letter cannot be generated.</p>
          ) : (
            <ul className="max-h-[460px] divide-y divide-line-soft overflow-y-auto">
              {findings.map((f) => (
                <li key={f.findingId}>
                  <label className="flex cursor-pointer items-start gap-2.5 px-4 py-2.5 hover:bg-[#f6f8fa]">
                    <input type="checkbox" checked={selected.includes(f.findingId)} onChange={() => toggle(f.findingId)} className="mt-1 h-4 w-4 accent-[#174a85]" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{f.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <SeverityChip severity={f.severity} />
                        <StatusBadge status={f.status} size="sm" />
                        <span className="font-mono text-[11px] text-ink-faint">{f.ruleId}</span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line-soft px-4 py-3">
            {createError && <Notice tone="bad" className="mb-2">{createError}</Notice>}
            <Button onClick={generate} disabled={selected.length === 0} isLoading={createMutation.isPending} className="w-full">
              <FileText className="h-4 w-4" aria-hidden="true" /> Generate draft letter
            </Button>
            <p className="mt-1.5 text-[11.5px] text-ink-faint">The server composes the letter from the selected findings. Nothing is sent at this step.</p>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="2. Review and send" bodyClassName="">
            {letters.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-soft">No letters exist for this application yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Letter</th><th>Status</th><th>Created</th><th>Sent</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {letters.map((l) => (
                    <tr key={l.id} className={l.id === previewId ? '[&>td]:!bg-brand-50' : undefined}>
                      <td>
                        <span className="font-mono text-[12px]">{l.id.slice(-8)}</span>
                        <span className="block text-[11.5px] text-ink-faint">{l.findingIds.length} finding(s) cited</span>
                      </td>
                      <td>
                        <span className={`rounded-sm border px-1.5 py-[1px] text-[12px] font-medium ${l.status === 'SENT' ? 'border-ok-line bg-ok-bg text-ok' : 'border-muted-line bg-muted-bg text-muted'}`}>
                          {l.status === 'SENT' ? 'Sent' : 'Draft'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                      <td className="whitespace-nowrap">{fmtDateTime(l.sentAt)}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => setPreviewId(l.id)} aria-pressed={l.id === previewId}>
                            Preview
                          </Button>
                          {l.status !== 'SENT' && (
                            <Button size="sm" onClick={() => { setDispatchError(null); setToDispatch(l); }}>
                              <Send className="h-3.5 w-3.5" aria-hidden="true" /> Send
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Panel>

          {preview && (
            <Panel title="Letter preview" subtitle={preview.status === 'SENT' ? `Sent ${fmtDateTime(preview.sentAt || preview.createdAt)}` : 'Draft — not yet sent'}>
              <LetterPreview letter={preview} />
            </Panel>
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={!!toDispatch}
        onCancel={() => setToDispatch(null)}
        onConfirm={dispatch}
        isLoading={dispatchMutation.isPending}
        title="Send this deficiency letter?"
        confirmText="Send letter"
        message={
          <p>
            The letter becomes visible to the institution and the server moves{' '}
            <span className="font-mono text-ink">{application.applicationNumber}</span> to “Deficiency raised”. This action is recorded in
            the audit trail and cannot be undone from this screen.
          </p>
        }
        error={dispatchError}
      />
    </div>
  );
};

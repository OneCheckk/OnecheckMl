import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRulepacks, useCreateRulepack, useActivateRulepack, type RulepackRecord } from '../../api/queries';
import { describeApiError } from '../../api/errors';
import {
  Button,
  ConfirmationDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  Modal,
  Notice,
  PageHeader,
  PageSkeleton,
  Panel,
} from '../../components/ui';
import { DemoBanner } from '../../components/status';
import { fmtDateTime } from '../../lib/format';

export const AdminRulepacksPage: React.FC = () => {
  const listQ = useRulepacks();
  const create = useCreateRulepack();
  const activate = useActivateRulepack();

  const [viewing, setViewing] = useState<RulepackRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ version: '', yamlText: '', notes: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toActivate, setToActivate] = useState<RulepackRecord | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (listQ.isLoading) return <PageSkeleton />;
  const rulepacks = listQ.data ?? [];
  const active = rulepacks.find((r) => r.active);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.version.trim()) e.version = 'Enter a version identifier.';
    else if (rulepacks.some((r) => r.version === form.version.trim())) e.version = 'This version already exists.';
    if (!form.yamlText.trim()) e.yamlText = 'Paste or load the rulepack YAML.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const doCreate = async () => {
    setCreateError(null);
    try {
      await create.mutateAsync({ version: form.version.trim(), yamlText: form.yamlText, notes: form.notes.trim() || undefined });
      setConfirmCreate(false);
      setCreateOpen(false);
      setNotice(`Rulepack ${form.version.trim()} registered. It is inactive until you activate it.`);
      setForm({ version: '', yamlText: '', notes: '' });
    } catch (err) {
      setConfirmCreate(false);
      setCreateError(describeApiError(err, 'The rulepack could not be registered.').message);
    }
  };

  const doActivate = async () => {
    if (!toActivate) return;
    setActivateError(null);
    try {
      await activate.mutateAsync(toActivate.version);
      setNotice(`Rulepack ${toActivate.version} is now active.`);
      setToActivate(null);
    } catch (err) {
      setActivateError(describeApiError(err, 'The rulepack could not be activated.').message);
    }
  };

  return (
    <div className="page py-6">
      <PageHeader
        title="Rulepacks"
        description="Versioned rule definitions used by the verification engine. Exactly one version is active at a time."
        breadcrumbs={[{ label: 'Administration', href: '/admin' }, { label: 'Rulepacks' }]}
        actions={
          <Button onClick={() => { setCreateOpen(true); setCreateError(null); setFormErrors({}); }}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Register rulepack
          </Button>
        }
      />
      <DemoBanner className="mb-4" />
      {notice && <Notice tone="ok" className="mb-4" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {listQ.isError ? (
        <ErrorState error={listQ.error} title="Rulepacks could not be loaded" onRetry={() => listQ.refetch()} />
      ) : (
        <Panel
          title="Registered versions"
          subtitle={active ? <>Active: <span className="font-mono">{active.version}</span></> : 'No version is marked active on the server'}
          bodyClassName=""
        >
          <DataTable<RulepackRecord>
            caption="Rulepack versions"
            data={rulepacks}
            keyExtractor={(r) => r.id ?? r.version}
            columns={[
              { key: 'v', header: 'Version', render: (r) => <span className="font-mono font-semibold">{r.version}</span> },
              {
                key: 'state',
                header: 'State',
                render: (r) => (
                  <span className={`rounded-sm border px-1.5 py-[1px] text-[12px] ${r.active ? 'border-ok-line bg-ok-bg text-ok' : 'border-muted-line bg-muted-bg text-muted'}`}>
                    {r.active ? 'Active' : 'Inactive'}
                  </span>
                ),
              },
              { key: 'hash', header: 'SHA-256', render: (r) => <span className="font-mono text-[11.5px] text-ink-soft" title={r.sha256}>{r.sha256 ? `${r.sha256.slice(0, 16)}…` : '—'}</span> },
              { key: 'notes', header: 'Notes', render: (r) => <span className="text-ink-soft">{r.notes || '—'}</span> },
              { key: 'created', header: 'Registered', render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</span> },
              {
                key: 'act',
                header: 'Actions',
                render: (r) => (
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setViewing(r)} disabled={!r.yamlText}>View YAML</Button>
                    {!r.active && (
                      <Button size="sm" onClick={() => { setActivateError(null); setToActivate(r); }}>Activate</Button>
                    )}
                  </div>
                ),
              },
            ]}
            emptyState={<EmptyState title="No rulepacks registered" description="Register a rulepack version to make it available for activation." />}
          />
        </Panel>
      )}

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={`Rulepack ${viewing?.version ?? ''}`} maxWidth="xl"
        footer={<Button size="sm" onClick={() => setViewing(null)}>Close</Button>}>
        {viewing && (
          <div className="space-y-2">
            {viewing.sha256 && <p className="text-meta text-ink-faint">SHA-256 <span className="break-all font-mono">{viewing.sha256}</span></p>}
            <pre className="max-h-[60vh] overflow-auto rounded border border-line bg-[#fafbfc] p-3 font-mono text-[12px] leading-relaxed">{viewing.yamlText}</pre>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register rulepack"
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => validate() && setConfirmCreate(true)}>Review and register</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField label="Version" htmlFor="rp-version" required error={formErrors.version} helperText="For example 2026.2">
            <input id="rp-version" className="field-input max-w-[220px] font-mono" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </FormField>
          <FormField label="Rulepack YAML" htmlFor="rp-yaml" required error={formErrors.yamlText}>
            <textarea id="rp-yaml" rows={12} className="field-textarea font-mono text-[12.5px]" value={form.yamlText} onChange={(e) => setForm({ ...form, yamlText: e.target.value })} spellCheck={false} />
          </FormField>
          <div>
            <label htmlFor="rp-file" className="field-label">Or load from a file</label>
            <input
              id="rp-file"
              type="file"
              accept=".yaml,.yml,text/yaml,text/plain"
              className="text-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const text = await f.text();
                  setForm((p) => ({ ...p, yamlText: text }));
                }
              }}
            />
          </div>
          <FormField label="Notes" htmlFor="rp-notes">
            <input id="rp-notes" className="field-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FormField>
          <p className="text-meta text-ink-faint">The server also registers the YAML with the verification service; registration fails if that service rejects it.</p>
          {createError && <Notice tone="bad">{createError}</Notice>}
        </div>
      </Modal>

      <ConfirmationDialog
        isOpen={confirmCreate}
        onCancel={() => setConfirmCreate(false)}
        onConfirm={doCreate}
        isLoading={create.isPending}
        title="Register this rulepack?"
        confirmText="Register"
        message={<p>Register version <span className="font-mono text-ink">{form.version.trim()}</span>. It will be stored as inactive and does not affect any evaluation until activated.</p>}
      />

      <ConfirmationDialog
        isOpen={!!toActivate}
        onCancel={() => setToActivate(null)}
        onConfirm={doActivate}
        isLoading={activate.isPending}
        isDangerous
        title="Activate this rulepack?"
        confirmText="Activate"
        message={
          <p>
            Make <span className="font-mono text-ink">{toActivate?.version}</span> the active rulepack
            {active ? <> in place of <span className="font-mono text-ink">{active.version}</span></> : ''}. Subsequent checks are evaluated with
            these rules. The change is recorded in the audit trail.
          </p>
        }
        error={activateError}
      />
    </div>
  );
};

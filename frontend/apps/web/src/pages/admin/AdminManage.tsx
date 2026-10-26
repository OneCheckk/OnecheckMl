import React, { useMemo, useState } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import {
  useAdminUsers,
  useCreateUser,
  useUpdateUser,
  useAdminChecklists,
  useUpdateChecklist,
  useCategories,
  useInstitutions,
  type AdminUser,
  type ChecklistDefinition,
} from '../../api/queries';
import { describeApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import {
  Button,
  ConfirmationDialog,
  DataTable,
  ErrorState,
  FilterBar,
  FilterSelect,
  FormField,
  Modal,
  Notice,
  PageHeader,
  PageSkeleton,
  Panel,
  SelectField,
} from '../../components/ui';
import { DemoBanner, PlaceholderTag } from '../../components/status';
import { ROLE_LABELS, categoryLabel, humanize, roleLabel } from '../../components/status/statusMaps';
import { fmtDate, fmtDateTime } from '../../lib/format';

// Roles accepted by the backend admin user schema (validators/schemas.js adminCreateUserSchema)
const ASSIGNABLE_ROLES = ['INSTITUTION', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN', 'AUDITOR'];
const INSTITUTION_ROLES = ['INSTITUTION', 'INSTITUTION_USER'];

// ==========================================================
// Users
// ==========================================================

export const AdminUsersPage: React.FC = () => {
  const { user: me } = useAuth();
  const usersQ = useAdminUsers();
  const institutionsQ = useInstitutions();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'INSTITUTION', institutionId: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);

  const [pending, setPending] = useState<{ user: AdminUser; change: { role?: string; isActive?: boolean } } | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const users = usersQ.data ?? [];
  const institutions = institutionsQ.data ?? [];
  const instName = (id?: string) => institutions.find((i: any) => i.id === id)?.name;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!roleFilter || u.role === roleFilter) &&
        (!activeFilter || String(u.isActive !== false) === activeFilter) &&
        (!q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    );
  }, [users, roleFilter, activeFilter, search]);

  if (usersQ.isLoading) return <PageSkeleton />;

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = 'Enter the full name (at least 2 characters).';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.password.length < 6) e.password = 'The initial password must be at least 6 characters.';
    if (INSTITUTION_ROLES.includes(form.role) && !form.institutionId) e.institutionId = 'Select the institution this user belongs to.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitCreate = async () => {
    setCreateError(null);
    if (!validate()) return;
    try {
      await createUser.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        institutionId: INSTITUTION_ROLES.includes(form.role) ? form.institutionId : undefined,
      });
      setCreateOpen(false);
      setNotice(`Account created for ${form.email.trim().toLowerCase()}. Share the initial password through an official channel.`);
      setForm({ name: '', email: '', password: '', role: 'INSTITUTION', institutionId: '' });
    } catch (err) {
      setCreateError(describeApiError(err, 'The account could not be created.').message);
    }
  };

  const applyChange = async () => {
    if (!pending) return;
    setPendingError(null);
    try {
      await updateUser.mutateAsync({ id: pending.user.id, ...pending.change });
      setNotice(`Updated ${pending.user.email}.`);
      setPending(null);
    } catch (err) {
      setPendingError(describeApiError(err, 'The change could not be saved.').message);
    }
  };

  return (
    <div className="page py-6">
      <PageHeader
        title="Users"
        description="Accounts that can sign in to OneCheck, their roles and whether they are active."
        breadcrumbs={[{ label: 'Administration', href: '/admin' }, { label: 'Users' }]}
        actions={
          <Button onClick={() => { setCreateOpen(true); setCreateError(null); setFormErrors({}); }}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /> Create user
          </Button>
        }
      />
      <DemoBanner className="mb-4" />
      {notice && <Notice tone="ok" className="mb-4" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {usersQ.isError ? (
        <ErrorState error={usersQ.error} title="Users could not be loaded" onRetry={() => usersQ.refetch()} />
      ) : (
        <Panel bodyClassName="">
          <FilterBar
            className="rounded-none border-0 border-b"
            searchLabel="Search"
            searchPlaceholder="Name or email"
            searchQuery={search}
            onSearchChange={setSearch}
            onSearchClear={() => setSearch('')}
            totalCount={filtered.length}
            totalLabel="users"
            filtersSlot={
              <>
                <FilterSelect
                  label="Role"
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={[{ value: '', label: 'All roles' }, ...Array.from(new Set(users.map((u) => u.role))).map((r) => ({ value: r, label: `${roleLabel(r)} (${r})` }))]}
                />
                <FilterSelect
                  label="Account"
                  value={activeFilter}
                  onChange={setActiveFilter}
                  options={[{ value: '', label: 'Active and inactive' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
                />
              </>
            }
          />
          <DataTable<AdminUser>
            caption="User accounts"
            data={filtered}
            keyExtractor={(u) => u.id}
            columns={[
              { key: 'name', header: 'Name', render: (u) => <><span className="block font-semibold">{u.name}</span><span className="font-mono text-[12px] text-ink-soft">{u.email}</span></> },
              { key: 'role', header: 'Role', render: (u) => <><span className="block">{roleLabel(u.role)}</span><span className="font-mono text-[11px] text-ink-faint">{u.role}</span></> },
              { key: 'inst', header: 'Institution', render: (u) => (u.institutionId ? instName(u.institutionId) ?? <span className="font-mono text-[11.5px]">{u.institutionId}</span> : <span className="text-ink-faint">—</span>) },
              {
                key: 'active',
                header: 'Account',
                render: (u) => (
                  <span className={`rounded-sm border px-1.5 py-[1px] text-[12px] ${u.isActive === false ? 'border-muted-line bg-muted-bg text-muted' : 'border-ok-line bg-ok-bg text-ok'}`}>
                    {u.isActive === false ? 'Inactive' : 'Active'}
                  </span>
                ),
              },
              { key: 'login', header: 'Last sign-in', render: (u) => <span className="whitespace-nowrap">{fmtDateTime(u.lastLoginAt)}</span> },
              { key: 'created', header: 'Created', render: (u) => fmtDate(u.createdAt) },
              {
                key: 'act',
                header: 'Actions',
                render: (u) => {
                  const isSelf = me?.id === u.id || me?.email === u.email;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="sr-only" htmlFor={`role-${u.id}`}>Change role for {u.email}</label>
                      <select
                        id={`role-${u.id}`}
                        className="field-select h-8 w-auto py-0 text-[12.5px]"
                        value=""
                        disabled={isSelf}
                        onChange={(e) => e.target.value && setPending({ user: u, change: { role: e.target.value } })}
                      >
                        <option value="">Change role…</option>
                        {ASSIGNABLE_ROLES.filter((r) => r !== u.role).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => setPending({ user: u, change: { isActive: u.isActive === false } })}
                      >
                        {u.isActive === false ? 'Activate' : 'Deactivate'}
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            emptyState={<p className="p-6 text-center text-sm text-ink-soft">No users match the current filters.</p>}
          />
        </Panel>
      )}
      <p className="mt-2 text-meta text-ink-faint">You cannot change your own role or deactivate your own account here.</p>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create user"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={createUser.isPending}>Cancel</Button>
            <Button size="sm" onClick={submitCreate} isLoading={createUser.isPending}>Create account</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField label="Full name" htmlFor="nu-name" required error={formErrors.name}>
            <input id="nu-name" className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Email address" htmlFor="nu-email" required error={formErrors.email}>
            <input id="nu-email" type="email" className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          <FormField label="Initial password" htmlFor="nu-pass" required error={formErrors.password} helperText="At least 6 characters. Share it with the user through an official channel.">
            <input id="nu-pass" type="password" autoComplete="new-password" className="field-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </FormField>
          <FormField label="Role" htmlFor="nu-role" required>
            <SelectField id="nu-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
          </FormField>
          {INSTITUTION_ROLES.includes(form.role) && (
            <FormField label="Institution" htmlFor="nu-inst" required error={formErrors.institutionId}
              helperText={institutionsQ.isError ? 'Institutions could not be loaded.' : institutions.length === 0 ? 'No institutions are registered yet.' : undefined}>
              <SelectField
                id="nu-inst"
                value={form.institutionId}
                onChange={(e) => setForm({ ...form, institutionId: e.target.value })}
                options={[{ value: '', label: 'Select an institution' }, ...institutions.map((i: any) => ({ value: i.id, label: i.name }))]}
              />
            </FormField>
          )}
          {createError && <Notice tone="bad">{createError}</Notice>}
        </div>
      </Modal>

      <ConfirmationDialog
        isOpen={!!pending}
        onCancel={() => setPending(null)}
        onConfirm={applyChange}
        isLoading={updateUser.isPending}
        isDangerous={pending?.change.isActive === false || pending?.change.role === 'ADMIN'}
        title={pending?.change.role ? 'Change role?' : pending?.change.isActive ? 'Activate account?' : 'Deactivate account?'}
        confirmText={pending?.change.role ? 'Change role' : pending?.change.isActive ? 'Activate' : 'Deactivate'}
        message={
          pending && (
            <p>
              {pending.change.role ? (
                <>Change <strong className="text-ink">{pending.user.email}</strong> from {roleLabel(pending.user.role)} to <strong className="text-ink">{roleLabel(pending.change.role)}</strong>? This changes what the user can see and do the next time they sign in.</>
              ) : pending.change.isActive ? (
                <>Allow <strong className="text-ink">{pending.user.email}</strong> to sign in again?</>
              ) : (
                <>Prevent <strong className="text-ink">{pending.user.email}</strong> from signing in? Existing sessions remain valid until their token expires.</>
              )}
            </p>
          )
        }
        error={pendingError}
      />
    </div>
  );
};

// ==========================================================
// Checklists
// ==========================================================

type Item = ChecklistDefinition['items'][number];

const emptyItem = (): Item => ({ id: '', label: '', docTypes: [], required: true, clauseRef: 'HANDBOOK-REF-TBD', placeholder: true });

export const AdminChecklistsPage: React.FC = () => {
  const listQ = useAdminChecklists();
  const categoriesQ = useCategories();
  const update = useUpdateChecklist();

  const [editing, setEditing] = useState<{ category: string; version: string; items: Item[] } | null>(null);
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (listQ.isLoading) return <PageSkeleton />;

  const checklists = listQ.data ?? [];
  const missingCategories = (categoriesQ.data ?? []).filter((c) => !checklists.some((cl) => cl.category === c.id));

  const startEdit = (c?: ChecklistDefinition, category?: string) => {
    setEditErrors([]);
    setSaveError(null);
    setEditing({
      category: c?.category ?? category ?? '',
      version: c?.version ?? '2026.1',
      items: c ? c.items.map((i) => ({ ...i, docTypes: [...i.docTypes] })) : [emptyItem()],
    });
  };

  const validateEdit = () => {
    if (!editing) return false;
    const errs: string[] = [];
    if (editing.items.length === 0) errs.push('Add at least one item.');
    const ids = new Set<string>();
    editing.items.forEach((it, i) => {
      if (!it.id.trim()) errs.push(`Item ${i + 1}: an identifier is required.`);
      if (ids.has(it.id.trim())) errs.push(`Item ${i + 1}: identifier “${it.id}” is used twice.`);
      ids.add(it.id.trim());
      if (!it.label.trim()) errs.push(`Item ${i + 1}: a label is required.`);
      if (it.docTypes.length === 0) errs.push(`Item ${i + 1}: at least one document type is required.`);
    });
    setEditErrors(errs);
    return errs.length === 0;
  };

  const save = async () => {
    if (!editing) return;
    setSaveError(null);
    try {
      await update.mutateAsync({
        category: editing.category,
        version: editing.version,
        items: editing.items.map((i) => ({ ...i, id: i.id.trim(), label: i.label.trim(), clauseRef: i.clauseRef.trim() || 'HANDBOOK-REF-TBD' })),
      });
      setNotice(`Checklist for ${categoryLabel(editing.category)} saved.`);
      setConfirmSave(false);
      setEditing(null);
    } catch (err) {
      setSaveError(describeApiError(err, 'The checklist could not be saved.').message);
    }
  };

  const setItem = (idx: number, patch: Partial<Item>) =>
    setEditing((e) => (e ? { ...e, items: e.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : e));

  return (
    <div className="page py-6">
      <PageHeader
        title="Document checklists"
        description="Required documents for each application category. Institutions see these items when they upload, and submission is refused while required items are missing."
        breadcrumbs={[{ label: 'Administration', href: '/admin' }, { label: 'Checklists' }]}
      />
      <DemoBanner className="mb-4" />
      {notice && <Notice tone="ok" className="mb-4" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {listQ.isError ? (
        <ErrorState error={listQ.error} title="Checklists could not be loaded" onRetry={() => listQ.refetch()} />
      ) : (
        <div className="space-y-5">
          {checklists.length === 0 && <Panel><p className="text-sm text-ink-soft">No checklists are stored on the server.</p></Panel>}
          {checklists.map((c) => (
            <Panel
              key={c.category}
              title={categoryLabel(c.category)}
              subtitle={<><span className="font-mono">{c.category}</span> · version {c.version ?? '—'} · {c.active === false ? 'inactive' : 'active'}{c.updatedAt ? ` · updated ${fmtDate(c.updatedAt)}` : ''}</>}
              actions={<Button variant="outline" size="sm" onClick={() => startEdit(c)}>Edit</Button>}
              bodyClassName=""
            >
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Item</th><th>Accepted document types</th><th>Required</th><th>Handbook clause</th></tr></thead>
                <tbody>
                  {c.items.map((it) => (
                    <tr key={it.id}>
                      <td><span className="block">{it.label}</span><span className="font-mono text-[11px] text-ink-faint">{it.id}</span></td>
                      <td className="text-[12.5px]">{it.docTypes.map(humanize).join(', ')}</td>
                      <td>{it.required ? 'Required' : 'Optional'}</td>
                      <td>{it.clauseRef && it.clauseRef !== 'HANDBOOK-REF-TBD' && !it.placeholder ? <span className="font-mono text-[12px]">{it.clauseRef}</span> : <PlaceholderTag />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Panel>
          ))}
          {missingCategories.length > 0 && (
            <Panel title="Categories without a stored checklist" subtitle="The server falls back to its built-in defaults for these">
              <ul className="space-y-2 text-sm">
                {missingCategories.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{c.name} <span className="font-mono text-[11.5px] text-ink-faint">{c.id}</span></span>
                    <Button variant="outline" size="sm" onClick={() => startEdit(undefined, c.id)}><Plus className="h-3.5 w-3.5" /> Create checklist</Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit checklist — ${editing ? categoryLabel(editing.category) : ''}`}
        maxWidth="xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={() => validateEdit() && setConfirmSave(true)}>Review and save</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <FormField label="Checklist version" htmlFor="cl-version" required>
              <input id="cl-version" className="field-input max-w-[200px]" value={editing.version} onChange={(e) => setEditing({ ...editing, version: e.target.value })} />
            </FormField>
            <div className="space-y-3">
              {editing.items.map((it, idx) => (
                <fieldset key={idx} className="grid gap-3 rounded border border-line p-3 md:grid-cols-[150px_1fr_1fr_150px_auto]">
                  <legend className="px-1 text-meta font-semibold text-ink-soft">Item {idx + 1}</legend>
                  <FormField label="Identifier" htmlFor={`it-id-${idx}`} required>
                    <input id={`it-id-${idx}`} className="field-input font-mono text-[13px]" value={it.id} onChange={(e) => setItem(idx, { id: e.target.value })} />
                  </FormField>
                  <FormField label="Label" htmlFor={`it-label-${idx}`} required>
                    <input id={`it-label-${idx}`} className="field-input" value={it.label} onChange={(e) => setItem(idx, { label: e.target.value })} />
                  </FormField>
                  <FormField label="Document types" htmlFor={`it-types-${idx}`} required helperText="Comma-separated, e.g. FIRE_NOC">
                    <input
                      id={`it-types-${idx}`}
                      className="field-input font-mono text-[13px]"
                      value={it.docTypes.join(', ')}
                      onChange={(e) => setItem(idx, { docTypes: e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) })}
                    />
                  </FormField>
                  <FormField label="Handbook clause" htmlFor={`it-clause-${idx}`}>
                    <input id={`it-clause-${idx}`} className="field-input font-mono text-[13px]" value={it.clauseRef} onChange={(e) => setItem(idx, { clauseRef: e.target.value, placeholder: !e.target.value || e.target.value === 'HANDBOOK-REF-TBD' })} />
                  </FormField>
                  <div className="flex items-end gap-3 pb-1">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={it.required} onChange={(e) => setItem(idx, { required: e.target.checked })} className="h-4 w-4 accent-[#174a85]" />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) })}
                      className="rounded p-1.5 text-ink-faint hover:bg-bad-bg hover:text-bad"
                      aria-label={`Remove item ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing({ ...editing, items: [...editing.items, emptyItem()] })}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
            {editErrors.length > 0 && (
              <Notice tone="bad" title="Correct the following before saving">
                <ul className="list-disc pl-5">{editErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </Notice>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={confirmSave}
        onCancel={() => setConfirmSave(false)}
        onConfirm={save}
        isLoading={update.isPending}
        title="Save checklist?"
        confirmText="Save checklist"
        message={
          editing && (
            <p>
              Replace the checklist for <strong className="text-ink">{categoryLabel(editing.category)}</strong> with {editing.items.length} item(s),
              version {editing.version}. Applications in this category are evaluated against the saved checklist from now on.
            </p>
          )
        }
        error={saveError}
      />
    </div>
  );
};

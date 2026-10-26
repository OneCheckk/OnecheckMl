import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Institution } from '@contracts';
import { useInstitutions, useCreateInstitution } from '../../api/queries';
import { describeApiError } from '../../api/errors';
import {
  Button,
  ConfirmationDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterSelect,
  FormField,
  Modal,
  Notice,
  PageHeader,
  PageSkeleton,
  Panel,
} from '../../components/ui';
import { DemoBanner } from '../../components/status';
import { humanize } from '../../components/status/statusMaps';

const VERIFICATION_TONE: Record<string, string> = {
  VERIFIED: 'border-ok-line bg-ok-bg text-ok',
  PENDING: 'border-info-line bg-info-bg text-info',
  REJECTED: 'border-bad-line bg-bad-bg text-bad',
};

const EMPTY_FORM = { name: '', registrationId: '', address: '', state: '', latitude: '', longitude: '' };

export const AdminInstitutionsPage: React.FC = () => {
  const q = useInstitutions();
  const create = useCreateInstitution();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState('');
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const institutions = (q.data ?? []) as (Institution & { aicteId?: string })[];
  const states = Array.from(new Set(institutions.map((i) => i.state).filter(Boolean))).sort();
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return institutions.filter(
      (i) =>
        (!status || i.verificationStatus === status) &&
        (!state || i.state === state) &&
        (!s || i.name?.toLowerCase().includes(s) || i.registrationId?.toLowerCase().includes(s) || i.aicteId?.toLowerCase().includes(s))
    );
  }, [institutions, search, status, state]);

  if (q.isLoading) return <PageSkeleton />;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Institution name is required.';
    if (!form.address.trim()) e.address = 'Address is required.';
    if (!form.state.trim()) e.state = 'State is required.';
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (form.latitude === '' || Number.isNaN(lat) || lat < -90 || lat > 90) e.latitude = 'Latitude must be a number between -90 and 90.';
    if (form.longitude === '' || Number.isNaN(lng) || lng < -180 || lng > 180) e.longitude = 'Longitude must be a number between -180 and 180.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setCreateError(null);
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        address: form.address.trim(),
        state: form.state.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        registrationId: form.registrationId.trim() || undefined,
      });
      setConfirm(false);
      setOpen(false);
      setNotice(`${form.name.trim()} was registered with verification status “Pending”.`);
      setForm(EMPTY_FORM);
    } catch (err) {
      setConfirm(false);
      const info = describeApiError(err, 'The institution could not be registered.');
      setCreateError(info.details?.length ? `${info.message} ${info.details.map((d) => d.message).join(' ')}` : info.message);
    }
  };

  const field = (key: keyof typeof EMPTY_FORM, label: string, opts: { required?: boolean; help?: string; type?: string; className?: string } = {}) => (
    <FormField label={label} htmlFor={`inst-${key}`} required={opts.required} error={errors[key]} helperText={opts.help} className={opts.className}>
      <input
        id={`inst-${key}`}
        type={opts.type ?? 'text'}
        inputMode={opts.type === 'number' ? 'decimal' : undefined}
        step={opts.type === 'number' ? 'any' : undefined}
        className="field-input"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </FormField>
  );

  return (
    <div className="page py-6">
      <PageHeader
        title="Institutions"
        description="Institution profiles registered on the server, including the campus coordinates used for photo location checks."
        breadcrumbs={[{ label: 'Administration', href: '/admin' }, { label: 'Institutions' }]}
        actions={
          <Button onClick={() => { setOpen(true); setErrors({}); setCreateError(null); }}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Register institution
          </Button>
        }
      />
      <DemoBanner className="mb-4" />
      {notice && <Notice tone="ok" className="mb-4" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {q.isError ? (
        <ErrorState error={q.error} title="Institutions could not be loaded" onRetry={() => q.refetch()} />
      ) : (
        <Panel bodyClassName="">
          <FilterBar
            className="rounded-none border-0 border-b"
            searchLabel="Search"
            searchPlaceholder="Name or registration ID"
            searchQuery={search}
            onSearchChange={setSearch}
            onSearchClear={() => setSearch('')}
            totalCount={filtered.length}
            totalLabel="institutions"
            filtersSlot={
              <>
                <FilterSelect label="Verification" value={status} onChange={setStatus}
                  options={[{ value: '', label: 'All' }, { value: 'PENDING', label: 'Pending' }, { value: 'VERIFIED', label: 'Verified' }, { value: 'REJECTED', label: 'Rejected' }]} />
                {states.length > 1 && (
                  <FilterSelect label="State" value={state} onChange={setState} options={[{ value: '', label: 'All states' }, ...states.map((s) => ({ value: s, label: s }))]} />
                )}
              </>
            }
          />
          <DataTable<Institution & { aicteId?: string }>
            caption="Registered institutions"
            data={filtered}
            keyExtractor={(i) => i.id}
            columns={[
              { key: 'name', header: 'Institution', render: (i) => <><span className="block font-semibold">{i.name}</span><span className="text-[12px] text-ink-soft">{i.address}</span></> },
              { key: 'reg', header: 'Registration ID', render: (i) => <span className="font-mono text-[12px]">{i.registrationId || i.aicteId || '—'}</span> },
              { key: 'state', header: 'State', render: (i) => i.state || '—' },
              {
                key: 'coords',
                header: 'Campus coordinates',
                render: (i) =>
                  typeof i.latitude === 'number' && typeof i.longitude === 'number' ? (
                    <span className="font-mono text-[12px]">{i.latitude.toFixed(4)}, {i.longitude.toFixed(4)}</span>
                  ) : '—',
              },
              {
                key: 'ver',
                header: 'Profile verification',
                render: (i) => (
                  <span className={`rounded-sm border px-1.5 py-[1px] text-[12px] ${VERIFICATION_TONE[i.verificationStatus] ?? 'border-muted-line bg-muted-bg text-muted'}`}>
                    {humanize(i.verificationStatus) || 'Unknown'}
                  </span>
                ),
              },
            ]}
            emptyState={<EmptyState title="No institutions" description={institutions.length ? 'No institutions match the current filters.' : 'No institution profiles are registered yet.'} />}
          />
        </Panel>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Register institution"
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => validate() && setConfirm(true)}>Review and register</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Institution name', { required: true, className: 'sm:col-span-2' })}
          {field('registrationId', 'Registration ID', { help: 'Optional. Must be unique.' })}
          {field('state', 'State / UT', { required: true })}
          {field('address', 'Campus address', { required: true, className: 'sm:col-span-2' })}
          {field('latitude', 'Campus latitude', { required: true, type: 'number', help: 'Decimal degrees, e.g. 28.6280' })}
          {field('longitude', 'Campus longitude', { required: true, type: 'number', help: 'Decimal degrees, e.g. 77.3649' })}
          {createError && <Notice tone="bad" className="sm:col-span-2">{createError}</Notice>}
        </div>
      </Modal>

      <ConfirmationDialog
        isOpen={confirm}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
        isLoading={create.isPending}
        title="Register this institution?"
        confirmText="Register"
        message={<p>Create a profile for <strong className="text-ink">{form.name.trim()}</strong> ({form.state.trim()}) at {form.latitude}, {form.longitude}. Photo location checks use these coordinates.</p>}
      />
    </div>
  );
};

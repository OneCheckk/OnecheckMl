import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useCategories, useCreateApplication } from '../../api/queries';
import { describeApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import { Button, ErrorState, FormField, Notice, PageHeader, PageSkeleton, Panel, SelectField } from '../../components/ui';
import { zodResolver } from '../../lib/zodResolver';

/**
 * Fields come from the backend contract for POST /api/applications:
 *   category (required) and academicYear (optional; server default 2026-2027).
 * The institution is taken from the signed-in account by the server.
 * `institutionName` is sent for the mock layer only (the API ignores it).
 */
const schema = z.object({
  category: z.string().min(1, 'Select an application category.'),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'Select an academic year.'),
});
type Values = z.infer<typeof schema>;

const ACADEMIC_YEARS = ['2026-2027', '2027-2028'];

const STEPS = ['Application details', 'Review and create'];

export const NewApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: categories, isLoading, isError, error, refetch } = useCategories();
  const createMutation = useCreateApplication();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<ReturnType<typeof describeApiError> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { category: '', academicYear: '2026-2027' },
    mode: 'onTouched',
  });

  const values = watch();
  const selectedCategory = useMemo(() => categories?.find((c) => c.id === values.category), [categories, values.category]);

  const goNext = async () => {
    if (await trigger()) setStep(1);
  };

  const onCreate = async (v: Values) => {
    setSubmitError(null);
    try {
      const created = await createMutation.mutateAsync({
        category: v.category,
        academicYear: v.academicYear,
        institutionName: user?.institutionName,
      });
      if (created?.id) navigate(`/portal/applications/${created.id}`);
      else navigate('/portal');
    } catch (err) {
      setSubmitError(describeApiError(err));
    }
  };

  if (isLoading) return <PageSkeleton rows={1} />;

  return (
    <div className="page py-6">
      <PageHeader
        title="Create application"
        description="Start a new application. After it is created you will upload the documents required for its category."
        breadcrumbs={[{ label: 'Dashboard', href: '/portal' }, { label: 'Create application' }]}
      />

      {isError ? (
        <ErrorState error={error} title="Application categories could not be loaded" onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[220px_1fr]">
          {/* Step indicator */}
          <ol className="flex gap-2 lg:flex-col lg:gap-0" aria-label="Progress">
            {STEPS.map((label, i) => {
              const state = i < step ? 'done' : i === step ? 'current' : 'todo';
              return (
                <li
                  key={label}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className="flex flex-1 items-center gap-2.5 border-b-2 py-2 text-sm lg:border-b-0 lg:border-l-2 lg:pl-3"
                  style={{ borderColor: state === 'todo' ? '#d3dae3' : '#174a85' }}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                      state === 'todo' ? 'border border-line-strong text-ink-faint' : 'bg-brand-700 text-white'
                    }`}
                  >
                    {state === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={state === 'current' ? 'font-semibold text-ink' : 'text-ink-soft'}>{label}</span>
                </li>
              );
            })}
          </ol>

          <form onSubmit={handleSubmit(onCreate)} noValidate>
            {step === 0 && (
              <Panel title="Application details">
                <div className="grid max-w-2xl gap-5">
                  <div>
                    <p className="field-label">Applicant institution</p>
                    <p className="rounded border border-line bg-muted-bg px-3 py-2 text-sm text-ink">
                      {user?.institutionName || 'Institution linked to your account'}
                    </p>
                    <p className="field-help">Set by your account. The server files the application against this institution.</p>
                  </div>

                  <FormField label="Application category" htmlFor="category" required error={errors.category?.message}
                    helperText={selectedCategory ? `The checklist for this category lists ${selectedCategory.checklistCount} required document types.` : 'The required-document checklist depends on the category.'}>
                    <SelectField
                      id="category"
                      aria-invalid={!!errors.category}
                      {...register('category')}
                      options={[{ value: '', label: 'Select a category' }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
                    />
                  </FormField>

                  <FormField label="Academic year" htmlFor="academicYear" required error={errors.academicYear?.message}
                    helperText="The session for which approval is sought.">
                    <SelectField
                      id="academicYear"
                      {...register('academicYear')}
                      options={ACADEMIC_YEARS.map((y) => ({ value: y, label: y }))}
                      className="max-w-[220px]"
                    />
                  </FormField>
                </div>
                <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-line-soft pt-4">
                  <Button variant="outline" onClick={() => navigate('/portal')}>
                    Cancel
                  </Button>
                  <Button onClick={goNext}>
                    Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </Panel>
            )}

            {step === 1 && (
              <Panel title="Review and create">
                <dl className="meta-list max-w-2xl sm:grid-cols-[200px_1fr]">
                  <dt>Applicant institution</dt>
                  <dd>{user?.institutionName || 'Institution linked to your account'}</dd>
                  <dt>Category</dt>
                  <dd>{selectedCategory?.name ?? values.category}</dd>
                  <dt>Academic year</dt>
                  <dd>{values.academicYear}</dd>
                  <dt>Initial status</dt>
                  <dd>Draft — not visible to scrutiny officers until you submit it</dd>
                </dl>

                <Notice tone="info" className="mt-5 max-w-2xl" title="What happens next">
                  The application is created as a draft. You will then upload each required document, can run a
                  self-check, and submit when ready. Creating the draft does not submit anything for scrutiny.
                </Notice>

                {submitError && (
                  <Notice tone="bad" className="mt-4 max-w-2xl" title={submitError.title}>
                    {submitError.message}
                    {submitError.details && (
                      <ul className="mt-1 list-disc pl-5">
                        {submitError.details.map((d, i) => (
                          <li key={i}>{d.message}</li>
                        ))}
                      </ul>
                    )}
                  </Notice>
                )}

                <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-line-soft pt-4">
                  <Button variant="outline" onClick={() => setStep(0)} disabled={createMutation.isPending}>
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
                  </Button>
                  <Button type="submit" isLoading={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating draft…' : 'Create draft application'}
                  </Button>
                </div>
              </Panel>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

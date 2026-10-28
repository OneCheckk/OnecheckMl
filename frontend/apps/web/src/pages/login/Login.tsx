import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, Copy, Eye, EyeOff, KeyRound, LogIn, Terminal } from 'lucide-react';
import type { UserRole } from '@contracts';
import { useAuth } from '../../auth/AuthProvider';
import { Button, FormField, Notice } from '../../components/ui';
import { describeApiError } from '../../api/errors';
import { zodResolver } from '../../lib/zodResolver';
import { IS_DEV } from '../../config';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address, for example name@institution.ac.in.'),
  password: z.string().min(1, 'Enter your password.'),
});
type LoginValues = z.infer<typeof loginSchema>;

export interface DemoAccount {
  role: string;
  roleCode: UserRole;
  email: string;
  password: string;
  landingPage: string;
  description: string;
}

/**
 * Pre-configured demonstration accounts for Smart India Hackathon & jury scrutiny.
 * Always available in deployment and local environments so evaluators can test any role instantly.
 */
export const DEMO_CREDENTIALS: DemoAccount[] = [
  {
    role: 'Institution User',
    roleCode: 'INSTITUTION_USER',
    email: 'director@apex-tech.edu.in',
    password: 'Institution@123456',
    landingPage: '/portal',
    description: 'Institution dashboard, applications and document uploads',
  },
  {
    role: 'Scrutiny Officer',
    roleCode: 'SCRUTINY_OFFICER',
    email: 'officer@onecheck.gov.in',
    password: 'Officer@123456',
    landingPage: '/review',
    description: 'Review queue, case inspection, alerts and deficiency letters',
  },
  {
    role: 'Regional Director',
    roleCode: 'REGIONAL_DIRECTOR',
    email: 'director.regional@onecheck.gov.in',
    password: 'Director@123456',
    landingPage: '/review',
    description: 'Regional overview, high-risk approvals and escalated scrutiny',
  },
  {
    role: 'Administrator',
    roleCode: 'ADMIN',
    email: 'admin@onecheck.gov.in',
    password: 'Admin@123456',
    landingPage: '/admin',
    description: 'Overview, institutions, users, checklists, rulepacks, audit trail',
  },
  {
    role: 'Auditor',
    roleCode: 'AUDITOR',
    email: 'auditor@onecheck.gov.in',
    password: 'Auditor@123456',
    landingPage: '/audit',
    description: 'Audit trail and chain verification',
  },
];

const DEV_ROLES: { role: UserRole; label: string }[] = [
  { role: 'INSTITUTION', label: 'Institution' },
  { role: 'SCRUTINY_OFFICER', label: 'Scrutiny officer' },
  { role: 'ADMIN', label: 'Administrator' },
  { role: 'AUDITOR', label: 'Auditor' },
];

export const LoginPage: React.FC = () => {
  const { login, devBypassLogin, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fillFeedback, setFillFeedback] = useState<string | null>(null);
  const [authError, setAuthError] = useState<{ title: string; message: string; requestId?: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values: LoginValues) => {
    setAuthError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      const info = describeApiError(err);
      if (info.status === 401) {
        setAuthError({ title: 'Sign-in failed', message: 'The email address or password is incorrect, or the account is inactive.' });
      } else if (info.status === 429) {
        setAuthError({
          title: 'Too many sign-in attempts',
          message: 'Sign-in is temporarily limited for this connection. Please wait a few minutes and try again.',
        });
      } else if (info.status === 400) {
        setAuthError({ title: 'Check the details entered', message: info.message, requestId: info.requestId });
      } else {
        setAuthError({ title: info.title, message: info.message, requestId: info.requestId });
      }
    }
  };

  const handleCopy = (text: string, id: string) => {
    try {
      navigator.clipboard?.writeText(text);
      setCopiedField(id);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback ignore
    }
  };

  const handleFill = (account: DemoAccount) => {
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', account.password, { shouldValidate: true });
    setAuthError(null);
    setFillFeedback(`Loaded ${account.role} credentials`);
    setTimeout(() => setFillFeedback(null), 3000);
    setFocus('password');
  };

  const handleQuickLogin = async (account: DemoAccount) => {
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', account.password, { shouldValidate: true });
    setAuthError(null);
    try {
      await login(account.email, account.password, account.roleCode);
    } catch (err) {
      const info = describeApiError(err);
      setAuthError({ title: info.title, message: info.message, requestId: info.requestId });
    }
  };

  const busy = isLoading || isSubmitting;

  return (
    <div className="page py-8 lg:py-10">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-8">
        {/* Sign-in panel */}
        <section className="panel self-start" aria-labelledby="signin-title">
          <div className="panel-header">
            <h1 id="signin-title" className="text-[16px] font-semibold text-brand-900">
              Sign in to OneCheck
            </h1>
          </div>
          <div className="panel-body space-y-4">
            <p className="text-sm text-ink-soft">
              Use the email address registered for your account. Your access is set by the role assigned to that
              account.
            </p>

            {/* Quick-fill chips */}
            <div className="rounded border border-line bg-slate-50/80 p-2.5">
              <span className="text-[11.5px] font-semibold text-ink-soft block mb-1.5">
                Quick evaluation fill:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_CREDENTIALS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleFill(acc)}
                    className="text-[11px] px-2 py-0.5 rounded border border-line bg-white hover:border-brand-500 hover:text-brand-800 transition-colors font-medium shadow-2xs"
                  >
                    {acc.role}
                  </button>
                ))}
              </div>
            </div>

            {fillFeedback && (
              <div className="text-[12px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span>{fillFeedback}. Click <strong>Sign in</strong> to proceed.</span>
              </div>
            )}

            {authError && (
              <Notice tone="bad" title={authError.title}>
                {authError.message}
                {authError.requestId && (
                  <span className="mt-1 block text-[11.5px] text-ink-faint">Request ID: {authError.requestId}</span>
                )}
              </Notice>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <FormField label="Email address" htmlFor="login-email" required error={errors.email?.message}>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  disabled={busy}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  className="field-input"
                  {...register('email')}
                />
              </FormField>

              <FormField label="Password" htmlFor="login-password" required error={errors.password?.message}>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    disabled={busy}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    className="field-input pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-faint hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <div className="flex items-center justify-between text-sm">
                <Link to="/forgot-password" className="link">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" size="lg" className="w-full" isLoading={busy}>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="border-t border-line-soft pt-3 text-sm text-ink-soft">
              New institution?{' '}
              <Link to="/signup" className="link">
                How to get an account
              </Link>
            </p>
          </div>
        </section>

        {/* Information & Credentials section */}
        <div className="space-y-6">
          {/* 1. Demonstration Credentials Table — ALWAYS visible in deployment */}
          <section aria-labelledby="demo-credentials-title" className="panel shadow-xs">
            <div className="panel-header flex items-center justify-between">
              <div>
                <h2 id="demo-credentials-title" className="panel-title flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-brand-700" aria-hidden="true" />
                  Demonstration Credentials
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Evaluation accounts for Smart India Hackathon jury scrutiny. Click <strong>Auto-fill</strong> or <strong>Sign In</strong> to test immediately.
                </p>
              </div>
              <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Evaluation Access
              </span>
            </div>
            <div className="panel-body p-0 overflow-x-auto">
              <table className="data-table w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-line text-ink-soft">
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5">Role</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5">Email Address</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5">Password</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5">Landing Page</th>
                    <th scope="col" className="text-right whitespace-nowrap px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {DEMO_CREDENTIALS.map((acc) => (
                    <tr key={acc.email} className="hover:bg-slate-50/70 transition-colors">
                      <td className="font-semibold text-ink whitespace-nowrap px-3 py-2.5">
                        <div>{acc.role}</div>
                        <div className="text-[11px] font-normal text-ink-faint hidden xl:block max-w-[200px] truncate">
                          {acc.description}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="inline-flex items-center gap-1.5">
                          <code className="rounded bg-[#1e293b] text-[#f8fafc] px-2 py-0.5 font-mono text-[11.5px] border border-slate-700">
                            {acc.email}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.email, `email-${acc.email}`)}
                            title="Copy email"
                            className="text-ink-faint hover:text-ink p-1 rounded hover:bg-slate-200 transition-colors"
                            aria-label={`Copy email for ${acc.role}`}
                          >
                            {copiedField === `email-${acc.email}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="inline-flex items-center gap-1.5">
                          <code className="rounded bg-[#1e293b] text-[#f8fafc] px-2 py-0.5 font-mono text-[11.5px] border border-slate-700">
                            {acc.password}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.password, `pass-${acc.email}`)}
                            title="Copy password"
                            className="text-ink-faint hover:text-ink p-1 rounded hover:bg-slate-200 transition-colors"
                            aria-label={`Copy password for ${acc.role}`}
                          >
                            {copiedField === `pass-${acc.email}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-block rounded bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[11.5px] px-2 py-0.5 font-semibold">
                          {acc.landingPage}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleFill(acc)}
                            className="text-[12px] font-semibold px-2.5 py-1 rounded border border-line bg-white hover:bg-brand-50 hover:text-brand-800 hover:border-brand-300 transition-colors"
                          >
                            Auto-fill
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickLogin(acc)}
                            disabled={busy}
                            className="text-[12px] font-semibold px-2.5 py-1 rounded bg-brand-700 hover:bg-brand-800 text-white transition-colors"
                          >
                            Sign In
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 border-t border-line px-4 py-2 text-xs text-ink-soft flex items-center justify-between">
              <span>💡 Tip: Click <strong>Sign In</strong> next to any role to log in with that profile.</span>
            </div>
          </section>

          {/* 2. Access by Role Table */}
          <section aria-labelledby="access-title" className="panel">
            <div className="panel-header">
              <h2 id="access-title" className="panel-title">
                Access by role
              </h2>
            </div>
            <div className="panel-body p-0">
              <table className="data-table w-full text-left text-sm border-0">
                <thead>
                  <tr className="bg-slate-50 border-b border-line text-ink-soft">
                    <th scope="col" className="px-3 py-2.5">Role</th>
                    <th scope="col" className="px-3 py-2.5">After signing in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  <tr>
                    <td className="font-semibold px-3 py-2.5">Institution user</td>
                    <td className="text-ink-soft px-3 py-2.5">Institution dashboard, applications and document uploads</td>
                  </tr>
                  <tr>
                    <td className="font-semibold px-3 py-2.5">Scrutiny officer / Regional director</td>
                    <td className="text-ink-soft px-3 py-2.5">Review queue, case inspection, alerts and deficiency letters</td>
                  </tr>
                  <tr>
                    <td className="font-semibold px-3 py-2.5">Administrator</td>
                    <td className="text-ink-soft px-3 py-2.5">Overview, institutions, users, checklists, rulepacks, audit trail</td>
                  </tr>
                  <tr>
                    <td className="font-semibold px-3 py-2.5">Auditor</td>
                    <td className="text-ink-soft px-3 py-2.5">Audit trail and chain verification</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {IS_DEV && (
            <section aria-labelledby="dev-title" className="panel">
              <div className="panel-header">
                <h2 id="dev-title" className="panel-title flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                  Development sign-in bypass
                </h2>
              </div>
              <div className="panel-body space-y-2 text-sm">
                <p className="text-meta text-ink-faint">
                  Development builds only. Directly creates an authenticated role session without typing.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {DEV_ROLES.map((r) => (
                    <Button key={r.role} variant="outline" size="sm" onClick={() => devBypassLogin(r.role)}>
                      {r.label}
                    </Button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

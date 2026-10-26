import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, Terminal } from 'lucide-react';
import type { UserRole } from '@contracts';
import { useAuth } from '../../auth/AuthProvider';
import { Button, FormField, Notice } from '../../components/ui';
import { describeApiError } from '../../api/errors';
import { zodResolver } from '../../lib/zodResolver';
import { IS_DEV, IS_MOCK_MODE } from '../../config';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address, for example name@institution.ac.in.'),
  // The backend requires a password unless it runs in DEMO_MODE; the form always asks for one.
  password: z.string().min(1, 'Enter your password.'),
});
type LoginValues = z.infer<typeof loginSchema>;

/**
 * Accounts created by the backend seed script (OneCheckBackend `npm run seed:dev`).
 * Shown only in development or mock mode. Passwords are deliberately not embedded
 * here; they are documented in the backend README.
 */
const DEMO_ACCOUNTS = [
  { email: 'director@apex-tech.edu.in', role: 'Institution user' },
  { email: 'officer@onecheck.gov.in', role: 'Scrutiny officer' },
  { email: 'director.regional@onecheck.gov.in', role: 'Regional director' },
  { email: 'admin@onecheck.gov.in', role: 'Administrator' },
  { email: 'auditor@onecheck.gov.in', role: 'Auditor' },
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

  const busy = isLoading || isSubmitting;

  return (
    <div className="page py-8 lg:py-10">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-10">
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

        {/* Information */}
        <div className="space-y-5">
          <section aria-labelledby="access-title">
            <h2 id="access-title" className="section-title">
              Access by role
            </h2>
            <table className="data-table mt-3 rounded border border-line bg-white">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">After signing in</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">Institution user</td>
                  <td className="text-ink-soft">Institution dashboard, applications and document uploads</td>
                </tr>
                <tr>
                  <td className="font-semibold">Scrutiny officer / Regional director</td>
                  <td className="text-ink-soft">Review queue, case inspection, alerts and deficiency letters</td>
                </tr>
                <tr>
                  <td className="font-semibold">Administrator</td>
                  <td className="text-ink-soft">Overview, institutions, users, checklists, rulepacks, audit trail</td>
                </tr>
                <tr>
                  <td className="font-semibold">Auditor</td>
                  <td className="text-ink-soft">Audit trail and chain verification</td>
                </tr>
              </tbody>
            </table>
          </section>

          {(IS_DEV || IS_MOCK_MODE) && (
            <section aria-labelledby="demo-title" className="panel">
              <div className="panel-header">
                <h2 id="demo-title" className="panel-title">
                  Demonstration accounts
                </h2>
                <span className="rounded-sm border border-warn-line bg-warn-bg px-1.5 text-[11px] font-semibold text-warn">
                  {IS_MOCK_MODE ? 'Mock mode' : 'Development build'}
                </span>
              </div>
              <div className="panel-body space-y-3 text-sm">
                <p className="text-ink-soft">
                  {IS_MOCK_MODE
                    ? 'The mock layer assigns a role from the email address and accepts any password.'
                    : 'These accounts are created by the backend seed script (npm run seed:dev). Their passwords are listed in the backend README.'}
                </p>
                <ul className="divide-y divide-line-soft rounded border border-line">
                  {DEMO_ACCOUNTS.map((a) => (
                    <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span>
                        <span className="block font-mono text-[12.5px] text-ink">{a.email}</span>
                        <span className="text-meta text-ink-faint">{a.role}</span>
                      </span>
                      <button
                        type="button"
                        className="link text-[13px]"
                        onClick={() => {
                          setValue('email', a.email, { shouldValidate: true });
                          setFocus('password');
                        }}
                      >
                        Use this email
                      </button>
                    </li>
                  ))}
                </ul>

                {IS_DEV && (
                  <div data-testid="dev-bypass-login" className="rounded border border-line bg-[#f6f8fa] p-3">
                    <p className="flex items-center gap-1.5 font-semibold text-ink">
                      <Terminal className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                      Development sign-in
                    </p>
                    <p className="mt-0.5 text-meta text-ink-faint">
                      Development builds only. Tries the API first; if it is unreachable, opens a local test session that
                      is clearly marked as such.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {DEV_ROLES.map((r) => (
                        <Button key={r.role} variant="outline" size="sm" onClick={() => devBypassLogin(r.role)}>
                          {r.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

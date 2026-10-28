import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, Copy, Eye, EyeOff, KeyRound, LogIn, ShieldCheck, Terminal } from 'lucide-react';
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
    setFillFeedback(`${account.role} credentials loaded`);
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
    <div className="page py-8 lg:py-12 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid gap-8 grid-cols-1 lg:grid-cols-[minmax(440px,490px)_1fr] items-start">
        {/* Focused Hero Sign-in card (Enlarged, primary emphasis) */}
        <section
          className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-8 overflow-hidden ring-1 ring-slate-900/5"
          aria-labelledby="signin-title"
        >
          {/* Subtle brand top accent bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-700 via-blue-600 to-indigo-600" />

          <div className="mb-6 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-50 text-brand-800 border border-brand-200/70">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-700" />
              Secure Portal Access
            </span>
            <h1 id="signin-title" className="text-2xl sm:text-[26px] font-extrabold text-brand-950 tracking-tight leading-tight">
              Sign in to OneCheck
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Use your registered institutional or officer email address to access your scrutiny workspace.
            </p>
          </div>

          <div className="space-y-4">
            {fillFeedback && (
              <div className="text-[12.5px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{fillFeedback}. Click <strong>Sign in</strong> to continue.</span>
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
                  className="field-input h-11 text-sm rounded-lg"
                  placeholder="name@institution.ac.in or officer@onecheck.gov.in"
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
                    className="field-input h-11 text-sm rounded-lg pr-10"
                    placeholder="Enter account password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <div className="flex items-center justify-between text-sm pt-0.5">
                <Link to="/forgot-password" className="text-brand-700 hover:text-brand-800 font-medium hover:underline text-xs sm:text-sm">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" size="lg" className="w-full h-11 text-sm font-bold shadow-sm rounded-xl" isLoading={busy}>
                <LogIn className="h-4 w-4 mr-2" aria-hidden="true" />
                {busy ? 'Signing in…' : 'Sign in to Portal'}
              </Button>
            </form>

            <p className="border-t border-slate-200/80 pt-4 text-xs sm:text-sm text-slate-500 text-center">
              New institution?{' '}
              <Link to="/signup" className="text-brand-700 font-semibold hover:underline">
                How to get an account
              </Link>
            </p>
          </div>
        </section>

        {/* Right column: Compact Demonstration Credentials Card (Reduced footprint) */}
        <div className="space-y-4">
          <section
            aria-labelledby="demo-credentials-title"
            className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden"
          >
            {/* Slim Header */}
            <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand-50 border border-brand-200/80 flex items-center justify-center text-brand-700">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="demo-credentials-title" className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">
                    Demonstration Credentials
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Pre-seeded test accounts for Smart India Hackathon jury scrutiny.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-[10.5px] px-2 py-0.5">
                Evaluation Access
              </span>
            </div>

            {/* Compact Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th scope="col" className="whitespace-nowrap px-3 py-2">Role</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2">Email Address</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2">Password</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2">Landing Page</th>
                    <th scope="col" className="text-right whitespace-nowrap px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DEMO_CREDENTIALS.map((acc) => (
                    <tr key={acc.email} className="hover:bg-slate-50/60 transition-colors">
                      <td className="font-semibold text-slate-900 whitespace-nowrap px-3 py-2">
                        {acc.role}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="inline-flex items-center gap-1">
                          <code className="rounded bg-[#0f172a] text-[#f8fafc] px-1.5 py-0.5 font-mono text-[11px] tracking-tight border border-slate-800">
                            {acc.email}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.email, `email-${acc.email}`)}
                            title="Copy email"
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100"
                            aria-label={`Copy email for ${acc.role}`}
                          >
                            {copiedField === `email-${acc.email}` ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="inline-flex items-center gap-1">
                          <code className="rounded bg-[#0f172a] text-[#f8fafc] px-1.5 py-0.5 font-mono text-[11px] tracking-tight border border-slate-800">
                            {acc.password}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.password, `pass-${acc.email}`)}
                            title="Copy password"
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100"
                            aria-label={`Copy password for ${acc.role}`}
                          >
                            {copiedField === `pass-${acc.email}` ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="inline-block rounded bg-blue-50 border border-blue-200/80 text-blue-700 font-mono text-[10.5px] px-1.5 py-0.5 font-semibold">
                          {acc.landingPage}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap px-3 py-2">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleFill(acc)}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                          >
                            Auto-fill
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickLogin(acc)}
                            disabled={busy}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-700 hover:bg-brand-800 text-white transition-colors"
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

            {/* Slim Footer */}
            <div className="px-3.5 py-1.5 bg-slate-50/70 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span>💡 Tip: Click <strong>Sign In</strong> next to any role to evaluate that portal view directly.</span>
            </div>
          </section>

          {IS_DEV && (
            <section aria-labelledby="dev-title" className="panel p-3">
              <div className="panel-header p-0 pb-2 border-0">
                <h2 id="dev-title" className="panel-title flex items-center gap-1.5 text-xs">
                  <Terminal className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
                  Development sign-in bypass
                </h2>
              </div>
              <div className="space-y-1.5 text-xs">
                <p className="text-meta text-ink-faint">
                  Development builds only. Directly creates an authenticated role session without typing.
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
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

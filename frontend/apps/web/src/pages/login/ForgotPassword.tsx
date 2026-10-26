import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Notice, PageHeader } from '../../components/ui';

/**
 * Password assistance.
 *
 * The OneCheck API does not expose a password-reset endpoint, so this page does
 * not collect an email address or claim that a reset link has been sent.
 */
export const ForgotPasswordPage: React.FC = () => (
  <div className="page py-8">
    <PageHeader
      title="Password assistance"
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Sign in', href: '/login' }, { label: 'Password assistance' }]}
    />
    <div className="max-w-2xl space-y-5">
      <Notice tone="info" title="Self-service password reset is not available in this version">
        OneCheck does not send reset links or one-time codes. Password changes are handled by the administrator for your
        deployment.
      </Notice>

      <section className="panel" aria-labelledby="what-to-do">
        <div className="panel-header">
          <h2 id="what-to-do" className="panel-title">
            What to do
          </h2>
        </div>
        <ul className="list-disc space-y-2 py-4 pl-9 pr-4 text-sm text-ink-soft">
          <li>Check that you are using the email address registered for your account.</li>
          <li>
            After several unsuccessful attempts, sign-in is temporarily limited for your connection. Wait a few minutes
            before trying again.
          </li>
          <li>
            If you still cannot sign in, contact your OneCheck administrator. For security, the administrator should
            confirm your identity through an official channel before restoring access.
          </li>
        </ul>
      </section>

      <Link to="/login" className="inline-flex items-center gap-1.5 link text-sm">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </Link>
    </div>
  </div>
);

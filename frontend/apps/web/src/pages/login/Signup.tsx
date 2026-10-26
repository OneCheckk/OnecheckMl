import React from 'react';
import { Link } from 'react-router-dom';
import { Notice, PageHeader } from '../../components/ui';

/**
 * Institution registration.
 *
 * The OneCheck API has no public self-registration endpoint: user accounts are
 * created by an administrator (POST /api/admin/users) and institution profiles
 * via POST /api/institutions by an authenticated user. This page therefore
 * explains the process instead of presenting a form that would not be saved.
 */
export const SignupPage: React.FC = () => (
  <div className="page py-8">
    <PageHeader
      title="Institution accounts"
      description="How an institution obtains access to OneCheck."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Institution accounts' }]}
    />

    <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Notice tone="info" title="Self-registration is not available in this version">
          Institution user accounts are created by the OneCheck administrator for your deployment. No information
          entered on this site creates an account automatically.
        </Notice>

        <section className="panel" aria-labelledby="steps-title">
          <div className="panel-header">
            <h2 id="steps-title" className="panel-title">
              Steps to obtain access
            </h2>
          </div>
          <ol className="list-decimal space-y-2.5 py-4 pl-9 pr-4 text-sm text-ink-soft">
            <li>Contact the administrator responsible for your OneCheck deployment and request an institution account.</li>
            <li>
              Provide the institution's registered profile details (listed alongside). The administrator records the
              institution profile and links your user account to it.
            </li>
            <li>You receive sign-in details for your official email address from the administrator.</li>
            <li>
              Sign in. You will see only your own institution's applications; the server enforces this on every request.
            </li>
          </ol>
        </section>
      </div>

      <aside className="panel self-start" aria-labelledby="prepare-title">
        <div className="panel-header">
          <h2 id="prepare-title" className="panel-title">
            Information the profile requires
          </h2>
        </div>
        <dl className="divide-y divide-line-soft text-sm">
          {[
            ['Institution name', 'As registered'],
            ['Address', 'Campus postal address'],
            ['State', 'State or Union Territory'],
            ['Campus latitude and longitude', 'Used to check that infrastructure photos were taken on campus'],
            ['Official email', 'For the institution user account'],
          ].map(([t, d]) => (
            <div key={t} className="px-4 py-2.5">
              <dt className="font-semibold text-ink">{t}</dt>
              <dd className="text-meta text-ink-faint">{d}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-line-soft px-4 py-3 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </div>
      </aside>
    </div>
  </div>
);

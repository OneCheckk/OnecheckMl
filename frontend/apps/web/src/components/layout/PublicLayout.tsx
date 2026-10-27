import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Menu, X, LogIn } from 'lucide-react';
import { GovtTopBar, AppFooter, BrandBlock } from '../ui';
import { useAuth } from '../../auth/AuthProvider';
import { homePathForRole } from '../../auth/routeAccess';

/** Public navigation: only real destinations (sections of the home page and the sign-in route). */
const PUBLIC_LINKS = [
  { href: '/', label: 'Home', exact: true },
  { href: '/#about', label: 'About' },
  { href: '/#capabilities', label: 'Capabilities' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#statuses', label: 'Verification statuses' },
];

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // ADDED: Define isLanding based on the current location path
  const isLanding = location.pathname === '/';

  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  // Scroll to in-page anchors when navigating with a hash
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  const linkClass = (active: boolean) =>
    clsx(
      'flex h-11 items-center px-3.5 text-[13.5px] border-b-[3px]',
      active ? 'border-saffron bg-brand-800 font-semibold text-white' : 'border-transparent text-white/90 hover:bg-brand-800 hover:text-white'
    );

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {!isLanding && <GovtTopBar />}
      {!isLanding && (
        <header className="border-b border-line bg-white">
          <div className="page flex h-[72px] items-center justify-between gap-3">
            <BrandBlock />
            <div className="flex items-center gap-2">
              {isAuthenticated && user ? (
                <Link
                  to={homePathForRole(user.role)}
                  className="hidden h-9 items-center rounded border border-brand-700 bg-brand-700 px-3.5 text-sm font-semibold text-white hover:bg-brand-800 sm:inline-flex"
                >
                  Go to workspace
                </Link>
              ) : (
                location.pathname !== '/login' && (
                  <Link
                    to="/login"
                    className="hidden h-9 items-center gap-1.5 rounded border border-brand-700 bg-brand-700 px-3.5 text-sm font-semibold text-white hover:bg-brand-800 sm:inline-flex"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Sign in
                  </Link>
                )
              )}
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-line-strong md:hidden"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                aria-controls="public-nav-mobile"
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <nav aria-label="Primary" className="hidden bg-brand-900 md:block">
            <ul className="page flex items-stretch gap-0.5">
              {PUBLIC_LINKS.map((l) => {
                const active = l.exact ? location.pathname === '/' && !location.hash : location.pathname === '/' && location.hash === l.href.slice(1);
                return (
                  <li key={l.href}>
                    <Link to={l.href} className={linkClass(active)} aria-current={active ? 'page' : undefined}>
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {open && (
            <nav id="public-nav-mobile" aria-label="Primary" className="border-t border-line bg-white md:hidden">
              <ul className="py-1">
                {[...PUBLIC_LINKS, { href: '/login', label: 'Sign in' }].map((l) => (
                  <li key={l.href}>
                    <Link to={l.href} className="flex min-h-[44px] items-center px-4 text-[14.5px] text-ink hover:bg-brand-50">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </header>
      )}
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        <Outlet />
      </main>
      {!isLanding && <AppFooter />}
    </div>
  );
};
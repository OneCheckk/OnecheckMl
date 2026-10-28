import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { LogOut, Menu, X, Sliders, ChevronDown, UserCircle2, Network, LogIn } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { GovtTopBar, AppFooter, BrandBlock } from '../ui';
import { DemoControlsDrawer } from '../demo/DemoControlsDrawer';
import { useSSE } from '../../api/sse';
import { navItemsForRole, type NavItem } from './navigation';
import { HelpDialog } from './HelpDialog';
import { roleLabel } from '../status/statusMaps';
import { homePathForRole, isOfficerRole } from '../../auth/routeAccess';
import { IS_MOCK_MODE } from '../../config';

const isItemActive = (item: NavItem, pathname: string) => {
  if (item.end) {
    return pathname === item.to || (item.matches ?? []).some((m) => pathname.startsWith(m));
  }
  return pathname === item.to || pathname.startsWith(item.to + '/') || (item.matches ?? []).some((m) => pathname.startsWith(m));
};

const ConnectionIndicator: React.FC<{ state: string }> = ({ state }) => {
  const label =
    state === 'connected' ? 'Live updates on' : state === 'polling' ? 'Refreshing every 5 s' : state === 'reconnecting' ? 'Reconnecting' : 'Live updates off';
  return (
    <span className="hidden xl:inline-flex items-center gap-1.5 text-[12px] text-ink-faint" title={`Event stream: ${state}`}>
      <span
        className={clsx('h-2 w-2 rounded-full', state === 'connected' ? 'bg-ok' : state === 'polling' ? 'bg-warn' : 'bg-line-strong')}
        aria-hidden="true"
      />
      {label}
    </span>
  );
};

export const AppLayout: React.FC = () => {
  const { user, logout, isDevSession } = useAuth();
  const location = useLocation();
  const { connectionState } = useSSE();
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navItems: NavItem[] = user
    ? navItemsForRole(user.role)
    : [{ to: '/syndicate', label: 'Syndicate Network', icon: Network, roles: [], end: false }];
  const canUseDemoControls = isOfficerRole(user?.role) || user?.role === 'ADMIN';
  const isCaseView = /^\/review\/[^/]+/.test(location.pathname);

  useEffect(() => {
    setMobileNavOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setUserMenuOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <GovtTopBar onOpenHelp={() => setHelpOpen(true)} />

      {(isDevSession || IS_MOCK_MODE) && (
        <div data-testid="dev-session-banner" className="border-b border-warn-line bg-warn-bg text-[12px] text-warn">
          <div className="page flex flex-wrap items-center justify-between gap-2 py-1">
            <span>
              {IS_MOCK_MODE && <strong className="font-semibold">Mock mode: </strong>}
              {IS_MOCK_MODE
                ? 'API responses come from local demonstration fixtures (VITE_USE_MOCKS=true).'
                : 'Development session created without the API (local test identity).'}
            </span>
            {isDevSession && (
              <button onClick={logout} className="underline underline-offset-2 hover:text-ink" type="button">
                End test session
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-line bg-white">
        <div className="page flex h-[68px] items-center justify-between gap-3">
          <BrandBlock to={homePathForRole(user?.role)} />
          <div className="flex items-center gap-3">
            <ConnectionIndicator state={connectionState} />
            {canUseDemoControls && (
              <button
                type="button"
                onClick={() => setShowDemoDrawer(true)}
                className="hidden md:inline-flex h-8 items-center gap-1.5 rounded border border-line-strong bg-white px-2.5 text-[13px] text-ink-soft hover:bg-brand-50"
              >
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                Demo controls
              </button>
            )}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-brand-50"
                >
                  <UserCircle2 className="h-7 w-7 text-brand-700" aria-hidden="true" />
                  <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-[220px] truncate text-[13.5px] font-semibold text-ink">{user.name || user.email}</span>
                    <span className="block text-[12px] text-ink-faint">{roleLabel(user.role)}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                </button>
                {userMenuOpen && (
                  <div role="menu" className="absolute right-0 z-40 mt-1 w-64 rounded border border-line bg-white py-1 text-sm shadow-lg">
                    <div className="border-b border-line-soft px-3 py-2">
                      <p className="truncate font-semibold text-ink">{user.name}</p>
                      <p className="truncate text-meta text-ink-faint">{user.email}</p>
                      <p className="mt-1 text-meta text-ink-soft">
                        Role: <span className="font-mono text-[12px]">{user.role}</span>
                      </p>
                      {user.institutionName && <p className="text-meta text-ink-soft">{user.institutionName}</p>}
                    </div>
                    {canUseDemoControls && (
                      <button role="menuitem" type="button" onClick={() => setShowDemoDrawer(true)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-50 md:hidden">
                        <Sliders className="h-4 w-4 text-ink-faint" /> Demo controls
                      </button>
                    )}
                    <button role="menuitem" type="button" onClick={() => setHelpOpen(true)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-brand-50">
                      Help and status guide
                    </button>
                    <button role="menuitem" type="button" onClick={logout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-bad hover:bg-bad-bg">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to="/login"
                className="inline-flex h-8 items-center gap-1.5 rounded border border-brand-700 bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800"
              >
                <LogIn className="h-3.5 w-3.5" /> Sign in
              </NavLink>
            )}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-line-strong lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Primary navigation band */}
        <nav aria-label="Primary" className="hidden bg-brand-900 lg:block">
          <ul className="page flex items-stretch gap-0.5">
            {navItems.map((item) => {
              const active = isItemActive(item, location.pathname);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex h-11 items-center gap-1.5 px-3.5 text-[13.5px] text-white/90 border-b-[3px]',
                      active ? 'border-saffron bg-brand-800 font-semibold text-white' : 'border-transparent hover:bg-brand-800 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 opacity-80" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[#0d1b2e]/50" onClick={() => setMobileNavOpen(false)} />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line bg-brand-900 px-4 py-3 text-white">
              <span className="font-semibold">Menu</span>
              <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation menu" className="rounded p-1 hover:bg-brand-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-line-soft px-4 py-3 text-sm">
              <p className="font-semibold">{user?.name}</p>
              <p className="text-meta text-ink-faint">{roleLabel(user?.role)}</p>
            </div>
            <ul className="flex-1 overflow-y-auto py-1">
              {navItems.map((item) => {
                const active = isItemActive(item, location.pathname);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={clsx(
                        'flex min-h-[44px] items-center gap-2.5 border-l-[3px] px-4 text-[14.5px]',
                        active ? 'border-saffron bg-brand-50 font-semibold text-brand-900' : 'border-transparent text-ink hover:bg-brand-50'
                      )}
                    >
                      <Icon className="h-4 w-4 text-brand-700" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-line p-3">
              <button type="button" onClick={logout} className="flex h-10 w-full items-center justify-center gap-2 rounded border border-line-strong text-sm text-bad">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        <Outlet />
      </main>

      {isCaseView && (
        <div data-testid="case-view-footer" className="border-t border-line bg-white py-2 text-center text-meta text-ink-soft">
          Automated findings are advisory and are for review by authorized officials.
        </div>
      )}

      <AppFooter compact />

      <DemoControlsDrawer isOpen={showDemoDrawer} onClose={() => setShowDemoDrawer(false)} />
      <HelpDialog isOpen={helpOpen} onClose={() => setHelpOpen(false)} role={user?.role} />
    </div>
  );
};

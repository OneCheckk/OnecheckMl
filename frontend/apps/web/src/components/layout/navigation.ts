import {
  LayoutDashboard,
  FilePlus2,
  Inbox,
  Bell,
  BarChart3,
  ShieldCheck,
  Building2,
  Users,
  ListChecks,
  FileCode2,
  Network,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@contracts';
import { ROUTE_ROLES } from '../../auth/routeAccess';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: readonly UserRole[];
  end?: boolean;
  /** Extra path prefixes that should mark this item active */
  matches?: string[];
}

/**
 * Role-aware navigation. Each item's `roles` comes from ROUTE_ROLES, the same
 * list the route guard uses — hiding a link is a convenience, the guard is the
 * enforcement.
 */
export const NAV_ITEMS: NavItem[] = [
  // Institution
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, roles: ROUTE_ROLES.institutionPortal, end: true, matches: ['/portal/applications'] },
  { to: '/portal/new', label: 'New application', icon: FilePlus2, roles: ROUTE_ROLES.institutionPortal },

  // Officers
  { to: '/review', label: 'Review queue', icon: Inbox, roles: ROUTE_ROLES.review, matches: ['/review/'] },

  // Admin overview
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, roles: ROUTE_ROLES.admin, end: true },

  // Shared operational
  { to: '/alerts', label: 'Alerts', icon: Bell, roles: ROUTE_ROLES.alerts },

  // Admin management
  { to: '/admin/institutions', label: 'Institutions', icon: Building2, roles: ROUTE_ROLES.admin },
  { to: '/admin/users', label: 'Users', icon: Users, roles: ROUTE_ROLES.admin },
  { to: '/admin/checklists', label: 'Checklists', icon: ListChecks, roles: ROUTE_ROLES.admin },
  { to: '/admin/rulepacks', label: 'Rulepacks', icon: FileCode2, roles: ROUTE_ROLES.admin },

  // Oversight
  { to: '/syndicate', label: 'Syndicate Network', icon: Network, roles: ROUTE_ROLES.syndicate },
  { to: '/audit', label: 'Audit trail', icon: ShieldCheck, roles: ROUTE_ROLES.audit },
  { to: '/benchmark', label: 'Benchmark', icon: BarChart3, roles: ROUTE_ROLES.benchmark },
];

export const navItemsForRole = (role?: string): NavItem[] =>
  role ? NAV_ITEMS.filter((item) => (item.roles as readonly string[]).includes(role)) : [];

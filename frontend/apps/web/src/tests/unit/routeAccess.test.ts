import { describe, it, expect } from 'vitest';
import { ROUTE_ROLES, homePathForRole } from '../../auth/routeAccess';
import { navItemsForRole, NAV_ITEMS } from '../../components/layout/navigation';
import { isDrawableBBox } from '../../components/evidence/BBoxOverlay';

describe('Route access aligned with backend role equivalence', () => {
  it('admits the seeded OFFICER and INSTITUTION_USER roles to their workspaces', () => {
    expect(ROUTE_ROLES.review).toContain('OFFICER');
    expect(ROUTE_ROLES.institutionPortal).toContain('INSTITUTION_USER');
    expect(homePathForRole('OFFICER')).toBe('/review');
    expect(homePathForRole('INSTITUTION_USER')).toBe('/portal');
  });

  it('keeps admin-only routes admin-only', () => {
    expect(ROUTE_ROLES.admin).toEqual(['ADMIN']);
    expect(ROUTE_ROLES.audit).not.toContain('SCRUTINY_OFFICER');
  });

  it('sends each role to a home route that it can open', () => {
    expect(homePathForRole('ADMIN')).toBe('/admin');
    expect(homePathForRole('AUDITOR')).toBe('/audit');
    expect(homePathForRole('REGIONAL_DIRECTOR')).toBe('/review');
  });
});

describe('Role-aware navigation', () => {
  it('never shows administration links to institution or officer roles', () => {
    for (const role of ['INSTITUTION', 'INSTITUTION_USER', 'SCRUTINY_OFFICER', 'OFFICER', 'REGIONAL_DIRECTOR', 'AUDITOR']) {
      expect(navItemsForRole(role).some((i) => i.to.startsWith('/admin'))).toBe(false);
    }
  });

  it('shows institutions only their portal links', () => {
    expect(navItemsForRole('INSTITUTION').map((i) => i.to)).toEqual(['/portal', '/portal/new']);
  });

  it('derives every link from the same role list the route guard uses', () => {
    for (const item of NAV_ITEMS) {
      const guard = Object.values(ROUTE_ROLES).find((roles) => roles === item.roles);
      expect(guard, `nav item ${item.to} must reuse a ROUTE_ROLES entry`).toBeDefined();
    }
  });

  it('shows nothing when signed out', () => {
    expect(navItemsForRole(undefined)).toEqual([]);
  });
});

describe('Bounding boxes that may be drawn', () => {
  it('rejects the backend whole-page default and degenerate boxes', () => {
    expect(isDrawableBBox([0, 0, 1, 1])).toBe(false);
    expect(isDrawableBBox([0.2, 0.2, 0.2, 0.4])).toBe(false);
    expect(isDrawableBBox(undefined)).toBe(false);
  });
  it('accepts a located region', () => {
    expect(isDrawableBBox([0.18, 0.42, 0.52, 0.46])).toBe(true);
  });
});

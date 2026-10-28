import type { UserRole } from '@contracts';

/**
 * Single source of truth for which roles may open which route.
 * Used by both <RequireRole> in routes.tsx and the role-aware navigation,
 * so a link is only shown when the route guard would also admit the user.
 *
 * The backend treats OFFICER ≡ SCRUTINY_OFFICER and INSTITUTION_USER ≡ INSTITUTION
 * (middleware/authorize.js ROLE_EQUIVALENTS) and its seed script creates users
 * with the OFFICER and INSTITUTION_USER roles, so those aliases are included.
 */
export const INSTITUTION_ROLES: UserRole[] = ['INSTITUTION', 'INSTITUTION_USER'];
export const OFFICER_ROLES: UserRole[] = ['SCRUTINY_OFFICER', 'OFFICER', 'REGIONAL_DIRECTOR'];

export const ROUTE_ROLES = {
  institutionPortal: INSTITUTION_ROLES,
  review: OFFICER_ROLES,
  alerts: [...OFFICER_ROLES, 'ADMIN'] as UserRole[],
  admin: ['ADMIN'] as UserRole[],
  audit: ['AUDITOR', 'ADMIN'] as UserRole[],
  benchmark: ['ADMIN', ...OFFICER_ROLES] as UserRole[],
  syndicate: [...OFFICER_ROLES, 'ADMIN', 'AUDITOR', ...INSTITUTION_ROLES] as UserRole[],
} as const;

/** Landing route after sign-in, and the "return" target on a 403 screen. */
export function homePathForRole(role?: string): string {
  switch (role) {
    case 'INSTITUTION':
    case 'INSTITUTION_USER':
      return '/portal';
    case 'SCRUTINY_OFFICER':
    case 'OFFICER':
    case 'REGIONAL_DIRECTOR':
      return '/review';
    case 'ADMIN':
      return '/admin';
    case 'AUDITOR':
      return '/audit';
    default:
      return '/';
  }
}

export const isInstitutionRole = (role?: string) => !!role && (INSTITUTION_ROLES as string[]).includes(role);
export const isOfficerRole = (role?: string) => !!role && (OFFICER_ROLES as string[]).includes(role);

import type { AppPermission } from '@contracts';
import type { User } from './AuthProvider';

export type { AppPermission };

export type ExtendedRole =
  | 'INSTITUTION'
  | 'INSTITUTION_USER'
  | 'OFFICER'
  | 'SCRUTINY_OFFICER'
  | 'REGIONAL_DIRECTOR'
  | 'ADMIN'
  | 'AUDITOR';

/**
 * Role-Permission Matrix:
 * - INSTITUTION / INSTITUTION_USER: College applicant (submits applications, uploads documents, tracks verification).
 * - OFFICER / SCRUTINY_OFFICER: Scrutiny reviewer (runs automated checks, reviews forensics, decides manual reviews, investigates alerts).
 * - REGIONAL_DIRECTOR: Regional regulatory authority (supervisory review, appeals, audit).
 * - ADMIN: System administrator (monitors platform health, manages users/institutions, views platform audit logs).
 */
const ROLE_PERMISSIONS: Record<string, AppPermission[]> = {
  INSTITUTION_USER: [
    'CREATE_APPLICATION',
    'SUBMIT_APPLICATION',
    'UPLOAD_DOCUMENT',
    'INSPECT_DOCUMENT',
  ],
  INSTITUTION: [
    'CREATE_APPLICATION',
    'SUBMIT_APPLICATION',
    'UPLOAD_DOCUMENT',
    'INSPECT_DOCUMENT',
  ],
  OFFICER: [
    'INSPECT_DOCUMENT',
    'RUN_SCRUTINY_CHECKS',
    'DECIDE_MANUAL_REVIEW',
    'VIEW_ALL_APPLICATIONS',
    'VIEW_ALERTS_QUEUE',
    'UPDATE_ALERT',
    'VIEW_FORENSICS',
    'VIEW_FULL_AUDIT',
  ],
  SCRUTINY_OFFICER: [
    'INSPECT_DOCUMENT',
    'RUN_SCRUTINY_CHECKS',
    'DECIDE_MANUAL_REVIEW',
    'VIEW_ALL_APPLICATIONS',
    'VIEW_ALERTS_QUEUE',
    'UPDATE_ALERT',
    'VIEW_FORENSICS',
    'VIEW_FULL_AUDIT',
  ],
  REGIONAL_DIRECTOR: [
    'INSPECT_DOCUMENT',
    'RUN_SCRUTINY_CHECKS',
    'DECIDE_MANUAL_REVIEW',
    'VIEW_ALL_APPLICATIONS',
    'VIEW_ALERTS_QUEUE',
    'UPDATE_ALERT',
    'VIEW_FORENSICS',
    'VIEW_FULL_AUDIT',
  ],
  ADMIN: [
    'INSPECT_DOCUMENT',
    'VIEW_ALL_APPLICATIONS',
    'VIEW_ALERTS_QUEUE',
    'VIEW_FORENSICS',
    'VIEW_SYSTEM_HEALTH',
    'VIEW_FULL_AUDIT',
    'MANAGE_USERS',
  ],
};

function isOfficerRole(role?: string): boolean {
  return role === 'OFFICER' || role === 'SCRUTINY_OFFICER' || role === 'REGIONAL_DIRECTOR';
}

function isInstitutionRole(role?: string): boolean {
  return role === 'INSTITUTION' || role === 'INSTITUTION_USER';
}

/** Check if a role possesses a specific capability */
export function hasPermission(role: string | undefined, permission: AppPermission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Verify if a user is authorized to view or access a specific application */
export function canAccessApplication(
  user: { id?: string; role?: string; institutionId?: string } | null,
  app: { id?: string; institutionId?: string } | null
): boolean {
  if (!user || !app) return false;
  if (isOfficerRole(user.role) || user.role === 'ADMIN') return true;
  if (isInstitutionRole(user.role)) {
    return Boolean(user.institutionId && user.institutionId === app.institutionId);
  }
  return false;
}

/** Verify if a user is authorized to retrieve or inspect a document */
export function canAccessDocument(
  user: { id?: string; role?: string; institutionId?: string } | null,
  doc: { id?: string; applicationId?: string } | null,
  app?: { id?: string; institutionId?: string } | null
): boolean {
  if (!user || !doc) return false;
  if (isOfficerRole(user.role) || user.role === 'ADMIN') return true;
  if (isInstitutionRole(user.role)) {
    if (!user.institutionId) return false;
    if (app) {
      return app.institutionId === user.institutionId && doc.applicationId === app.id;
    }
    return true;
  }
  return false;
}

/** Check if a user is authorized to view a regulatory alert */
export function canAccessAlert(
  user: { id?: string; role?: string; institutionId?: string } | null,
  alert: { id?: string; applicationId?: string } | null,
  appInstitutionId?: string | null
): boolean {
  if (!user || !alert) return false;
  if (isOfficerRole(user.role) || user.role === 'ADMIN') return true;
  if (isInstitutionRole(user.role)) {
    return Boolean(user.institutionId && appInstitutionId && user.institutionId === appInstitutionId);
  }
  return false;
}

/** Check if a user is authorized to run scrutiny checks */
export function canRunScrutiny(user: { id?: string; role?: string } | null): boolean {
  return user ? isOfficerRole(user.role) : false;
}

/** Check if a user is authorized to record manual review determinations */
export function canDecideReview(user: { id?: string; role?: string } | null): boolean {
  return user ? isOfficerRole(user.role) : false;
}

/** Check if a user is authorized to submit an application draft */
export function canSubmitApplication(
  user: { id?: string; role?: string; institutionId?: string } | null,
  app: { id?: string; institutionId?: string; status?: string } | null
): boolean {
  if (!user || !app) return false;
  return (
    isInstitutionRole(user.role) &&
    app.institutionId === user.institutionId &&
    app.status === 'DRAFT'
  );
}

/** Check if a user is authorized to upload documents */
export function canUploadDocument(
  user: { id?: string; role?: string; institutionId?: string } | null,
  app: { id?: string; institutionId?: string; status?: string } | null
): boolean {
  if (!user || !app) return false;
  return (
    isInstitutionRole(user.role) &&
    app.institutionId === user.institutionId &&
    (app.status === 'DRAFT' ||
      app.status === 'DEFICIENCY_RAISED' ||
      app.status === 'DEFICIENCY_LETTER_ISSUED')
  );
}

/** Check if a user is authorized to access audit logs */
export function canAccessAudit(
  user: { id?: string; role?: string; institutionId?: string } | null,
  appId?: string | null,
  app?: { id?: string; institutionId?: string } | null
): boolean {
  if (!user) return false;
  if (isOfficerRole(user.role) || user.role === 'ADMIN') return true;
  if (isInstitutionRole(user.role)) {
    if (!appId) return false;
    if (app) return app.institutionId === user.institutionId;
    return true;
  }
  return false;
}

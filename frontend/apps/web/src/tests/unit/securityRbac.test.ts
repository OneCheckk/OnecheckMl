import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canAccessApplication,
  canAccessDocument,
  canAccessAlert,
  canRunScrutiny,
  canDecideReview,
  canSubmitApplication,
  canUploadDocument,
  canAccessAudit,
} from '../../auth/permissions';

// Test identities
const adminUser = { id: 'u-admin', name: 'Platform Admin', role: 'ADMIN' };
const officerUser = { id: 'u-officer', name: 'Scrutiny Officer', role: 'SCRUTINY_OFFICER' };
const archiveOfficer = { id: 'u-officer-alt', name: 'Officer Alt', role: 'OFFICER' };
const apexUser = {
  id: 'u-inst-apex',
  name: 'Apex Representative',
  role: 'INSTITUTION_USER',
  institutionId: 'inst-apex',
};
const centuryUser = {
  id: 'u-inst-century',
  name: 'Century Representative',
  role: 'INSTITUTION_USER',
  institutionId: 'inst-century',
};

// Test applications
const apexAppUnderScrutiny = {
  id: 'app-101',
  institutionId: 'inst-apex',
  status: 'UNDER_SCRUTINY',
};
const apexAppDraft = {
  id: 'app-105',
  institutionId: 'inst-apex',
  status: 'DRAFT',
};
const centuryAppDraft = {
  id: 'app-107',
  institutionId: 'inst-century',
  status: 'DRAFT',
};

// Test documents
const apexDoc = { id: 'd1', applicationId: 'app-101' };
const centuryDoc = { id: 'd101', applicationId: 'app-107' };

// Test alerts
const apexAlert = { id: 'al1', applicationId: 'app-101' };
const centuryAlert = { id: 'al7', applicationId: 'app-107' };

describe('Centralized RBAC Matrix & Role Capabilities', () => {
  it('correctly grants and blocks permissions for INSTITUTION_USER', () => {
    expect(hasPermission('INSTITUTION_USER', 'CREATE_APPLICATION')).toBe(true);
    expect(hasPermission('INSTITUTION_USER', 'UPLOAD_DOCUMENT')).toBe(true);
    expect(hasPermission('INSTITUTION_USER', 'RUN_SCRUTINY_CHECKS')).toBe(false);
    expect(hasPermission('INSTITUTION_USER', 'DECIDE_MANUAL_REVIEW')).toBe(false);
    expect(hasPermission('INSTITUTION_USER', 'MANAGE_USERS')).toBe(false);
  });

  it('correctly grants and blocks permissions for SCRUTINY_OFFICER / OFFICER', () => {
    for (const role of ['SCRUTINY_OFFICER', 'OFFICER']) {
      expect(hasPermission(role, 'RUN_SCRUTINY_CHECKS')).toBe(true);
      expect(hasPermission(role, 'DECIDE_MANUAL_REVIEW')).toBe(true);
      expect(hasPermission(role, 'VIEW_FORENSICS')).toBe(true);
      expect(hasPermission(role, 'VIEW_ALL_APPLICATIONS')).toBe(true);
      expect(hasPermission(role, 'CREATE_APPLICATION')).toBe(false);
      expect(hasPermission(role, 'MANAGE_USERS')).toBe(false);
    }
  });

  it('correctly grants and blocks permissions for ADMIN', () => {
    expect(hasPermission('ADMIN', 'MANAGE_USERS')).toBe(true);
    expect(hasPermission('ADMIN', 'VIEW_SYSTEM_HEALTH')).toBe(true);
    expect(hasPermission('ADMIN', 'VIEW_FULL_AUDIT')).toBe(true);
    expect(hasPermission('ADMIN', 'VIEW_FORENSICS')).toBe(true);
    expect(hasPermission('ADMIN', 'DECIDE_MANUAL_REVIEW')).toBe(false);
    expect(hasPermission('ADMIN', 'RUN_SCRUTINY_CHECKS')).toBe(false);
  });
});

describe('Execution Guard Boundaries', () => {
  it('enforces canRunScrutiny boundaries', () => {
    expect(canRunScrutiny(officerUser)).toBe(true);
    expect(canRunScrutiny(archiveOfficer)).toBe(true);
    expect(canRunScrutiny(apexUser)).toBe(false);
    expect(canRunScrutiny(adminUser)).toBe(false);
    expect(canRunScrutiny(null)).toBe(false);
  });

  it('enforces canDecideReview boundaries', () => {
    expect(canDecideReview(officerUser)).toBe(true);
    expect(canDecideReview(archiveOfficer)).toBe(true);
    expect(canDecideReview(apexUser)).toBe(false);
    expect(canDecideReview(adminUser)).toBe(false);
    expect(canDecideReview(null)).toBe(false);
  });

  it('enforces canSubmitApplication draft and ownership boundaries', () => {
    // Under scrutiny cannot be re-submitted
    expect(canSubmitApplication(apexUser, apexAppUnderScrutiny)).toBe(false);
    // Own draft can be submitted
    expect(canSubmitApplication(apexUser, apexAppDraft)).toBe(true);
    expect(canSubmitApplication(centuryUser, centuryAppDraft)).toBe(true);
    // Cross-institution submission blocked
    expect(canSubmitApplication(apexUser, centuryAppDraft)).toBe(false);
    // Officers cannot submit institution applications
    expect(canSubmitApplication(officerUser, centuryAppDraft)).toBe(false);
    // Unauthenticated blocked
    expect(canSubmitApplication(null, centuryAppDraft)).toBe(false);
  });

  it('enforces canUploadDocument boundaries', () => {
    expect(canUploadDocument(apexUser, apexAppDraft)).toBe(true);
    expect(canUploadDocument(apexUser, centuryAppDraft)).toBe(false);
    expect(canUploadDocument(officerUser, apexAppDraft)).toBe(false);
    expect(canUploadDocument(null, apexAppDraft)).toBe(false);
  });

  it('enforces canAccessAudit isolation boundaries', () => {
    // Global platform audit is blocked for institution users
    expect(canAccessAudit(apexUser, undefined)).toBe(false);
    // Application-level audit allowed for own institution
    expect(canAccessAudit(apexUser, 'app-101', apexAppUnderScrutiny)).toBe(true);
    // Application-level audit blocked for different institution
    expect(canAccessAudit(apexUser, 'app-107', centuryAppDraft)).toBe(false);
    // Officers and Admins can view audit logs
    expect(canAccessAudit(adminUser, undefined)).toBe(true);
    expect(canAccessAudit(officerUser, undefined)).toBe(true);
  });
});

describe('Cross-Institution Tenant Data Isolation', () => {
  it('prevents cross-institution access to applications', () => {
    // Apex accessing Apex
    expect(canAccessApplication(apexUser, apexAppUnderScrutiny)).toBe(true);
    // Apex accessing Century
    expect(canAccessApplication(apexUser, centuryAppDraft)).toBe(false);
    // Century accessing Apex
    expect(canAccessApplication(centuryUser, apexAppUnderScrutiny)).toBe(false);
    // Officers and Admins can access all applications
    expect(canAccessApplication(officerUser, apexAppUnderScrutiny)).toBe(true);
    expect(canAccessApplication(officerUser, centuryAppDraft)).toBe(true);
    expect(canAccessApplication(adminUser, apexAppUnderScrutiny)).toBe(true);
  });

  it('prevents cross-institution access to documents', () => {
    expect(canAccessDocument(apexUser, apexDoc, apexAppUnderScrutiny)).toBe(true);
    expect(canAccessDocument(apexUser, centuryDoc, centuryAppDraft)).toBe(false);
    expect(canAccessDocument(officerUser, apexDoc, apexAppUnderScrutiny)).toBe(true);
    expect(canAccessDocument(officerUser, centuryDoc, centuryAppDraft)).toBe(true);
  });

  it('prevents cross-institution access to regulatory alerts', () => {
    expect(canAccessAlert(apexUser, apexAlert, 'inst-apex')).toBe(true);
    expect(canAccessAlert(apexUser, centuryAlert, 'inst-century')).toBe(false);
    expect(canAccessAlert(officerUser, apexAlert, 'inst-apex')).toBe(true);
    expect(canAccessAlert(adminUser, centuryAlert, 'inst-century')).toBe(true);
  });
});

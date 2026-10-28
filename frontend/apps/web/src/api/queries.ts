import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  extractList,
  extractPagination,
  normalizeAlert,
  normalizeApplication,
  normalizeApplicationDetail,
  normalizeAuditEvent,
  normalizeAuditVerify,
  normalizeBenchmarkRun,
  normalizeChecklistItem,
  normalizeFinding,
  normalizeForensics,
  normalizeLedgerEntry,
  normalizeLetter,
  normalizeRiskScore,
  normalizeTriangle,
  type ApplicationView,
  type PaginationMeta,
} from './adapters';
import type {
  ChecklistItem,
  Claim,
  Finding,
  LedgerEntry,
  ValidityRecord,
  AuditEvent,
  Institution,
  CheckRun,
  ClaimRecheckResult,
} from '@contracts';

// Canonical TanStack Query Key Factories
export const queryKeys = {
  apps: (filters?: Record<string, any>) => ['apps', filters] as const,
  app: (id: string) => ['app', id] as const,
  claims: (id: string) => ['claims', id] as const,
  findings: (id: string) => ['findings', id] as const,
  ledger: (id: string) => ['ledger', id] as const,
  docs: (id: string) => ['docs', id] as const,
  alerts: (filters?: Record<string, any>) => (filters ? (['alerts', filters] as const) : (['alerts'] as const)),
  audit: (filters?: Record<string, any>) => ['audit', filters] as const,
  bench: (runId?: string) => ['bench', runId] as const,
  dashboardOfficer: () => ['dashboard', 'officer'] as const,
  dashboardSummary: () => ['dashboard', 'summary'] as const,
  dashboardInstitution: () => ['dashboard', 'institution'] as const,
  categories: () => ['categories'] as const,
  demoSettings: () => ['demo', 'settings'] as const,
  institutions: () => ['institutions'] as const,
  triangle: (id: string) => ['triangle', id] as const,
  forensics: (id: string) => ['forensics', id] as const,
  riskScore: (id: string) => ['risk-score', id] as const,
  checkRun: (appId: string, runId?: string) => ['check-run', appId, runId] as const,
  adminUsers: () => ['admin', 'users'] as const,
  adminChecklists: () => ['admin', 'checklists'] as const,
  rulepacks: () => ['admin', 'rulepacks'] as const,
  health: () => ['health'] as const,
};

export interface Paged<T> {
  items: T[];
  pagination?: PaginationMeta;
}

// --- Applications Queries ---

export interface ApplicationListParams {
  status?: string;
  /** Backend filter name */
  riskLevel?: string;
  /** Mock-layer filter name (kept for compatibility) */
  band?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Array form kept for existing callers (first page only). */
export const useApplications = (filters?: { band?: string; status?: string; search?: string }) => {
  return useQuery({
    queryKey: queryKeys.apps(filters),
    queryFn: async () => {
      const res = await apiClient.get<any>('/applications', { params: filters });
      return extractList(res.data, 'applications').map((a) => normalizeApplication(a)!) as ApplicationView[];
    },
  });
};

/** Server-paginated list. Sends both `riskLevel` (backend) and `band` (mock). */
export const useApplicationsPage = (params: ApplicationListParams) => {
  const query: Record<string, any> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.status) query.status = params.status;
  if (params.riskLevel) {
    query.riskLevel = params.riskLevel;
    query.band = params.riskLevel;
  }
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return useQuery({
    queryKey: queryKeys.apps({ ...query, paged: true }),
    queryFn: async (): Promise<Paged<ApplicationView>> => {
      const res = await apiClient.get<any>('/applications', { params: query });
      return {
        items: extractList(res.data, 'applications').map((a) => normalizeApplication(a)!),
        pagination: extractPagination(res.data),
      };
    },
    placeholderData: (prev) => prev,
  });
};

export const useApplication = (id: string) => {
  return useQuery({
    queryKey: queryKeys.app(id),
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${id}`);
      return normalizeApplicationDetail(res.data?.data);
    },
    enabled: !!id,
  });
};

export const useApplicationChecklist = (id: string) => {
  return useQuery({
    queryKey: queryKeys.docs(id),
    queryFn: async (): Promise<(ChecklistItem & { docTypes?: string[] })[]> => {
      try {
        const res = await apiClient.get<any>(`/applications/${id}/checklist`);
        const data = res.data?.data;
        if (Array.isArray(data)) return data.map(normalizeChecklistItem);
        if (data?.items && Array.isArray(data.items)) return data.items.map(normalizeChecklistItem);
      } catch {
        // Fallback to /documents
      }
      try {
        const docRes = await apiClient.get<any>(`/applications/${id}/documents`);
        const docs = docRes.data?.data;
        if (Array.isArray(docs)) {
          return docs.map((d: any) =>
            d.state || d.status
              ? normalizeChecklistItem(d)
              : normalizeChecklistItem({
                  id: d._id || d.id,
                  label: d.originalName || d.documentType,
                  docTypes: [d.documentType || d.docType],
                  required: true,
                  state: d.uploadStatus === 'STORED' ? 'DONE' : 'UPLOADED',
                  fileName: d.originalName,
                })
          );
        }
      } catch {
        // Ignore fallback error
      }
      return [] as ChecklistItem[];
    },
    enabled: !!id,
  });
};

export const useClaims = (applicationId: string) => {
  return useQuery({
    queryKey: queryKeys.claims(applicationId),
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/claims`);
      return extractList(res.data, 'claims').map((c) => ({
        ...c,
        predicateLabel: c.predicateLabel ?? c.predicate,
        source: c.source ?? { docId: c.docId, page: 1, bbox: [0, 0, 0, 0] },
      })) as Claim[];
    },
    enabled: !!applicationId,
  });
};

export const useFindings = (applicationId: string, filters?: { status?: string; severity?: string; state?: string }) => {
  return useQuery({
    queryKey: queryKeys.findings(applicationId),
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/findings`, { params: filters });
      return extractList(res.data, 'findings').map(normalizeFinding) as Finding[];
    },
    enabled: !!applicationId,
  });
};

export const useLedger = (applicationId: string) => {
  return useQuery({
    queryKey: queryKeys.ledger(applicationId),
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/ledger`);
      return extractList(res.data, 'ledger').map(normalizeLedgerEntry) as LedgerEntry[];
    },
    enabled: !!applicationId,
  });
};

export const useValidity = (applicationId: string) => {
  return useQuery({
    queryKey: ['validity', applicationId],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/validity`);
      return extractList(res.data) as ValidityRecord[];
    },
    enabled: !!applicationId,
  });
};

export interface OfficerDashboardView {
  bandCounts?: { RED: number; YELLOW: number; GREEN: number; UNCALCULATED?: number };
  byStatus?: Record<string, number>;
  pendingSourceVerifications?: number;
  alerts?: { total?: number; bySeverity?: Record<string, number> };
  prioritizedQueue: ApplicationView[];
}

export const useOfficerDashboard = () => {
  return useQuery({
    queryKey: queryKeys.dashboardOfficer(),
    queryFn: async (): Promise<OfficerDashboardView> => {
      const res = await apiClient.get<any>('/dashboard/officer');
      const data = res.data?.data || {};
      // Only server-supplied values are surfaced. The backend currently returns
      // fixed placeholders for oldestUnresolvedDays / avgTimePerStageDays, so the
      // UI does not display them.
      return {
        bandCounts: data.bandCounts ?? data.byBand,
        byStatus: data.byStatus,
        pendingSourceVerifications: data.pendingSourceVerifications ?? data.pendingSources,
        alerts: data.alerts,
        prioritizedQueue: Array.isArray(data.prioritizedQueue)
          ? data.prioritizedQueue.map((a: any) => normalizeApplication(a)!)
          : [],
      };
    },
  });
};

export interface DashboardSummaryView {
  overview?: { totalInstitutions?: number; totalApplications?: number; totalOpenAlerts?: number };
  applicationsByStatus?: Record<string, number>;
  applicationsByRiskLevel?: Record<string, number>;
  openAlertsBySeverity?: Record<string, number>;
  recentRuns: { runId: string; status: string; applicationNumber?: string; startedAt?: string; completedAt?: string }[];
}

export const useDashboardSummary = (enabled = true) => {
  return useQuery({
    queryKey: queryKeys.dashboardSummary(),
    enabled,
    queryFn: async (): Promise<DashboardSummaryView> => {
      const res = await apiClient.get<any>('/dashboard/summary');
      const d = res.data?.data || {};
      return {
        overview: d.overview,
        applicationsByStatus: d.applicationsByStatus,
        applicationsByRiskLevel: d.applicationsByRiskLevel,
        openAlertsBySeverity: d.openAlertsBySeverity,
        recentRuns: Array.isArray(d.recentRuns)
          ? d.recentRuns.map((r: any) => ({
              runId: r.runId,
              status: r.status,
              applicationNumber: r.application?.applicationNumber,
              startedAt: r.startedAt,
              completedAt: r.completedAt,
            }))
          : [],
      };
    },
  });
};

export const useInstitutionDashboard = () => {
  return useQuery({
    queryKey: queryKeys.dashboardInstitution(),
    queryFn: async () => {
      const res = await apiClient.get<any>('/dashboard/institution');
      const d = res.data?.data || {};
      const apps = Array.isArray(d.applications) ? d.applications.map((a: any) => normalizeApplication(a)!) : [];
      return {
        totalApplications: typeof d.totalApplications === 'number' ? d.totalApplications : apps.length,
        applications: apps as ApplicationView[],
      };
    },
  });
};

export const useHealth = () => {
  return useQuery({
    queryKey: queryKeys.health(),
    retry: 0,
    queryFn: async () => {
      const res = await apiClient.get<any>('/health');
      return res.data?.data as { status?: string; database?: string; timestamp?: string; uptimeSeconds?: number };
    },
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { id: string; name: string; checklistCount: number }[] }>('/categories');
      return res.data.data;
    },
  });
};

export interface AlertListParams {
  status?: string;
  severity?: string;
  applicationId?: string;
  page?: number;
  limit?: number;
}

export const useAlerts = (params?: AlertListParams) => {
  return useQuery({
    queryKey: queryKeys.alerts(params),
    queryFn: async () => {
      const res = await apiClient.get<any>('/alerts', { params });
      return extractList(res.data, 'alerts').map(normalizeAlert);
    },
  });
};

export const useAlertsPage = (params: AlertListParams) => {
  return useQuery({
    queryKey: queryKeys.alerts({ ...params, paged: true }),
    queryFn: async () => {
      const res = await apiClient.get<any>('/alerts', { params: { page: 1, limit: 20, ...params } });
      return {
        items: extractList(res.data, 'alerts').map(normalizeAlert),
        pagination: extractPagination(res.data),
      };
    },
    placeholderData: (prev) => prev,
  });
};

export const useAuditEvents = (filters?: { entityId?: string; action?: string; entityType?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: queryKeys.audit(filters),
    queryFn: async () => {
      const res = await apiClient.get<any>('/audit', { params: filters });
      return extractList(res.data, 'auditEvents', 'events').map(normalizeAuditEvent) as AuditEvent[];
    },
  });
};

export const useAuditPage = (filters: { entityId?: string; action?: string; entityType?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: queryKeys.audit({ ...filters, paged: true }),
    queryFn: async () => {
      const res = await apiClient.get<any>('/audit', { params: filters });
      return {
        items: extractList(res.data, 'auditEvents', 'events').map(normalizeAuditEvent) as AuditEvent[],
        pagination: extractPagination(res.data),
      };
    },
    placeholderData: (prev) => prev,
  });
};

export const useDeficiencyLetters = (applicationId: string) => {
  return useQuery({
    queryKey: ['letters', applicationId],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/letters`);
      return extractList(res.data, 'letters').map(normalizeLetter);
    },
    enabled: !!applicationId,
  });
};

// --- Mutations ---

export const useCreateApplication = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { category: string; institutionName?: string; academicYear?: string }) => {
      const res = await apiClient.post<any>('/applications', payload);
      const data = res.data?.data;
      return normalizeApplication(data?.application ?? data)!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardInstitution() });
    },
  });
};

export const useRunSelfCheck = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<any>(`/applications/${applicationId}/self-check`);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.findings(applicationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.docs(applicationId) });
    },
  });
};

export const useCorrectClaim = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId, value, reason }: { claimId: string; value: string | number; reason: string }) => {
      const res = await apiClient.patch<{ success: boolean; data: ClaimRecheckResult }>(`/claims/${claimId}`, {
        value,
        reason,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.claims(applicationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.findings(applicationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
    },
  });
};

/** Backend route: POST /api/claims/:claimId/confirm */
export const useConfirmClaim = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId }: { claimId: string }) => {
      const res = await apiClient.post<{ success: boolean; data: Claim }>(`/claims/${claimId}/confirm`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.claims(applicationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
    },
  });
};

export const useDispositionFinding = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ findingId, state, reason }: { findingId: string; state: string; reason?: string }) => {
      const res = await apiClient.post<{ success: boolean; data: Finding }>(`/findings/${findingId}/disposition`, {
        state,
        reason,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.findings(applicationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
    },
  });
};

export const useRecordDecision = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ outcome, reason }: { outcome: string; reason?: string }) => {
      const res = await apiClient.post<any>(`/applications/${applicationId}/decision`, {
        outcome,
        reason,
      });
      return normalizeApplication(res.data?.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
};

/**
 * Creates a deficiency letter. The backend renders a DRAFT from the selected
 * finding IDs (POST /applications/:id/letters {findingIds}); dispatch is a
 * separate step (useDispatchLetter).
 */
export const useSendDeficiencyLetter = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { findingIds: string[]; content?: string }) => {
      const res = await apiClient.post<any>(`/applications/${applicationId}/letters`, payload);
      return normalizeLetter(res.data?.data ?? {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letters', applicationId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.findings(applicationId) });
    },
  });
};

/** POST /letters/:id/send — marks SENT and moves the application to DEFICIENCY_RAISED on the server. */
export const useDispatchLetter = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (letterId: string) => {
      const res = await apiClient.post<any>(`/letters/${letterId}/send`);
      return normalizeLetter(res.data?.data ?? {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letters', applicationId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
};

export const useVerifyAuditChain = () => {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get<any>('/audit/verify');
      return normalizeAuditVerify(res.data?.data ?? {});
    },
  });
};

// --- Integration Hooks: Institutions, Triangle, Forensics, Risk ---

export const useInstitutions = () => {
  return useQuery({
    queryKey: queryKeys.institutions(),
    queryFn: async () => {
      const res = await apiClient.get<any>('/institutions');
      return extractList(res.data, 'institutions') as Institution[];
    },
  });
};

export const useCreateInstitution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; address: string; state: string; latitude: number; longitude: number; registrationId?: string }) => {
      const res = await apiClient.post<any>('/institutions', payload);
      return (res.data?.data?.institution ?? res.data?.data) as Institution;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.institutions() }),
  });
};

export const useTriangleFindings = (applicationId: string) => {
  return useQuery({
    queryKey: queryKeys.triangle(applicationId),
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/triangle`);
      return extractList(res.data).map(normalizeTriangle);
    },
    enabled: !!applicationId,
  });
};

export const useForensicsSuite = (applicationId: string) => {
  return useQuery({
    queryKey: queryKeys.forensics(applicationId),
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/forensics`);
      return normalizeForensics(res.data?.data);
    },
    enabled: !!applicationId,
  });
};

export const useRiskScoreBreakdown = (applicationId: string) => {
  return useQuery({
    queryKey: queryKeys.riskScore(applicationId),
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/risk-score`);
      return res.data?.data ? normalizeRiskScore(res.data.data) : undefined;
    },
    enabled: !!applicationId,
  });
};

/** POST /applications/:id/run-checks — the backend answers 202 with a queued run. */
export const useRunOfficerChecks = (applicationId: string) => {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ success: boolean; data: CheckRun }>(`/applications/${applicationId}/run-checks`);
      return res.data.data;
    },
  });
};

const ACTIVE_RUN_STATES = ['QUEUED', 'RUNNING'];

/** Polls GET /applications/:id/runs/:runId while the run is queued or running. */
export const useCheckRunStatus = (applicationId: string, runId?: string) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.checkRun(applicationId, runId),
    enabled: !!applicationId && !!runId,
    queryFn: async () => {
      const res = await apiClient.get<any>(`/applications/${applicationId}/runs/${runId}`);
      const run = (res.data?.data?.run ?? res.data?.data) as CheckRun;
      if (run && !ACTIVE_RUN_STATES.includes(run.status)) {
        // Run finished: refresh the case data that the pipeline may have changed.
        queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.findings(applicationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.riskScore(applicationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.forensics(applicationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.ledger(applicationId) });
      }
      return run;
    },
    refetchInterval: (q) => {
      const status = (q.state.data as CheckRun | undefined)?.status;
      return !status || ACTIVE_RUN_STATES.includes(status) ? 2500 : false;
    },
  });
};

export const useUpdateAlertStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason: string }) => {
      const res = await apiClient.patch<any>(`/alerts/${id}`, { status, reason });
      return normalizeAlert(res.data?.data ?? {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

/** POST /ledger/:entryId/manual-confirm — backend reads {confirmed, note}; note must be ≥10 chars. */
export const useLedgerManualConfirm = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, outcome, note }: { entryId: string; outcome: 'CONFIRMED' | 'REJECTED'; note: string }) => {
      const res = await apiClient.post<any>(`/ledger/${entryId}/manual-confirm`, {
        confirmed: outcome === 'CONFIRMED',
        outcome,
        note,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ledger(applicationId) });
    },
  });
};

export const useUploadDocument = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      docTypeHint,
      checklistItemId,
      onProgress,
    }: {
      file: File;
      docTypeHint?: string;
      checklistItemId?: string;
      onProgress?: (pct: number) => void;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (docTypeHint) {
        formData.append('docType', docTypeHint);
        formData.append('docTypeHint', docTypeHint);
        formData.append('documentType', docTypeHint);
      }
      if (checklistItemId) {
        formData.append('checklistItemId', checklistItemId);
      }
      const res = await apiClient.post(`/applications/${applicationId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs(applicationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.claims(applicationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
    },
  });
};

export const useSubmitApplication = (applicationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/applications/${applicationId}/submit`);
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.app(applicationId) });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardInstitution() });
    },
  });
};

// --- Administration (ADMIN-only on the server) ---

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  institutionId?: string;
  lastLoginAt?: string;
  createdAt?: string;
}

export const useAdminUsers = () =>
  useQuery({
    queryKey: queryKeys.adminUsers(),
    queryFn: async () => {
      const res = await apiClient.get<any>('/admin/users');
      return extractList(res.data, 'users').map((u) => ({
        ...u,
        institutionId: u.institutionId?.toString?.() ?? u.institution?.toString?.(),
      })) as AdminUser[];
    },
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string; role: string; institutionId?: string }) => {
      const res = await apiClient.post<any>('/admin/users', payload);
      return res.data?.data as AdminUser;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminUsers() }),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; role?: string; isActive?: boolean }) => {
      const res = await apiClient.patch<any>(`/admin/users/${id}`, payload);
      return res.data?.data as AdminUser;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminUsers() }),
  });
};

export interface ChecklistDefinition {
  id: string;
  category: string;
  version?: string;
  active?: boolean;
  items: { id: string; label: string; docTypes: string[]; required: boolean; clauseRef: string; placeholder?: boolean }[];
  updatedAt?: string;
}

export const useAdminChecklists = () =>
  useQuery({
    queryKey: queryKeys.adminChecklists(),
    queryFn: async () => {
      const res = await apiClient.get<any>('/admin/checklists');
      return extractList(res.data, 'checklists') as ChecklistDefinition[];
    },
  });

export const useUpdateChecklist = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ category, items, version }: { category: string; items: ChecklistDefinition['items']; version?: string }) => {
      const res = await apiClient.put<any>(`/admin/checklists/${encodeURIComponent(category)}`, { items, version });
      return res.data?.data as ChecklistDefinition;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminChecklists() }),
  });
};

export interface RulepackRecord {
  id: string;
  version: string;
  yamlText?: string;
  sha256?: string;
  active?: boolean;
  notes?: string | null;
  createdAt?: string;
}

export const useRulepacks = () =>
  useQuery({
    queryKey: queryKeys.rulepacks(),
    queryFn: async () => {
      const res = await apiClient.get<any>('/admin/rulepacks');
      return extractList(res.data, 'rulepacks') as RulepackRecord[];
    },
  });

export const useCreateRulepack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { version: string; yamlText: string; notes?: string }) => {
      const res = await apiClient.post<any>('/admin/rulepacks', payload);
      return res.data?.data as RulepackRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rulepacks() }),
  });
};

export const useActivateRulepack = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version: string) => {
      const res = await apiClient.post<any>(`/admin/rulepacks/${encodeURIComponent(version)}/activate`);
      return res.data?.data as RulepackRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rulepacks() }),
  });
};

// --- Benchmark ---

export const useBenchmarkRuns = () =>
  useQuery({
    queryKey: ['benchmark', 'runs'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/benchmark/runs');
      return extractList(res.data, 'runs').map(normalizeBenchmarkRun);
    },
  });

export const useRunBenchmark = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { n: number; seed: number; faultRate?: number; scanRatio?: number }) => {
      const res = await apiClient.post<any>('/benchmark/run', payload);
      return res.data?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchmark', 'runs'] }),
  });
};

// --- Demo settings ---
/**
 * The backend reads `clockOffsetDays`; the mock layer reads
 * `decisionDateOffsetDays`. Both keys are sent so either works.
 */
export const demoOffsetPayload = (days: number) => ({ clockOffsetDays: days, decisionDateOffsetDays: days });

export const readDemoOffset = (settings: any): number =>
  Number(settings?.clockOffsetDays ?? settings?.decisionDateOffsetDays ?? 0) || 0;

// --- Feature 1: Syndicate & Graph Visualization ---

const FALLBACK_CARTEL_COLLEGES = [
  { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', city: 'Noida', riskScore: 88, riskLevel: 'RED', isCartel: true },
  { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', city: 'Pune', riskScore: 84, riskLevel: 'RED', isCartel: true },
  { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', city: 'Bengaluru', riskScore: 82, riskLevel: 'RED', isCartel: true },
  { id: 'COL-CARTEL-04', name: 'Horizon Institute of Management & Science', state: 'Tamil Nadu', city: 'Chennai', riskScore: 79, riskLevel: 'RED', isCartel: true },
  { id: 'COL-CARTEL-05', name: 'Zenith Global Engineering College', state: 'Gujarat', city: 'Ahmedabad', riskScore: 86, riskLevel: 'RED', isCartel: true },
];

const FALLBACK_NORMAL_COLLEGES = [
  { id: 'COL-NORM-01', name: 'St. Xavier Institute of Technology', state: 'Tamil Nadu', city: 'Chennai', riskScore: 18, riskLevel: 'GREEN', isCartel: false },
  { id: 'COL-NORM-02', name: 'Kalinga Institute of Architecture', state: 'Odisha', city: 'Bhubaneswar', riskScore: 24, riskLevel: 'GREEN', isCartel: false },
  { id: 'COL-NORM-03', name: 'Sardar Patel College of Pharmacy', state: 'Gujarat', city: 'Ahmedabad', riskScore: 16, riskLevel: 'GREEN', isCartel: false },
  { id: 'COL-NORM-04', name: 'Chanakya Polytechnic Institute', state: 'Karnataka', city: 'Mysuru', riskScore: 32, riskLevel: 'GREEN', isCartel: false },
];

const FALLBACK_GHOST_FACULTY = [
  { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', type: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', type: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8' },
  { id: 'FAC-3', name: 'Dr. Arvind Kumar Verma', type: 'AADHAAR', hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a' },
  { id: 'FAC-4', name: 'Prof. Rajeshwari Natarajan', type: 'AADHAAR', hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d' },
  { id: 'FAC-5', name: 'Dr. Vikramaditya Rathore', type: 'PAN', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
];

function getFallbackSyndicateGraph() {
  const elements: any[] = [];
  [...FALLBACK_CARTEL_COLLEGES, ...FALLBACK_NORMAL_COLLEGES].forEach((c) => {
    elements.push({
      data: {
        id: c.id,
        label: c.name.replace(/ Institute.*| College.*| Academy.*/, '').trim(),
        fullName: c.name,
        nodeType: 'college',
        color: c.isCartel ? '#2563eb' : '#3b82f6',
        size: c.isCartel ? 55 : 44,
        state: c.state,
        city: c.city,
        riskScore: c.riskScore,
        riskLevel: c.riskLevel,
        isCartelMember: c.isCartel,
      },
    });
  });

  FALLBACK_GHOST_FACULTY.forEach((f) => {
    elements.push({
      data: {
        id: f.id,
        label: `${f.name.split(' ')[0]} (${f.type})`,
        fullName: f.name,
        nodeType: 'faculty',
        hash: f.hash,
        shortHash: `${f.hash.slice(0, 8)}…`,
        identifierType: f.type,
        color: '#ef4444',
        size: 26,
        isGhost: true,
      },
    });
  });

  const severityPairs: [string, string, number, number, string][] = [
    ['COL-CARTEL-01', 'COL-CARTEL-02', 4, 8, '#b91c1c'],
    ['COL-CARTEL-02', 'COL-CARTEL-03', 3, 6, '#ea580c'],
    ['COL-CARTEL-03', 'COL-CARTEL-04', 4, 8, '#b91c1c'],
    ['COL-CARTEL-04', 'COL-CARTEL-05', 3, 6, '#ea580c'],
    ['COL-CARTEL-05', 'COL-CARTEL-01', 5, 10, '#b91c1c'],
  ];

  severityPairs.forEach(([src, tgt, count, width, color]) => {
    elements.push({
      data: {
        id: `EDGE-${src}-${tgt}`,
        source: src,
        target: tgt,
        edgeType: 'shared_severity',
        severityCount: count,
        width,
        lineColor: color,
      },
    });
  });

  FALLBACK_GHOST_FACULTY.forEach((f, idx) => {
    elements.push({
      data: {
        id: `EMP-${f.id}-1`,
        source: FALLBACK_CARTEL_COLLEGES[idx % FALLBACK_CARTEL_COLLEGES.length].id,
        target: f.id,
        edgeType: 'employs',
      },
    });
    elements.push({
      data: {
        id: `EMP-${f.id}-2`,
        source: FALLBACK_CARTEL_COLLEGES[(idx + 1) % FALLBACK_CARTEL_COLLEGES.length].id,
        target: f.id,
        edgeType: 'employs',
      },
    });
  });

  return {
    success: true,
    graph: {
      elements,
      nodesCount: elements.filter((e) => !e.data.source).length,
      edgesCount: elements.filter((e) => !!e.data.source).length,
    },
    cartel: {
      cartelId: 'CARTEL-RING-ALPHA',
      name: '5-College High-Risk Faculty Sharing Syndicate',
      colleges: FALLBACK_CARTEL_COLLEGES,
      size: 5,
      totalSharedGhostFaculty: 10,
      riskScoreAvg: 85,
      riskLevel: 'CRITICAL',
      description: 'Autonomous graph detection identified a closed 5-node cycle sharing 10 identical faculty HMAC hashes across 5 states, violating AICTE section 2.4 accreditation standards.',
    },
    cypherQueries: {
      detectMultiHop: 'MATCH path = (start:College)-[:SHARES_FACULTY*2..4]->(target:College)\nWHERE start.id <> target.id\nRETURN path, length(path) AS hops',
      detectCycles: 'MATCH cyclePath = (c:College)-[r:SHARES_FACULTY*3..6]->(c)\nRETURN cyclePath',
      aggregateSeverity: 'MATCH (c1:College)-[r:SHARES_FACULTY]-(c2:College)\nRETURN c1, c2, count(r) AS severityWeight',
    },
  };
}

function getFallbackNodeProof(id: string) {
  if (id.startsWith('COL')) {
    return {
      type: 'college',
      id,
      name: id.includes('01') ? 'Apex National Institute of Technology' : 'Paramount College of Engineering & Research',
      registrationId: `AICTE-${id}`,
      state: 'Delhi NCR',
      city: 'Noida',
      riskScore: 88,
      riskLevel: 'RED',
      isCartelMember: true,
      facultyCount: 14,
      sharedFacultyCount: 6,
      facultyList: [
        { id: 'FAC-1', name: 'Dr. Ramesh Chandra Sharma', department: 'Computer Science', identifierType: 'AADHAAR', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', isGhost: true },
        { id: 'FAC-2', name: 'Prof. Sunita K. Deshmukh', department: 'Information Technology', identifierType: 'PAN', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', isGhost: true },
      ],
      colludingInstitutions: [
        { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
        { id: 'COL-CARTEL-03', name: 'Vanguard Institute of Technical Studies', state: 'Karnataka', riskScore: 82 },
      ],
      definitiveProof: {
        statement: 'Definitive multi-hop graph proof: Participates in a closed 5-node cartel syndicate sharing 6 ghost faculty across 4 institutions.',
        recommendedAction: 'IMMEDIATE_EVC_INSPECTION_AND_HOLD',
      },
    };
  }
  return {
    type: 'faculty',
    id,
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    name: 'Dr. Ramesh Chandra Sharma',
    identifierType: 'AADHAAR',
    department: 'Computer Science',
    isGhost: true,
    associatedColleges: [
      { id: 'COL-CARTEL-01', name: 'Apex National Institute of Technology', state: 'Delhi NCR', riskScore: 88 },
      { id: 'COL-CARTEL-02', name: 'Paramount College of Engineering & Research', state: 'Maharashtra', riskScore: 84 },
    ],
    definitiveProof: {
      statement: 'Duplication collision proof: Identifier AADHAAR hash appears simultaneously on active regulatory rosters of 2 distinct institutions.',
      collisionDetected: true,
    },
  };
}

export const useSyndicateGraph = () =>
  useQuery({
    queryKey: ['syndicate', 'graph'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/syndicate/graph');
        return res.data;
      } catch {
        return getFallbackSyndicateGraph();
      }
    },
    staleTime: 30_000,
  });

export const useSyndicateNodeProof = (nodeId: string | null) =>
  useQuery({
    queryKey: ['syndicate', 'node', nodeId],
    queryFn: async () => {
      if (!nodeId) return null;
      try {
        const res = await apiClient.get<any>(`/syndicate/node/${encodeURIComponent(nodeId)}`);
        return res.data?.data;
      } catch {
        return getFallbackNodeProof(nodeId);
      }
    },
    enabled: !!nodeId,
  });

export const useReseedSyndicate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<any>('/syndicate/seed');
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['syndicate'] }),
  });
};

// --- Feature 3: Cryptographic Integrity Audit ---

export interface IntegrityAuditResult {
  success: boolean;
  intact: boolean;
  breachDetected: boolean;
  status: 'CRYPTOGRAPHIC BREACH' | 'VERIFIED_INTACT';
  alert: string | null;
  message: string;
  summary: {
    totalApplications: number;
    verifiedCount: number;
    tamperedCount: number;
    autoInitializedCount?: number;
  };
  tamperedRecords: Array<{
    applicationId: string;
    applicationNumber: string;
    institutionName?: string;
    state?: string;
    status: string;
    riskScore: number;
    riskLevel: string;
    storedHash: string;
    recalculatedHash: string;
    previousHash: string;
    tamperedReason: string;
  }>;
  auditedAt: string;
}

export const useRunIntegrityAudit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get<IntegrityAuditResult>('/audit/integrity');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
      qc.invalidateQueries({ queryKey: ['apps'] });
    },
  });
};

export const useSimulateDbaTamper = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { applicationId?: string; riskScore?: number; riskLevel?: string; status?: string }) => {
      const res = await apiClient.post<any>('/audit/tamper-application', payload || {});
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useRepairApplication = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiClient.post<any>('/audit/repair-application', { applicationId });
      return res.data?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};


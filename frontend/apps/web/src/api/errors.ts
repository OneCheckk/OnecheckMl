/**
 * Maps API failures to user-facing messages without exposing stack traces or
 * internals. Preserves the backend request ID for diagnostics when present.
 */
import type { AxiosError } from 'axios';

export interface ApiErrorInfo {
  title: string;
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
  details?: { field?: string; message: string; title?: string; ruleId?: string }[];
}

const STATUS_TITLES: Record<number, string> = {
  400: 'The request could not be accepted',
  401: 'Your session has ended',
  403: 'You do not have permission for this action',
  404: 'Record not found',
  409: 'This record was changed elsewhere',
  413: 'File is too large',
  415: 'File type not accepted',
  429: 'Too many attempts',
  500: 'The server could not complete the request',
  502: 'A dependent service is not responding',
  503: 'A verification service is unavailable',
  504: 'The server took too long to respond',
};

export function describeApiError(err: unknown, fallback = 'Something went wrong.'): ApiErrorInfo {
  const e = err as AxiosError<any>;
  if (e?.isAxiosError || e?.response || e?.request) {
    const status = e.response?.status;
    const body = e.response?.data;
    const apiErr = body?.error;
    const requestId: string | undefined =
      body?.meta?.requestId ?? (e.response?.headers as any)?.['x-request-id'] ?? undefined;

    if (!e.response) {
      const timedOut = e.code === 'ECONNABORTED';
      return {
        title: timedOut ? 'The request timed out' : 'Cannot reach the OneCheck server',
        message: timedOut
          ? 'The server did not respond in time. Please try again.'
          : 'Check your network connection or whether the API server is running, then try again.',
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      };
    }

    return {
      title: (status && STATUS_TITLES[status]) || 'Request failed',
      message:
        (typeof apiErr?.message === 'string' && apiErr.message) ||
        (status === 401 ? 'Please sign in again.' : fallback),
      code: apiErr?.code ?? (status ? `HTTP_${status}` : undefined),
      status,
      requestId,
      details: Array.isArray(apiErr?.details) ? apiErr.details : undefined,
    };
  }
  if (err instanceof Error) return { title: 'Unexpected error', message: err.message || fallback };
  return { title: 'Unexpected error', message: fallback };
}

export const errorMessage = (err: unknown, fallback?: string) => describeApiError(err, fallback).message;

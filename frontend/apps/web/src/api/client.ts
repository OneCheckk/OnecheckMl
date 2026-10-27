import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { addIdAliases } from './adapters';

// Storage key for token
export const AUTH_TOKEN_KEY = 'onecheck_auth_token';
export const AUTH_USER_KEY = 'onecheck_auth_user';

export const getStoredToken = (): string | null => {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token: string | null): void => {
  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in non-browser envs
  }
};

// Global event emitter for API interceptor side-effects
type ApiEventType = '401_UNAUTHORIZED' | '403_FORBIDDEN' | '409_CONFLICT' | 'TOAST_ERROR';
type ApiEventListener = (payload?: any) => void;

class ApiEventManager {
  private listeners: Map<ApiEventType, Set<ApiEventListener>> = new Map();

  on(event: ApiEventType, listener: ApiEventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit(event: ApiEventType, payload?: any) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }
}

export const apiEvents = new ApiEventManager();

// Generate request ID
const generateRequestId = () => {
  return 'req-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
};

export const resolveApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE;
  if (!envUrl) return '/api';
  if (envUrl === '/api' || envUrl.endsWith('/api') || envUrl.endsWith('/api/')) {
    return envUrl;
  }
  return `${envUrl.replace(/\/+$/, '')}/api`;
};

export const apiClient = axios.create({
  baseURL: resolveApiBase(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach bearer token and X-Request-Id
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.headers) {
    config.headers['X-Request-Id'] = generateRequestId();
  }
  return config;
});

// Response interceptor: handle 401, 403, 409, and standard error mappings
apiClient.interceptors.response.use(
  (response) => {
    // Presentation adapter: alias Mongo `_id` as `id` (non-destructive, see api/adapters.ts)
    if (response.data && typeof response.data === 'object' && !(response.data instanceof Blob)) {
      addIdAliases(response.data);
    }
    return response;
  },
  (error: AxiosError<{ error?: { code: string; message: string }; meta?: { requestId?: string } }>) => {
    if (error.response) {
      const status = error.response.status;
      const apiError = error.response.data?.error;
      const message = apiError?.message || error.message || 'An error occurred';
      const requestId = error.response.data?.meta?.requestId;

      if (status === 401) {
        const url = error.config?.url || '';
        const isLoginAttempt = url.includes('/auth/login') || url.includes('/auth/dev-bypass');
        const isDevSession = sessionStorage.getItem('onecheck_dev_session') === 'true';

        if (!isLoginAttempt && !isDevSession) {
          apiEvents.emit('401_UNAUTHORIZED');
        }
      } else if (status === 403) {
        apiEvents.emit('403_FORBIDDEN');
      } else if (status === 409) {
        apiEvents.emit('409_CONFLICT', {
          message: 'This item changed, reload?',
        });
      } else if (status === 400 || status === 404 || status === 422) {
        // Validation and not-found responses are rendered inline by the calling screen.
      } else {
        apiEvents.emit('TOAST_ERROR', {
          code: apiError?.code || `HTTP_${status}`,
          message,
          requestId,
        });
      }
    } else {
      apiEvents.emit('TOAST_ERROR', {
        code: 'NETWORK_ERROR',
        message: 'Network error or server unreachable',
      });
    }
    return Promise.reject(error);
  }
);

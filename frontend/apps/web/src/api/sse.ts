import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getStoredToken, resolveApiBase } from './client';

export type SSEConnectionState = 'connected' | 'reconnecting' | 'polling' | 'disconnected';

export interface SSEOptions {
  applicationId?: string;
  onAlert?: (alert: any) => void;
}

export const useSSE = (options?: SSEOptions) => {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected');
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const startPollingFallback = () => {
    setConnectionState('polling');
    if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);

    fallbackIntervalRef.current = setInterval(() => {
      if (options?.applicationId) {
        queryClient.invalidateQueries({ queryKey: ['app', options.applicationId] });
        queryClient.invalidateQueries({ queryKey: ['findings', options.applicationId] });
        queryClient.invalidateQueries({ queryKey: ['ledger', options.applicationId] });
        queryClient.invalidateQueries({ queryKey: ['docs', options.applicationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }, 5000);
  };

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setConnectionState('disconnected');
      return;
    }

    controllerRef.current = new AbortController();
    const url = `${resolveApiBase()}/events`;

    fetchEventSource(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controllerRef.current.signal,
      onopen: async (response) => {
        if (response.ok) {
          setConnectionState('connected');
          if (fallbackIntervalRef.current) {
            clearInterval(fallbackIntervalRef.current);
            fallbackIntervalRef.current = null;
          }
        } else {
          startPollingFallback();
        }
      },
      onmessage: (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'APPLICATION_UPDATED' && data.applicationId) {
            queryClient.invalidateQueries({ queryKey: ['app', data.applicationId] });
            queryClient.invalidateQueries({ queryKey: ['findings', data.applicationId] });
            queryClient.invalidateQueries({ queryKey: ['ledger', data.applicationId] });
            queryClient.invalidateQueries({ queryKey: ['docs', data.applicationId] });
          } else if (data.type === 'ALERT_RAISED') {
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
            if (options?.onAlert) {
              options.onAlert(data.alert);
            }
          }
        } catch {
          // Ignore parse errors on keepalive ping
        }
      },
      onerror: () => {
        startPollingFallback();
      },
    }).catch(() => {
      startPollingFallback();
    });

    return () => {
      controllerRef.current?.abort();
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
    };
  }, [options?.applicationId, queryClient]);

  return { connectionState };
};

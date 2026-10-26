import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { AppRoutes } from './routes';
import { apiEvents } from './api/client';
import { Modal, Button } from './components/ui';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  const [toast, setToast] = useState<{ code: string; message: string; requestId?: string } | null>(null);
  const [conflictModalOpen, setConflictModalOpen] = useState<boolean>(false);

  // Global listeners for axios interceptors
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubToast = apiEvents.on('TOAST_ERROR', (payload) => {
      setToast(payload);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 7000);
    });

    const unsubConflict = apiEvents.on('409_CONFLICT', () => {
      setConflictModalOpen(true);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubToast();
      unsubConflict();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          {/* Global error toast (network / server errors) */}
          <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-end p-4">
            {toast && (
              <div
                role="alert"
                className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded border border-bad-line border-l-[3px] border-l-bad bg-white px-4 py-3 text-sm shadow-lg"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{toast.message}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-faint">
                    <span className="font-mono">{toast.code}</span>
                    {toast.requestId && (
                      <>
                        {' '}· Request ID <span className="font-mono">{toast.requestId}</span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="rounded p-0.5 text-ink-faint hover:text-ink"
                  aria-label="Dismiss message"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* 409 Conflict Dialog: "This item changed, reload?" */}
          <Modal
            isOpen={conflictModalOpen}
            onClose={() => setConflictModalOpen(false)}
            title="This record has changed"
            footer={
              <>
                <Button variant="outline" size="sm" onClick={() => setConflictModalOpen(false)}>
                  Keep my view
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setConflictModalOpen(false);
                    window.location.reload();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reload latest version
                </Button>
              </>
            }
          >
            <p className="text-ink-soft">
              This item changed, reload? Another user or a background verification job updated this record after you
              opened it.
            </p>
          </Modal>

          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

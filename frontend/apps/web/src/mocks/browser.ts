import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export const initMocks = async () => {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
    console.log('[MSW] Mock Service Worker active for OneCheck API mocking.');
  }
};

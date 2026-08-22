import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against benign browser iframe IndexedDB teardown / closing events
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || '');
    if (
      msg.includes('The database connection is closing') ||
      msg.includes('IDBDatabase') ||
      msg.includes('IndexedDB')
    ) {
      // Suppress benign iframe IDB connection teardown warnings
      event.preventDefault();
      console.warn('Recovered from transient IndexedDB connection event:', msg);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (
      msg.includes('The database connection is closing') ||
      msg.includes('IDBDatabase')
    ) {
      event.preventDefault();
      console.warn('Suppressed transient IndexedDB window error:', msg);
    }
  });
}

// Register Service Worker for PWA, Google Play TWA, Periodic Sync & Background Sync
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // Register Periodic Background Sync if supported (e.g. Chrome / Android TWA)
      if ('periodicSync' in registration) {
        try {
          const status = await (navigator as any).permissions?.query({ name: 'periodic-background-sync' });
          if (status?.state === 'granted') {
            await (registration as any).periodicSync.register('daily-vocab-sync', {
              minInterval: 24 * 60 * 60 * 1000 // 24 hours
            });
          }
        } catch (e) {
          // Non-blocking fallback
        }
      }

      // Background Sync on online recovery
      window.addEventListener('online', () => {
        if ('sync' in registration) {
          (registration as any).sync.register('sync-vocab-scores').catch(() => {});
        }
      });
    } catch (err) {
      console.warn('Service worker registration notice:', err);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


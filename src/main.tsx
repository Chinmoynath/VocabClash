import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {SpeedInsights} from '@vercel/speed-insights/react';
import {Analytics} from '@vercel/analytics/react';
import App from './App.tsx';
import './index.css';
import { isWebBrowser, cleanupServiceWorkersIfNative, isNativeCapacitor, configureNativeStatusBar } from './utils/platform';

// Early initialization for native Capacitor Android status bar
if (typeof window !== 'undefined' && isNativeCapacitor()) {
  configureNativeStatusBar().catch(() => {});
}

// Guard against benign browser iframe IndexedDB teardown / closing events and Vite HMR websocket closure
if (typeof window !== 'undefined') {
  const isBenignTransientError = (text: string) => {
    const lower = text.toLowerCase();
    return (
      lower.includes('websocket closed without opened') ||
      lower.includes('failed to connect to websocket') ||
      lower.includes('@vite/client') ||
      lower.includes('vite:ws') ||
      lower.includes('database is closing') ||
      lower.includes('closing/hidden') ||
      lower.includes('connection is closing') ||
      lower.includes('idbdatabase') ||
      lower.includes('indexeddb')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || '');
    const stack = reason?.stack || '';
    if (isBenignTransientError(msg) || isBenignTransientError(stack)) {
      // Suppress benign iframe IDB connection teardown & Vite HMR WebSocket warnings
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || String(event?.error?.message || '');
    const filename = event?.filename || '';
    if (isBenignTransientError(msg) || isBenignTransientError(filename)) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  });
}

// Service Worker handling:
// - In standard web browser & PWA: ensure service worker is active for offline/caching
// - In native Capacitor: clean up any legacy SW or caches from prior TWA installs to avoid stale asset lockups
if (typeof window !== 'undefined') {
  if (isWebBrowser()) {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('Service worker registration non-blocking notice:', err);
        });
      });
    }
  } else {
    cleanupServiceWorkersIfNative();
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <SpeedInsights />
    <Analytics />
  </StrictMode>,
);


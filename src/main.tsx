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

// Register Service Worker for PWA / Google Play TWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration non-blocking notice:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


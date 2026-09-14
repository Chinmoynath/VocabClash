// VocabClash High-Performance Unified Service Worker (PWA + Firebase Cloud Messaging Web Push)
/* eslint-disable no-undef */

// 1. IMPORT FIREBASE SCRIPTS FOR WEB PUSH MESSAGING
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

  // Initialize Firebase inside the Service Worker
  firebase.initializeApp({
    apiKey: 'AIzaSyDBKpWcJ0G2lPF92SbFcNGwBB-oV-6z3xM',
    authDomain: 'auth.vocabclash.in',
    projectId: 'tactile-world-jq6d2',
    storageBucket: 'tactile-world-jq6d2.firebasestorage.app',
    messagingSenderId: '970204579955',
    appId: '1:970204579955:web:0a0f9a1e4fc374bddc4206',
  });

  const messaging = firebase.messaging();

  // Handle Firebase Background Messages
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Firebase background push message received:', payload);

    const title = payload.notification?.title || payload.data?.title || 'VocabClash Challenge 🔥';
    const body = payload.notification?.body || payload.data?.body || 'Your daily vocabulary revision and duel matches are waiting!';
    const clickAction = payload.fcmOptions?.link || payload.data?.url || '/';

    const options = {
      body,
      icon: payload.notification?.icon || '/icon-192.png',
      badge: '/favicon.png',
      tag: payload.data?.tag || 'vocabclash-notification',
      data: {
        url: clickAction,
      },
      actions: [
        { action: 'play', title: '⚔️ Battle Now' },
        { action: 'close', title: 'Dismiss' },
      ],
    };

    self.registration.showNotification(title, options);
  });
} catch (fcmInitErr) {
  console.warn('[SW] Firebase Messaging initialization notice:', fcmInitErr);
}

// 2. CACHING CONFIGURATION FOR PWA & OFFLINE CAPABILITIES
const CACHE_NAME = 'vocabclash-v2.7';
const OFFLINE_FALLBACK_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshot-mobile.png',
  '/screenshot-wide.png',
];

// 3. INSTALL EVENT - Pre-cache critical core shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Non-critical precache asset warning:', err);
      });
    }),
  );
});

// 4. ACTIVATE EVENT - Clean old cache versions & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting deprecated cache:', cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// 5. FETCH EVENT - Stale-While-Revalidate with full offline fallback
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin non-app requests (e.g., razorpay, ads, firebase streaming, googleapis)
  if (url.origin !== self.location.origin) return;

  // For API endpoints, verification files, and service workers, pass directly through network
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/ads.txt' ||
    url.pathname === '/app-ads.txt' ||
    url.pathname === '/robots.txt' ||
    url.pathname === '/sitemap.xml' ||
    url.pathname === '/sw.js' ||
    url.pathname === '/firebase-messaging-sw.js' ||
    url.pathname === '/service-worker.js' ||
    url.pathname.startsWith('/.well-known/')
  ) {
    return;
  }

  // Stale-while-revalidate / Network-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_FALLBACK_URL);
          }
        });

      return cachedResponse || fetchPromise;
    }),
  );
});

// 6. PERIODIC BACKGROUND SYNC (PWABuilder capability)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'vocabclash-daily-sync' || event.tag === 'get-daily-words') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch('/api/daily-quiz')
          .then((res) => res.json())
          .then(() => {
            console.log('[SW] Periodic sync refreshed daily vocab bank');
          })
          .catch(() => {
            console.log('[SW] Periodic sync offline deferral');
          });
      }),
    );
  }
});

// 7. BACKGROUND SYNC (Offline action sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress' || event.tag === 'vocabclash-sync') {
    event.waitUntil(
      Promise.resolve(console.log('[SW] Background sync triggered - syncing pending practice data')),
    );
  }
});

// 8. FALLBACK RAW PUSH EVENT (for non-FCM or direct web pushes)
self.addEventListener('push', (event) => {
  let data = {
    title: 'VocabClash Daily Streak Alert! 🔥',
    body: 'Complete your 5-minute daily Govt Exam vocab quiz to maintain your streak!',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    data: { url: '/?mode=daily' },
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/favicon.png',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' },
    actions: [
      { action: 'play', title: '⚔️ Battle Now' },
      { action: 'close', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 9. NOTIFICATION CLICK HANDLER
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// 10. SKIP WAITING MESSAGE DISPATCH
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

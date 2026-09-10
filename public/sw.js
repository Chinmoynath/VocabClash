// VocabClash High-Performance Service Worker for PWA, PWABuilder & Google Play TWA
const CACHE_NAME = 'vocabclash-v2.5';
const OFFLINE_FALLBACK_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshot-mobile.png',
  '/screenshot-wide.png'
];

// 1. INSTALL EVENT - Pre-cache critical core shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Non-critical precache asset warning:', err);
      });
    })
  );
});

// 2. ACTIVATE EVENT - Clean old cache versions & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting deprecated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH EVENT - Stale-While-Revalidate with full offline fallback
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin non-app requests (e.g., razorpay, ads, firebase streaming)
  if (url.origin !== self.location.origin) return;

  // For API endpoints, pass directly through network
  if (url.pathname.startsWith('/api/')) return;

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
    })
  );
});

// 4. PERIODIC BACKGROUND SYNC (PWABuilder capability)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'vocabclash-daily-sync' || event.tag === 'get-daily-words') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch('/api/daily-quiz')
          .then((res) => res.json())
          .then((data) => {
            console.log('[SW] Periodic sync refreshed daily vocab bank');
          })
          .catch((err) => {
            console.log('[SW] Periodic sync offline deferral');
          });
      })
    );
  }
});

// 5. BACKGROUND SYNC (Offline action sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress' || event.tag === 'vocabclash-sync') {
    event.waitUntil(
      console.log('[SW] Background sync triggered - syncing pending practice data')
    );
  }
});

// 6. PUSH NOTIFICATIONS (Exam Alerts & Daily Streaks)
self.addEventListener('push', (event) => {
  let data = {
    title: 'VocabClash Daily Streak Alert! 🔥',
    body: 'Complete your 5-minute daily Govt Exam vocab quiz to maintain your streak!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/pyq-drill', type: 'general' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data.title = parsed.notification?.title || parsed.data?.title || parsed.title || data.title;
      data.body = parsed.notification?.body || parsed.data?.body || parsed.body || data.body;
      data.icon = parsed.notification?.icon || parsed.data?.icon || parsed.icon || data.icon;
      data.data = {
        url: parsed.data?.url || parsed.data?.click_action || parsed.url || '/pyq-drill',
        type: parsed.data?.type || 'general'
      };
    } catch (e) {
      const text = event.data.text();
      if (text) {
        data.body = text;
      }
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [150, 75, 150],
    data: data.data || { url: '/pyq-drill' },
    tag: `vocabclash_${Date.now()}`,
    renotify: true,
    actions: [
      { action: 'play', title: '⚔️ Practice Now' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 7. NOTIFICATION CLICK HANDLER
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') {
    return;
  }

  const rawUrl = event.notification.data?.url || '/pyq-drill';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 8. SKIP WAITING MESSAGE DISPATCH
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

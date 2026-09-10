// Firebase Cloud Messaging Background Service Worker for VocabClash
// Compatible with PWA, Android TWA, and Capacitor Webview

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDBKpWcJ0G2lPF92SbFcNGwBB-oV-6z3xM",
  authDomain: "tactile-world-jq6d2.firebaseapp.com",
  projectId: "tactile-world-jq6d2",
  storageBucket: "tactile-world-jq6d2.firebasestorage.app",
  messagingSenderId: "970204579955",
  appId: "1:970204579955:web:0a0f9a1e4fc374bddc4206"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Received background message:', payload);

    const title = payload.notification?.title || payload.data?.title || 'VocabClash Daily Reminder ⚔️';
    const body = payload.notification?.body || payload.data?.body || 'Practice today’s exam vocabulary questions on VocabClash!';
    const icon = payload.notification?.icon || payload.data?.icon || '/icon-192.png';
    const targetUrl = payload.data?.url || payload.data?.click_action || '/pyq-drill';
    const notificationType = payload.data?.type || 'general';

    const notificationOptions = {
      body: body,
      icon: icon,
      badge: '/icon-192.png',
      image: payload.notification?.image || payload.data?.image || undefined,
      vibrate: [150, 75, 150],
      tag: payload.data?.tag || `vocabclash_${notificationType}_${Date.now()}`,
      renotify: true,
      data: {
        url: targetUrl,
        type: notificationType,
        timestamp: Date.now()
      },
      actions: [
        { action: 'open_app', title: '⚔️ Practice Now' },
        { action: 'dismiss', title: 'Later' }
      ]
    };

    return self.registration.showNotification(title, notificationOptions);
  });
} catch (err) {
  console.error('[FCM-SW] Firebase Messaging SW init notice:', err);
}

// Handle notification click to focus or navigate
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const rawUrl = event.notification.data?.url || '/pyq-drill';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus and navigate it
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no window open, launch a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Skip waiting if requested
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker for VocabClash Background Notifications

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

// Initialize Firebase inside the Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDBKpWcJ0G2lPF92SbFcNGwBB-oV-6z3xM",
  authDomain: "auth.vocabclash.in",
  projectId: "tactile-world-jq6d2",
  storageBucket: "tactile-world-jq6d2.firebasestorage.app",
  messagingSenderId: "970204579955",
  appId: "1:970204579955:web:0a0f9a1e4fc374bddc4206"
});

const messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message:", payload);

  const title = payload.notification?.title || payload.data?.title || "VocabClash Challenge";
  const body = payload.notification?.body || payload.data?.body || "Your daily vocabulary revision and duel matches are waiting!";
  const clickAction = payload.fcmOptions?.link || payload.data?.url || "/";

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/favicon.png",
    tag: payload.data?.tag || "vocabclash-notification",
    data: {
      url: clickAction
    },
    actions: [
      { action: "play", title: "⚔️ Play Duel" },
      { action: "review", title: "📖 Review Vault" }
    ]
  };

  self.registration.showNotification(title, options);
});

// Handle notification click to focus or open VocabClash app window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("vocabclash") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

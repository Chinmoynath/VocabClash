/**
 * Firebase Cloud Messaging (FCM) Web Push Notification Service
 * Project: tactile-world-jq6d2
 * Messaging Sender ID: 970204579955
 * Auth Domain: auth.vocabclash.in
 * Unified Service Worker: /sw.js
 */

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { firebaseApp } from './firebaseService';

// Existing Firebase Web Push VAPID Public Key
export const FCM_VAPID_PUBLIC_KEY = 'BN7hCXmy_uYeEvhz6-LzgzmpFqJA1-SxbP_a4ixQ8DfHzG2ePkDxdZ3EeAZrMJ-DTjbhgGDcgw4L3X97gHHIMFU';

export interface NotificationSetupResult {
  success: boolean;
  token?: string;
  permission: NotificationPermission | 'unsupported';
  error?: string;
}

/**
 * Checks if Notification API, Service Worker, and Firebase Messaging are supported by current browser environment.
 */
export async function isPushNotificationSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/**
 * Returns current Notification.permission without prompting the user.
 */
export function getCurrentNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Explicit user-triggered flow to enable push notifications and obtain FCM token.
 * Reuses the existing unified PWA service worker registration (/sw.js) and existing Firebase App instance.
 */
export async function enableNotifications(): Promise<NotificationSetupResult> {
  console.log('[FCM] Starting notification setup');

  // 1. Verify Browser Support
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    const errorMsg = 'Push notifications or Service Workers are not supported in this browser.';
    console.error('[FCM] Error:', errorMsg);
    return {
      success: false,
      permission: 'unsupported',
      error: errorMsg,
    };
  }

  const supported = await isSupported().catch((err) => {
    console.error('[FCM] Error checking Firebase messaging support:', err);
    return false;
  });

  if (!supported) {
    const errorMsg = 'Firebase Cloud Messaging is not supported in this browser environment.';
    console.error('[FCM] Error:', errorMsg);
    return {
      success: false,
      permission: 'unsupported',
      error: errorMsg,
    };
  }

  console.log('[FCM] Browser supports notifications');

  // 2. Check current permission
  let currentPermission = Notification.permission;
  console.log('[FCM] Current permission:', currentPermission);

  // 3. Request permission if not already granted
  if (currentPermission !== 'granted') {
    if (currentPermission === 'denied') {
      const errorMsg = 'Notification permission has been blocked in your browser settings. Please enable notifications in site settings to proceed.';
      console.error('[FCM] Error:', errorMsg);
      return {
        success: false,
        permission: 'denied',
        error: errorMsg,
      };
    }

    try {
      currentPermission = await Notification.requestPermission();
    } catch (permError) {
      console.error('[FCM] Error requesting notification permission:', permError);
      return {
        success: false,
        permission: currentPermission,
        error: permError instanceof Error ? permError.message : 'Failed to request permission',
      };
    }
  }

  if (currentPermission !== 'granted') {
    const errorMsg = `Notification permission was not granted (status: ${currentPermission}).`;
    console.error('[FCM] Error:', errorMsg);
    return {
      success: false,
      permission: currentPermission,
      error: errorMsg,
    };
  }

  console.log('[FCM] Permission granted');

  try {
    // 4. Inspect all existing Service Worker registrations for diagnostics
    const existingRegistrations = await navigator.serviceWorker.getRegistrations();
    console.log(`[FCM] Total ServiceWorker registrations found: ${existingRegistrations.length}`);

    existingRegistrations.forEach((reg, index) => {
      console.log(`[FCM] Registration #${index + 1}:`, {
        scope: reg.scope,
        active: reg.active ? reg.active.scriptURL : null,
        waiting: reg.waiting ? reg.waiting.scriptURL : null,
        installing: reg.installing ? reg.installing.scriptURL : null,
      });
    });

    // 5. Obtain or reuse the root-scope ServiceWorkerRegistration
    let targetRegistration: ServiceWorkerRegistration | undefined;

    // Prefer the active registration controlling scope '/'
    for (const reg of existingRegistrations) {
      if (reg.scope.endsWith('/') || reg.scope === window.location.origin + '/') {
        targetRegistration = reg;
        break;
      }
    }

    if (!targetRegistration) {
      console.log('[FCM] No existing root registration found. Registering /sw.js');
      targetRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }

    // Wait until the service worker is active and ready
    const readyRegistration = await navigator.serviceWorker.ready;
    const registrationToUse = targetRegistration || readyRegistration;

    console.log('[FCM] Service worker registered & ready');
    console.log('[FCM] Passing ServiceWorkerRegistration to Firebase:', {
      scope: registrationToUse.scope,
      activeScript: registrationToUse.active?.scriptURL,
      state: registrationToUse.active?.state,
    });

    // 6. Initialize Firebase Messaging from EXISTING Firebase app
    const messaging = getMessaging(firebaseApp);
    console.log('[FCM] Firebase Messaging initialized');

    // 7. Request FCM Registration Token using unified ServiceWorkerRegistration & VAPID key
    console.log('[FCM] Requesting FCM token');
    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registrationToUse,
    });

    if (!token) {
      const errorMsg = 'getToken() returned an empty token. Check project VAPID key and web push configuration.';
      console.error('[FCM] Error:', errorMsg);
      return {
        success: false,
        permission: currentPermission,
        error: errorMsg,
      };
    }

    // 8. Success log
    console.log('[FCM] TOKEN:', token);

    return {
      success: true,
      token,
      permission: currentPermission,
    };
  } catch (error: any) {
    console.error('[FCM] Error:', error);
    return {
      success: false,
      permission: currentPermission,
      error: error?.message || String(error),
    };
  }
}

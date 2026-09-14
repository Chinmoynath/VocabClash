/**
 * Firebase Cloud Messaging (FCM) Web Push Notification Service
 * Project: tactile-world-jq6d2
 * Messaging Sender ID: 970204579955
 * Auth Domain: auth.vocabclash.in
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
 * Reuses the existing Firebase App instance and existing service worker registration.
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
    // 4. Register or reuse /firebase-messaging-sw.js
    console.log('[FCM] Registering service worker');
    
    // Look for existing registration first
    let registration: ServiceWorkerRegistration | undefined;
    const existingRegistrations = await navigator.serviceWorker.getRegistrations();
    
    for (const reg of existingRegistrations) {
      if (
        reg.active?.scriptURL.includes('firebase-messaging-sw.js') ||
        reg.installing?.scriptURL.includes('firebase-messaging-sw.js') ||
        reg.waiting?.scriptURL.includes('firebase-messaging-sw.js')
      ) {
        registration = reg;
        break;
      }
    }

    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
    }

    // Wait until the service worker is active / ready
    await navigator.serviceWorker.ready;
    console.log('[FCM] Service worker registered', registration);

    // 5. Initialize Firebase Messaging from EXISTING Firebase app
    const messaging = getMessaging(firebaseApp);
    console.log('[FCM] Firebase Messaging initialized');

    // 6. Request FCM Registration Token
    console.log('[FCM] Requesting FCM token');
    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
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

    // 7. Success log
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

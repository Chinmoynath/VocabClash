/**
 * Firebase Cloud Messaging (FCM) Web Push Notification & Diagnostic Service
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

export interface PushDiagnosticReport {
  timestamp: string;
  permission: NotificationPermission | 'unsupported';
  registrationsCount: number;
  registrations: Array<{
    scope: string;
    active: string | null;
    waiting: string | null;
    installing: string | null;
  }>;
  targetWorker: {
    scope: string;
    scriptURL: string | null;
    state: string | null;
  } | null;
  rawPushStatus: 'not_attempted' | 'success' | 'failed' | 'already_subscribed';
  rawPushEndpoint?: string;
  rawPushError?: {
    name: string;
    message: string;
    stack?: string;
  };
  firebaseTokenStatus: 'not_attempted' | 'success' | 'failed';
  firebaseToken?: string;
  firebaseError?: {
    name: string;
    message: string;
    stack?: string;
  };
  diagnosisVerdict: string;
}

/**
 * Utility: Converts URL-safe Base64 VAPID public key to standard Uint8Array for PushManager
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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

// In-memory / session storage token cache to track whether a valid FCM token was generated
let activeFcmToken: string | null = null;

export function getActiveFcmToken(): string | null {
  if (activeFcmToken) return activeFcmToken;
  try {
    return sessionStorage.getItem('vocabclash_fcm_token');
  } catch {
    return null;
  }
}

export function setActiveFcmToken(token: string | null) {
  activeFcmToken = token;
  try {
    if (token) {
      sessionStorage.setItem('vocabclash_fcm_token', token);
    } else {
      sessionStorage.removeItem('vocabclash_fcm_token');
    }
  } catch {}
}

/**
 * COMPREHENSIVE PUSH REGISTRATION DIAGNOSTIC
 * 1. Checks Notification.permission
 * 2. Logs all active Service Worker registrations
 * 3. Directly tests browser PushManager.getSubscription() / PushManager.subscribe()
 * 4. Isolates whether failure is in Browser Push API or Firebase getToken()
 */
export async function runPushDiagnostic(): Promise<PushDiagnosticReport> {
  const report: PushDiagnosticReport = {
    timestamp: new Date().toISOString(),
    permission: getCurrentNotificationPermission(),
    registrationsCount: 0,
    registrations: [],
    targetWorker: null,
    rawPushStatus: 'not_attempted',
    firebaseTokenStatus: 'not_attempted',
    diagnosisVerdict: 'Diagnostic started...',
  };

  console.group('[PUSH TEST] === Push Notification Diagnostic Run ===');
  console.log('[PUSH TEST] 1. Notification permission:', report.permission);

  // Check browser support
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    report.diagnosisVerdict = 'Push API or Service Workers are not supported in this browser environment.';
    console.error('[PUSH TEST] Support Error:', report.diagnosisVerdict);
    console.groupEnd();
    return report;
  }

  try {
    // 2. Log every current service worker registration
    const registrations = await navigator.serviceWorker.getRegistrations();
    report.registrationsCount = registrations.length;
    console.log(`[PUSH TEST] 2. Found ${registrations.length} ServiceWorker registration(s):`);

    report.registrations = registrations.map((reg, index) => {
      const regInfo = {
        scope: reg.scope,
        active: reg.active ? reg.active.scriptURL : null,
        waiting: reg.waiting ? reg.waiting.scriptURL : null,
        installing: reg.installing ? reg.installing.scriptURL : null,
      };
      console.log(`[PUSH TEST]    Registration #${index + 1}:`, regInfo);
      return regInfo;
    });

    // 3. Identify the target ServiceWorkerRegistration
    let targetRegistration: ServiceWorkerRegistration | undefined;
    for (const reg of registrations) {
      if (reg.scope.endsWith('/') || reg.scope === window.location.origin + '/') {
        targetRegistration = reg;
        break;
      }
    }

    if (!targetRegistration) {
      console.log('[PUSH TEST] No active root registration found, querying navigator.serviceWorker.ready...');
      targetRegistration = await navigator.serviceWorker.ready;
    }

    report.targetWorker = {
      scope: targetRegistration.scope,
      scriptURL: targetRegistration.active ? targetRegistration.active.scriptURL : null,
      state: targetRegistration.active ? targetRegistration.active.state : null,
    };
    console.log('[PUSH TEST] 3. Target Service Worker for Push:', report.targetWorker);

    if (!('pushManager' in targetRegistration)) {
      report.diagnosisVerdict = 'pushManager is not available on target ServiceWorkerRegistration.';
      console.error('[PUSH TEST] PushManager missing:', report.diagnosisVerdict);
      console.groupEnd();
      return report;
    }

    // 4. Test Browser Push API directly before touching Firebase
    console.log('[PUSH TEST] 4. Querying existing browser PushManager subscription...');
    let existingSubscription = await targetRegistration.pushManager.getSubscription();

    if (existingSubscription) {
      console.log('[PUSH TEST] Existing subscription found:', existingSubscription.endpoint);
      report.rawPushStatus = 'already_subscribed';
      report.rawPushEndpoint = existingSubscription.endpoint;
    } else {
      console.log('[PUSH TEST] No existing subscription. Creating raw PushManager subscription with VAPID key...');
      const convertedVapidKey = urlBase64ToUint8Array(FCM_VAPID_PUBLIC_KEY);

      try {
        const newSubscription = await targetRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
        console.log('[PUSH TEST] Raw subscription SUCCESS:', newSubscription.endpoint);
        report.rawPushStatus = 'success';
        report.rawPushEndpoint = newSubscription.endpoint;
      } catch (rawPushErr: any) {
        console.error('[PUSH TEST] Raw subscription ERROR:');
        console.error('  name:', rawPushErr?.name);
        console.error('  message:', rawPushErr?.message);
        console.error('  stack:', rawPushErr?.stack);

        report.rawPushStatus = 'failed';
        report.rawPushError = {
          name: rawPushErr?.name || 'Error',
          message: rawPushErr?.message || String(rawPushErr),
          stack: rawPushErr?.stack,
        };

        report.diagnosisVerdict = 'Browser push subscription itself is failing before Firebase. (Check Chrome/Brave push service, network/firewall, or VAPID key format)';
        console.warn('[PUSH TEST] VERDICT:', report.diagnosisVerdict);
        console.groupEnd();
        return report;
      }
    }

    // 5. Raw push succeeded! Now test Firebase getToken()
    console.log('[PUSH TEST] 5. Browser Push API works! Now testing Firebase getToken()...');
    const isFbSupported = await isSupported().catch(() => false);
    if (!isFbSupported) {
      report.firebaseTokenStatus = 'failed';
      report.diagnosisVerdict = 'Browser Push API works, but Firebase Messaging isSupported() returned false.';
      console.warn('[PUSH TEST] VERDICT:', report.diagnosisVerdict);
      console.groupEnd();
      return report;
    }

    const messaging = getMessaging(firebaseApp);
    try {
      console.log('[PUSH TEST] Requesting FCM token via getToken()...');
      const token = await getToken(messaging, {
        vapidKey: FCM_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: targetRegistration,
      });

      if (token) {
        console.log('[FCM] TOKEN:', token);
        report.firebaseTokenStatus = 'success';
        report.firebaseToken = token;
        setActiveFcmToken(token);
        report.diagnosisVerdict = 'SUCCESS! Both Browser PushManager and Firebase getToken() succeeded. Valid FCM Token created.';
      } else {
        report.firebaseTokenStatus = 'failed';
        report.diagnosisVerdict = 'Browser Push API works; failure is inside Firebase registration/token flow (getToken returned empty).';
        console.warn('[PUSH TEST] VERDICT:', report.diagnosisVerdict);
      }
    } catch (fbErr: any) {
      console.error('[PUSH TEST] Firebase getToken() ERROR:');
      console.error('  name:', fbErr?.name);
      console.error('  message:', fbErr?.message);
      console.error('  stack:', fbErr?.stack);

      report.firebaseTokenStatus = 'failed';
      report.firebaseError = {
        name: fbErr?.name || 'Error',
        message: fbErr?.message || String(fbErr),
        stack: fbErr?.stack,
      };

      report.diagnosisVerdict = 'Browser Push API works; failure is inside Firebase registration/token flow.';
      console.warn('[PUSH TEST] VERDICT:', report.diagnosisVerdict);
    }
  } catch (err: any) {
    console.error('[PUSH TEST] Diagnostic unexpected error:', err);
    report.diagnosisVerdict = `Unexpected diagnostic failure: ${err?.message || err}`;
  }

  console.groupEnd();
  return report;
}

/**
 * Standard enable notifications caller
 */
export async function enableNotifications(): Promise<NotificationSetupResult> {
  console.log('[FCM] Starting notification setup');

  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    const errorMsg = 'Push notifications or Service Workers are not supported in this browser.';
    console.error('[FCM] Error:', errorMsg);
    return { success: false, permission: 'unsupported', error: errorMsg };
  }

  let currentPermission = Notification.permission;
  console.log('[FCM] Current permission:', currentPermission);

  if (currentPermission !== 'granted') {
    if (currentPermission === 'denied') {
      const errorMsg = 'Notification permission has been blocked in browser settings. Please allow notifications in site settings.';
      console.error('[FCM] Error:', errorMsg);
      return { success: false, permission: 'denied', error: errorMsg };
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
    return { success: false, permission: currentPermission, error: errorMsg };
  }

  console.log('[FCM] Permission granted');

  // Run the full push flow and diagnostic
  const diagnostic = await runPushDiagnostic();

  if (diagnostic.firebaseTokenStatus === 'success' && diagnostic.firebaseToken) {
    return {
      success: true,
      token: diagnostic.firebaseToken,
      permission: currentPermission,
    };
  }

  return {
    success: false,
    permission: currentPermission,
    error: diagnostic.rawPushError?.message || diagnostic.firebaseError?.message || diagnostic.diagnosisVerdict,
  };
}

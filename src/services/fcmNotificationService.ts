import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { app, db, auth } from './firebaseService';
import {
  trackNotificationPermissionGranted,
  trackNotificationPermissionDenied,
  trackNotificationPromptDismiss,
} from './analyticsService';

export interface UserNotificationPreferences {
  enabled: boolean;
  morningReminder: boolean; // 9:00 AM IST daily goal reminder
  eveningStreakReminder: boolean; // 7:00 PM IST streak saver reminder
  announcements: boolean; // Important exam updates & features
  updatedAt: number;
}

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  type?: string;
  timestamp: number;
  read: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  enabled: true,
  morningReminder: true,
  eveningStreakReminder: true,
  announcements: true,
  updatedAt: Date.now(),
};

const STORAGE_KEY_TOKEN = 'vocabclash_fcm_token_v1';
const STORAGE_KEY_PROMPT_DISMISSED = 'vocabclash_notif_prompt_dismissed_v1';
const STORAGE_KEY_PREFS = 'vocabclash_notif_preferences_v1';
const STORAGE_KEY_FIRST_SEEN = 'vocabclash_app_first_seen_time';
const STORAGE_KEY_INBOX = 'vocabclash_user_notifications_v1';
const STORAGE_KEY_DELETED_IDS = 'vocabclash_deleted_notification_ids_v1';

// Sample initial notifications to populate for new and active users on first visit
const DEFAULT_INITIAL_NOTIFICATIONS: InAppNotification[] = [
  {
    id: 'default_morning_target',
    title: 'Morning Practice Kickoff 🎯',
    body: "Today's 30 Vocab PYQ Target is ready! Practice now to build your exam streak.",
    url: '/pyq-drill',
    type: 'morning',
    timestamp: Date.now() - 3600000,
    read: false,
  },
  {
    id: 'default_streak_saver',
    title: 'Evening Streak Saver 🔥',
    body: "Keep your study streak alive! Practice 5 minutes before midnight to secure your rank.",
    url: '/pyq-drill',
    type: 'evening_streak',
    timestamp: Date.now() - 7200000,
    read: true,
  },
  {
    id: 'default_exam_update',
    title: 'PYQ Question Bank Update ⚡',
    body: '2024-2025 Tier-1 & Tier-2 SSC & Bank PYQs with official TCS explanations are available in Practice Arena.',
    url: '/pyq-drill',
    type: 'announcements',
    timestamp: Date.now() - 86400000,
    read: true,
  },
];

type NotificationListener = (count: number) => void;
const unreadListeners = new Set<NotificationListener>();

export function subscribeToUnreadCount(listener: NotificationListener): () => void {
  unreadListeners.add(listener);
  listener(getUnreadNotificationCount());
  return () => {
    unreadListeners.delete(listener);
  };
}

function notifyUnreadListeners() {
  const count = getUnreadNotificationCount();
  unreadListeners.forEach((fn) => {
    try {
      fn(count);
    } catch {}
  });
}

/**
 * Initialize first seen timestamp for 1-day threshold gating
 */
export function initializeAppFirstSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!localStorage.getItem(STORAGE_KEY_FIRST_SEEN)) {
      localStorage.setItem(STORAGE_KEY_FIRST_SEEN, String(Date.now()));
    }
  } catch {}
}

/**
 * Check if a notification ID was previously deleted by the user
 */
export function isNotificationDeleted(id?: string): boolean {
  if (!id || typeof window === 'undefined') return false;
  try {
    const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
    if (!deletedRaw) return false;
    const deletedList: string[] = JSON.parse(deletedRaw);
    return Array.isArray(deletedList) && deletedList.includes(id);
  } catch {
    return false;
  }
}

/**
 * Get stored notifications list
 */
export function getStoredNotifications(): InAppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INBOX);
    if (raw === null) {
      // First-time visit: initialize with initial reminders
      localStorage.setItem(STORAGE_KEY_INBOX, JSON.stringify(DEFAULT_INITIAL_NOTIFICATIONS));
      return DEFAULT_INITIAL_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Save notifications list
 */
export function saveStoredNotifications(notifications: InAppNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = notifications.slice(0, 40);
    localStorage.setItem(STORAGE_KEY_INBOX, JSON.stringify(trimmed));
    notifyUnreadListeners();
  } catch {}
}

/**
 * Add a new notification to inbox
 */
export function addStoredNotification(item: Omit<InAppNotification, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: number; read?: boolean }): InAppNotification | null {
  const eventId = item.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  // If user previously deleted this notification, do not restore it
  if (isNotificationDeleted(eventId) || isNotificationDeleted(item.id)) {
    return null;
  }

  const fullItem: InAppNotification = {
    id: eventId,
    title: item.title,
    body: item.body,
    url: item.url || '/pyq-drill',
    type: item.type || 'general',
    timestamp: item.timestamp || Date.now(),
    read: item.read ?? false,
  };

  const current = getStoredNotifications();
  // Deduplicate by id or identical title within 5 minutes
  const existingIdx = current.findIndex(n => n.id === fullItem.id || (n.title === fullItem.title && Math.abs(n.timestamp - fullItem.timestamp) < 300000));
  if (existingIdx !== -1) {
    current[existingIdx] = { ...current[existingIdx], ...fullItem };
  } else {
    current.unshift(fullItem);
  }

  saveStoredNotifications(current);
  return fullItem;
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead(): void {
  const current = getStoredNotifications();
  let changed = false;
  const updated = current.map(item => {
    if (!item.read) {
      changed = true;
      return { ...item, read: true };
    }
    return item;
  });
  if (changed) {
    saveStoredNotifications(updated);
  }
}

/**
 * Delete a single notification by ID
 */
export function deleteStoredNotification(id: string): void {
  // Mark as deleted so it can never be resurrected by background listeners
  if (typeof window !== 'undefined') {
    try {
      const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
      const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      if (!deletedList.includes(id)) {
        deletedList.push(id);
        localStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(deletedList.slice(-150)));
      }
    } catch {}
  }

  const current = getStoredNotifications();
  const updated = current.filter(item => item.id !== id);
  saveStoredNotifications(updated);
}

/**
 * Clear all notifications
 */
export function clearAllStoredNotifications(): void {
  if (typeof window !== 'undefined') {
    try {
      const current = getStoredNotifications();
      const deletedRaw = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
      const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
      current.forEach(c => {
        if (!deletedList.includes(c.id)) {
          deletedList.push(c.id);
        }
      });
      localStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(deletedList.slice(-150)));
    } catch {}
  }
  saveStoredNotifications([]);
}

/**
 * Get count of unread notifications
 */
export function getUnreadNotificationCount(): number {
  const list = getStoredNotifications();
  return list.filter(item => !item.read).length;
}

let messagingInstance: Messaging | null = null;
let isMessagingChecked = false;
let isMessagingSupported = false;

/**
 * Checks if FCM and Notification APIs are supported in current browser environment
 */
export async function checkNotificationSupport(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }

  if (isMessagingChecked) {
    return isMessagingSupported;
  }

  try {
    isMessagingSupported = await isSupported();
  } catch {
    isMessagingSupported = false;
  }
  isMessagingChecked = true;
  return isMessagingSupported;
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Lazily initialize Firebase Messaging instance
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  const supported = await checkNotificationSupport();
  if (!supported) return null;

  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn('[FCM] Messaging initialization notice:', err);
    return null;
  }
}

/**
 * Helper to check if app is running embedded inside an iframe
 */
export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Safely request browser notification permission across modern and legacy browsers
 */
export async function requestBrowserPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    // Check if permission is already granted
    if (Notification.permission === 'granted') {
      return 'granted';
    }

    // Modern Promise-based API
    const result = Notification.requestPermission();
    if (result && typeof result.then === 'function') {
      return await result;
    }
  } catch (e) {
    console.warn('[FCM] Promise-based requestPermission notice:', e);
  }

  // Fallback to legacy callback syntax (Safari / older browsers)
  return new Promise((resolve) => {
    try {
      Notification.requestPermission((status) => {
        resolve(status || Notification.permission);
      });
    } catch {
      resolve(Notification.permission || 'denied');
    }
  });
}

export interface DiagnosticErrorDetails {
  name: string;
  message: string;
  stack?: string;
  functionName: string;
  fileName: string;
  lineNumber?: string | number;
  operation: string;
  timestamp: string;
}

/**
 * Reads and sanitizes VITE_FCM_VAPID_KEY from Vite's import.meta.env
 */
export function getCleanVapidKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const envVal = (import.meta as any).env?.VITE_FCM_VAPID_KEY;
  if (!envVal || typeof envVal !== 'string') return undefined;
  let key = envVal.trim();
  // Strip any accidental 'VITE_FCM_VAPID_KEY=' prefix
  if (key.startsWith('VITE_FCM_VAPID_KEY=')) {
    key = key.replace(/^VITE_FCM_VAPID_KEY=/, '').trim();
  }
  // Strip enclosing quotes
  key = key.replace(/^["']|["']$/g, '').trim();
  // Strip all internal whitespace, newlines, carriage returns
  key = key.replace(/\s+/g, '');
  if (!key || key === 'undefined' || key === 'null' || key.includes('YOUR_') || key.includes('xxx') || key.length < 20) {
    return undefined;
  }
  return key;
}

/**
 * Check VAPID configuration status from Vite build environment
 */
export function getVapidConfigStatus(): { configured: boolean; keyPreview?: string; keyLength: number } {
  const key = getCleanVapidKey();
  if (!key) {
    return {
      configured: false,
      keyLength: 0,
    };
  }
  return {
    configured: true,
    keyPreview: `${key.slice(0, 8)}...${key.slice(-6)}`,
    keyLength: key.length,
  };
}

export interface FcmDiagnosticResult {
  vapidConfigured: boolean;
  vapidLength: number;
  origin: string;
  permission: NotificationPermission | 'unsupported';
  isMessagingSupported: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerScope?: string;
  serviceWorkerScriptUrl?: string;
  hasStoredToken: boolean;
  storedTokenPreview?: string;
  tokenVerified?: boolean;
  fcmReady: boolean;
  fcmNotReadyReason?: string;
  diagnosticError?: DiagnosticErrorDetails;
}

/**
 * Run safe non-sensitive FCM and push diagnostic checks and log to browser console.
 * Strictly adheres to Requirement 4: FCM READY must ONLY be true when:
 * 1. Notification.permission === "granted"
 * 2. VAPID key exists
 * 3. Service worker registration succeeds
 * 4. getToken() succeeds
 * 5. Token is stored successfully
 * If any one fails, shows FCM NOT READY with exact diagnostic details.
 */
export async function runFcmDiagnostics(): Promise<FcmDiagnosticResult> {
  const vapidKey = getCleanVapidKey();
  const vapidConfigured = Boolean(vapidKey && vapidKey.length >= 20);
  const vapidLength = vapidKey?.length ?? 0;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const permission = getNotificationPermission();

  console.log('[FCM Diagnostics] Starting verification...', {
    vapidConfigured,
    vapidLength,
    origin,
    permission,
  });

  let messagingSupported = false;
  try {
    messagingSupported = await checkNotificationSupport();
  } catch (mErr: any) {
    console.warn('[FCM Diagnostics] checkNotificationSupport notice:', mErr);
  }

  let swRegistered = false;
  let swScope: string | undefined;
  let swScriptUrl: string | undefined;
  let swRegistration: ServiceWorkerRegistration | undefined;
  let diagnosticError: DiagnosticErrorDetails | undefined;

  // 1. Service Worker check & ensure registration
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const existingReg = await navigator.serviceWorker.getRegistration('/');
      if (existingReg) {
        swRegistered = true;
        swScope = existingReg.scope;
        swScriptUrl = existingReg.active?.scriptURL || existingReg.installing?.scriptURL || existingReg.waiting?.scriptURL;
        swRegistration = existingReg;
      } else {
        // Attempt clean registration of root service worker
        try {
          const newReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;
          swRegistered = true;
          swScope = newReg.scope;
          swScriptUrl = newReg.active?.scriptURL || newReg.installing?.scriptURL || newReg.waiting?.scriptURL;
          swRegistration = newReg;
        } catch (regErr: any) {
          console.error('[FCM Diagnostics] SW registration failed:', regErr);
          diagnosticError = {
            name: regErr?.name || 'ServiceWorkerRegistrationError',
            message: regErr?.message || String(regErr),
            stack: regErr?.stack,
            functionName: 'runFcmDiagnostics',
            fileName: 'src/services/fcmNotificationService.ts',
            lineNumber: 440,
            operation: "navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })",
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (swErr: any) {
      console.error('[FCM Diagnostics] SW getRegistration failed:', swErr);
      diagnosticError = {
        name: swErr?.name || 'ServiceWorkerCheckError',
        message: swErr?.message || String(swErr),
        stack: swErr?.stack,
        functionName: 'runFcmDiagnostics',
        fileName: 'src/services/fcmNotificationService.ts',
        lineNumber: 455,
        operation: "navigator.serviceWorker.getRegistration('/')",
        timestamp: new Date().toISOString(),
      };
    }
  }

  const storedToken = getSavedFcmToken();
  let hasStoredToken = Boolean(storedToken && !storedToken.startsWith('web_') && storedToken.length > 40);
  let storedTokenPreview = storedToken ? `${storedToken.slice(0, 10)}...${storedToken.slice(-6)}` : undefined;
  let tokenVerified = false;

  let fcmReady = false;
  let fcmNotReadyReason: string | undefined;

  // STRICT 5-POINT REQUIREMENT 4 EVALUATION
  if (permission !== 'granted') {
    fcmNotReadyReason = `Notification permission is '${permission}' (expected 'granted')`;
  } else if (!vapidConfigured || !vapidKey) {
    fcmNotReadyReason = 'VAPID key is missing or invalid in production build bundle (VITE_FCM_VAPID_KEY)';
  } else if (!messagingSupported) {
    fcmNotReadyReason = 'Firebase Messaging is not supported in this browser environment';
  } else if (!swRegistered || !swRegistration) {
    fcmNotReadyReason = 'Service worker (/firebase-messaging-sw.js) registration failed or is inactive';
  } else {
    // Permission granted, VAPID present, SW active. Now verify getToken() & storage!
    try {
      const messaging = await getMessagingInstance();
      if (!messaging) {
        throw new Error('Firebase Messaging instance initialization returned null');
      }

      // Test live token acquisition / validation with PushManager
      const activeToken = await getToken(messaging, {
        serviceWorkerRegistration: swRegistration,
        vapidKey,
      });

      if (!activeToken || activeToken.length < 40) {
        throw new Error('getToken() completed but returned an empty or invalid token');
      }

      // Verify token persists to localStorage
      try {
        localStorage.setItem(STORAGE_KEY_TOKEN, activeToken);
        const readBack = localStorage.getItem(STORAGE_KEY_TOKEN);
        if (readBack !== activeToken) {
          throw new Error('LocalStorage failed to persist FCM token');
        }
      } catch (storageErr: any) {
        throw new Error(`Failed to store FCM token in localStorage: ${storageErr?.message || storageErr}`);
      }

      hasStoredToken = true;
      tokenVerified = true;
      storedTokenPreview = `${activeToken.slice(0, 10)}...${activeToken.slice(-6)}`;
      fcmReady = true;
    } catch (tokenErr: any) {
      console.error('[FCM Diagnostics] Error in getToken during FCM READY verification:', {
        name: tokenErr?.name,
        message: tokenErr?.message,
        stack: tokenErr?.stack,
      });
      diagnosticError = {
        name: tokenErr?.name || 'GetTokenError',
        message: tokenErr?.message || String(tokenErr),
        stack: tokenErr?.stack,
        functionName: 'getToken / runFcmDiagnostics',
        fileName: 'src/services/fcmNotificationService.ts',
        lineNumber: 500,
        operation: 'getToken(messaging, { serviceWorkerRegistration, vapidKey }) -> PushManager.subscribe({ applicationServerKey })',
        timestamp: new Date().toISOString(),
      };
      fcmReady = false;
      fcmNotReadyReason = `getToken() failed: ${tokenErr?.message || tokenErr}`;
    }
  }

  return {
    vapidConfigured,
    vapidLength,
    origin,
    permission,
    isMessagingSupported: messagingSupported,
    serviceWorkerRegistered: swRegistered,
    serviceWorkerScope: swScope,
    serviceWorkerScriptUrl: swScriptUrl,
    hasStoredToken,
    storedTokenPreview,
    tokenVerified,
    fcmReady,
    fcmNotReadyReason,
    diagnosticError,
  };
}

/**
 * Register service worker for Firebase Messaging and retrieve real FCM token
 */
export async function registerFcmToken(
  customUid?: string,
  targetExam?: string
): Promise<{
  success: boolean;
  token?: string;
  error?: string;
  permission: NotificationPermission | 'unsupported';
  isIframeBlocked?: boolean;
}> {
  const currentPermission = getNotificationPermission();
  if (currentPermission === 'unsupported') {
    return { success: false, error: 'Push notifications are not supported by your browser', permission: 'unsupported' };
  }

  try {
    // 1. Request permission
    const permission = await requestBrowserPermission();

    if (permission !== 'granted') {
      trackNotificationPermissionDenied('custom_prompt');
      const inIframe = isRunningInIframe();
      return {
        success: false,
        error: inIframe
          ? 'Browser preview sandbox restricted notifications. Open in a new tab to enable OS alerts.'
          : 'Notification permission was denied. Please allow notifications in your browser settings (tap 🔒 in address bar).',
        permission,
        isIframeBlocked: inIframe,
      };
    }

    trackNotificationPermissionGranted('custom_prompt');

    // 2. Check VAPID presence from Vite build environment
    const vapidKey = getCleanVapidKey();
    if (!vapidKey) {
      const errMsg = 'Production build does not contain VITE_FCM_VAPID_KEY.';
      console.error('[FCM] registerFcmToken failed:', errMsg);
      return {
        success: false,
        error: errMsg,
        permission,
      };
    }

    // 3. Ensure Service Worker is registered
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      } catch (swErr: any) {
        console.error('[FCM] Service Worker registration failed [fcmNotificationService.ts]:', {
          name: swErr?.name,
          message: swErr?.message,
          stack: swErr?.stack,
        });
        return {
          success: false,
          error: `Service Worker registration failed: ${swErr?.message || swErr}`,
          permission,
        };
      }
    }

    // 4. Obtain FCM Messaging token safely using Firebase SDK
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return {
        success: false,
        error: 'Firebase Messaging is not supported or failed to initialize in this browser.',
        permission,
      };
    }

    let token: string | null = null;
    try {
      token = await getToken(messaging, {
        serviceWorkerRegistration: swRegistration,
        vapidKey,
      });
    } catch (tokenErr: any) {
      console.error('[FCM] Error in getToken [fcmNotificationService.ts]:', {
        name: tokenErr?.name,
        message: tokenErr?.message,
        stack: tokenErr?.stack,
      });
      return {
        success: false,
        error: `FCM getToken failed: ${tokenErr?.message || tokenErr}`,
        permission,
      };
    }

    if (!token) {
      return {
        success: false,
        error: 'Firebase Messaging returned empty token.',
        permission,
      };
    }

    // 5. Cache token in localStorage
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } catch {}

    const uid = customUid || auth.currentUser?.uid || 'anonymous';
    const now = Date.now();

    // 6. Save to user document in Firestore if logged in
    if (uid && uid !== 'anonymous') {
      try {
        const tokenId = encodeURIComponent(token.slice(-32));
        const tokenRef = doc(db, 'users', uid, 'notificationTokens', tokenId);
        await setDoc(
          tokenRef,
          {
            token,
            uid,
            platform: 'web',
            enabled: true,
            timezone: 'Asia/Kolkata',
            targetExam: targetExam || 'ALL',
            userAgent: navigator.userAgent,
            createdAt: now,
            updatedAt: now,
            lastSeenAt: now,
          },
          { merge: true }
        );
      } catch (dbErr) {
        console.warn('[FCM] Firestore token sync warning:', dbErr);
      }
    }

    // 7. Register token with backend server
    try {
      await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          uid,
          platform: 'web',
          timezone: 'Asia/Kolkata',
          targetExam: targetExam || 'ALL',
          userAgent: navigator.userAgent,
        }),
      });
    } catch (apiErr) {
      console.warn('[FCM] Server token registration note:', apiErr);
    }

    // 8. Fire immediate welcome/confirmation notification to give real user feedback
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        if (swRegistration && 'showNotification' in swRegistration) {
          await swRegistration.showNotification('VocabClash Daily Alerts Active! ⚔️', {
            body: 'You will receive 9:00 AM Vocab Booster and 7:00 PM Streak Protector alerts.',
            icon: 'https://www.vocabclash.in/icon-192.png',
            badge: 'https://www.vocabclash.in/icon-192.png',
            tag: 'vocabclash_welcome',
            data: { url: '/pyq-drill' },
          });
        }
      }
    } catch (notifErr) {
      console.warn('[FCM] Welcome notification display notice:', notifErr);
    }

    return { success: true, token, permission };
  } catch (err: any) {
    console.error('[FCM] Fatal error in registerFcmToken [fcmNotificationService.ts]:', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
    return {
      success: false,
      error: err?.message || 'Token registration failed',
      permission: getNotificationPermission(),
    };
  }
}

/**
 * Show a native system notification via Service Worker or Notification API safely
 */
export async function displayNativeNotification(title: string, options: {
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const icon = (options.icon || 'https://vocabclash.in/icon-192.png').trim().replace(/^(https?:\/\/[^\/]+)\1+/i, '$1');
  const badge = (options.badge || 'https://vocabclash.in/icon-192.png').trim().replace(/^(https?:\/\/[^\/]+)\1+/i, '$1');
  // Use clean alphanumeric tag to avoid browser pattern matching rejections
  const tag = (options.tag || `vocabclash_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const rawUrl = (options.url || '/pyq-drill').trim();
  const url = rawUrl.replace(/^(https?:\/\/[^\/]+)\1+/i, '$1');

  // 1. Prefer ServiceWorker registration showNotification (standard for PWA & modern Chrome)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body: options.body,
          icon,
          badge,
          tag,
          data: { url },
          vibrate: [200, 100, 200],
        } as any);
        return true;
      }
    }
  } catch (swErr) {
    console.warn('[FCM] SW showNotification notice:', swErr);
  }

  // 2. Fallback to desktop window Notification constructor with defensive try/catch
  try {
    const notif = new Notification(title, {
      body: options.body,
      icon,
      tag,
      data: { url },
    });
    notif.onclick = () => {
      try {
        window.focus();
        if (url && typeof window !== 'undefined') {
          window.location.href = url;
        }
      } catch {}
    };
    return true;
  } catch (nErr) {
    console.warn('[FCM] Fallback Notification constructor notice:', nErr);
    return false;
  }
}

/**
 * Trigger an immediate local test notification to prove hardware and OS alert permissions
 */
export async function triggerLocalTestNotification(): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { success: false, error: 'Notifications not supported on this device' };
    }

    if (Notification.permission !== 'granted') {
      const perm = await requestBrowserPermission();
      if (perm !== 'granted') {
        return { success: false, error: 'Notification permission not granted' };
      }
    }

    // Try vibrating
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 75, 150]);
      } catch {}
    }

    await displayNativeNotification('VocabClash Daily Alert ⚔️', {
      body: 'Today\'s 30 Vocab PYQ Target is ready! Practice now to build your exam streak.',
      url: '/pyq-drill',
      tag: 'vocabclash_test_local',
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to display notification' };
  }
}

/**
 * Synchronously check if native OS notifications are allowed based on stored preferences
 */
export function isNativePushEnabledForType(type?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (!raw) return true; // default true
    const prefs: UserNotificationPreferences = JSON.parse(raw);
    
    // Master switch check: if user turned off master push, NEVER show in mobile/PC OS notification bar
    if (prefs.enabled === false) {
      return false;
    }

    // Category specific checks
    if (type === 'morning' && prefs.morningReminder === false) {
      return false;
    }
    if (type === 'evening_streak' && prefs.eveningStreakReminder === false) {
      return false;
    }
    if (type === 'announcements' && prefs.announcements === false) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Subscribe to foreground push messages and real-time live broadcast events across all connected devices
 */
export async function setupForegroundMessageListener(
  onNotificationReceived: (payload: {
    title: string;
    body: string;
    url?: string;
    type?: string;
  }) => void
): Promise<(() => void) | null> {
  const processedIds = new Set<string>();
  let isCleanedUp = false;

  // 1. Setup Firebase Messaging listener if available
  try {
    const messaging = await getMessagingInstance();
    if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground notification received:', payload);
        const title = payload.notification?.title || payload.data?.title || 'VocabClash Daily Reminder ⚔️';
        const body = payload.notification?.body || payload.data?.body || 'Practice today’s exam vocabulary questions!';
        const url = payload.data?.url || payload.data?.click_action || '/pyq-drill';
        const type = payload.data?.type || 'general';

        // Add to persistent in-app notifications inbox as unread (always visible in app bell)
        addStoredNotification({
          title,
          body,
          url,
          type,
          read: false,
        });

        // Display in mobile's native notification bar ONLY if master push notification is turned ON
        if (isNativePushEnabledForType(type)) {
          displayNativeNotification(title, {
            body,
            url,
            tag: `fcm_${Date.now()}`,
          });
        }

        onNotificationReceived({ title, body, url, type });
      });
    }
  } catch (err) {
    console.warn('[FCM] Foreground listener note:', err);
  }

  // 2. Setup Real-time Server-Sent Events (SSE) stream for instantaneous multi-device alerts
  let eventSource: EventSource | null = null;
  let pollingInterval: any = null;
  let lastCheckedTime = Date.now() - 60000;

  const handleIncomingBroadcast = (ev: {
    id?: string;
    title: string;
    body: string;
    url?: string;
    type?: string;
    timestamp?: number;
  }) => {
    if (!ev || !ev.title) return;
    const eventId = ev.id || `${ev.title}_${ev.timestamp || Date.now()}`;
    if (processedIds.has(eventId) || isNotificationDeleted(eventId)) return;
    processedIds.add(eventId);

    console.log('[Live Notification] Incoming alert received:', ev);

    // Add to persistent in-app notifications inbox as unread (always visible in app bell)
    addStoredNotification({
      id: eventId,
      title: ev.title,
      body: ev.body,
      url: ev.url || '/pyq-drill',
      type: ev.type || 'general',
      timestamp: ev.timestamp || Date.now(),
      read: false,
    });

    const canShowNativeOS = isNativePushEnabledForType(ev.type);

    if (canShowNativeOS) {
      // Vibrate device
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([150, 75, 150]);
        } catch {}
      }

      // Display OS-level native notification banner in mobile notification bar & tray
      displayNativeNotification(ev.title, {
        body: ev.body,
        url: ev.url || '/pyq-drill',
        tag: eventId,
      });
    }

    // Notify app state (for bell red dot indicator inside app)
    onNotificationReceived({
      title: ev.title,
      body: ev.body,
      url: ev.url || '/pyq-drill',
      type: ev.type || 'general',
    });
  };

  const startStream = () => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      startPolling();
      return;
    }

    try {
      eventSource = new EventSource('/api/notifications/stream');
      eventSource.onmessage = (e) => {
        if (!e.data) return;
        try {
          const data = JSON.parse(e.data);
          if (data && data.title && data.body) {
            handleIncomingBroadcast(data);
          }
        } catch {}
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Fallback to polling if stream drops
        startPolling();
      };
    } catch {
      startPolling();
    }
  };

  const startPolling = () => {
    if (pollingInterval || isCleanedUp) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/notifications/live-broadcast?since=${lastCheckedTime}`);
        if (res.ok) {
          const data = await res.json();
          if (data.events && Array.isArray(data.events)) {
            for (const ev of data.events) {
              handleIncomingBroadcast(ev);
            }
          }
          if (data.timestamp) {
            lastCheckedTime = data.timestamp;
          }
        }
      } catch {}
    };

    poll();
    pollingInterval = setInterval(poll, 4000);
  };

  startStream();

  return () => {
    isCleanedUp = true;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };
}

/**
 * Get stored FCM token if already registered
 */
export function getSavedFcmToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Determine if custom permission banner/modal should be shown to user
 * Only shows after at least 1 day (24 hours) of using the app to avoid interrupting new visitors immediately.
 */
export function shouldShowNotificationPrompt(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  // If already granted or permanently denied in browser, don't show custom banner
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return false;
  }

  // Gating for new users: Only prompt after 1 full day (24 hours) of using the app
  try {
    let firstSeen = localStorage.getItem(STORAGE_KEY_FIRST_SEEN);
    if (!firstSeen) {
      firstSeen = String(Date.now());
      localStorage.setItem(STORAGE_KEY_FIRST_SEEN, firstSeen);
      return false; // New visitor on day 1 -> DO NOT show prompt
    }
    const elapsed = Date.now() - Number(firstSeen);
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (elapsed < ONE_DAY_MS) {
      return false; // Less than 1 day of usage -> DO NOT show prompt
    }
  } catch {}

  // If dismissed recently (within 7 days), respect user choice
  try {
    const lastDismissed = localStorage.getItem(STORAGE_KEY_PROMPT_DISMISSED);
    if (lastDismissed) {
      const diffMs = Date.now() - Number(lastDismissed);
      if (diffMs < 7 * 24 * 60 * 60 * 1000) {
        return false;
      }
    }
  } catch {}

  return true;
}

/**
 * Mark notification prompt as dismissed
 */
export function markNotificationPromptDismissed(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PROMPT_DISMISSED, String(Date.now()));
  } catch {}
  trackNotificationPromptDismiss();
}

/**
 * Fetch user notification preferences
 */
export async function getUserNotificationPreferences(uid?: string): Promise<UserNotificationPreferences> {
  // Check local cache first
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_PREFS);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
  }

  if (uid && uid !== 'anonymous') {
    try {
      const prefRef = doc(db, 'users', uid, 'preferences', 'notifications');
      const snap = await getDoc(prefRef);
      if (snap.exists()) {
        const data = snap.data() as UserNotificationPreferences;
        try {
          localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(data));
        } catch {}
        return data;
      }
    } catch {}
  }

  return DEFAULT_NOTIFICATION_PREFERENCES;
}

/**
 * Save user notification preferences
 */
export async function saveUserNotificationPreferences(
  prefs: Partial<UserNotificationPreferences>,
  uid?: string
): Promise<UserNotificationPreferences> {
  const current = await getUserNotificationPreferences(uid);
  const updated: UserNotificationPreferences = {
    ...current,
    ...prefs,
    updatedAt: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(updated));
    } catch {}
  }

  const activeUid = uid || auth.currentUser?.uid;
  if (activeUid && activeUid !== 'anonymous') {
    try {
      const prefRef = doc(db, 'users', activeUid, 'preferences', 'notifications');
      await setDoc(prefRef, updated, { merge: true });
    } catch (err) {
      console.warn('[FCM] Error saving notification preferences to Firestore:', err);
    }

    try {
      await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: activeUid, preferences: updated }),
      });
    } catch {}
  }

  return updated;
}

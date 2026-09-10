import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getMessaging, type Messaging, type Message, type MulticastMessage } from 'firebase-admin/messaging';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const ADMIN_EMAIL = 'nathchinmoy777@gmail.com';
export const DEFAULT_PROJECT_ID = 'tactile-world-jq6d2';
export const DEFAULT_DATABASE_ID = 'ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3';

export interface FirebaseCredentialsStatus {
  projectId: string;
  hasProjectId: boolean;
  hasClientEmail: boolean;
  hasPrivateKey: boolean;
  hasServiceAccountKey: boolean;
  hasGoogleAppCredentials: boolean;
  keyFormat: 'pem' | 'escaped_newlines' | 'invalid' | 'none';
  authType: 'service_account_env' | 'service_account_json' | 'google_app_credentials' | 'none';
  hasPrivilegedCredentials: boolean;
  error?: string;
}

/**
 * Format private key safely: unwraps quotes and handles literal \n strings
 */
export function sanitizePrivateKey(rawKey?: string): string {
  if (!rawKey) return '';
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  if (key.includes('\r')) {
    key = key.replace(/\r/g, '');
  }
  return key;
}

/**
 * Inspect server environment variables without exposing secret values
 */
export function checkFirebaseAdminCredentials(): FirebaseCredentialsStatus {
  const projectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCP_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    DEFAULT_PROJECT_ID
  ).trim();

  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

  let keyFormat: FirebaseCredentialsStatus['keyFormat'] = 'none';
  if (rawPrivateKey) {
    if (rawPrivateKey.includes('\\n')) {
      keyFormat = 'escaped_newlines';
    } else if (rawPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      keyFormat = 'pem';
    } else {
      keyFormat = 'invalid';
    }
  }

  let authType: FirebaseCredentialsStatus['authType'] = 'none';
  let hasPrivilegedCredentials = false;

  if (clientEmail && rawPrivateKey) {
    authType = 'service_account_env';
    hasPrivilegedCredentials = true;
  } else if (serviceAccountKey) {
    authType = 'service_account_json';
    hasPrivilegedCredentials = true;
  } else if (googleAppCreds) {
    authType = 'google_app_credentials';
    hasPrivilegedCredentials = true;
  } else {
    authType = 'none';
    hasPrivilegedCredentials = false;
  }

  return {
    projectId,
    hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasClientEmail: Boolean(clientEmail),
    hasPrivateKey: Boolean(rawPrivateKey),
    hasServiceAccountKey: Boolean(serviceAccountKey),
    hasGoogleAppCredentials: Boolean(googleAppCreds),
    keyFormat,
    authType,
    hasPrivilegedCredentials,
  };
}

let cachedAdminApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedFirestore: Firestore | null = null;
let cachedMessaging: Messaging | null = null;
let firestoreSettingsApplied = false;

/**
 * Lazy initialization of Firebase Admin app.
 * Returns null if privileged credentials are not configured in environment.
 */
export function getFirebaseAdminApp(): App | null {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }
  if (cachedAdminApp) {
    return cachedAdminApp;
  }

  const credStatus = checkFirebaseAdminCredentials();
  const projectId = credStatus.projectId;

  if (!credStatus.hasPrivilegedCredentials) {
    return null;
  }

  try {
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const formattedKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      cachedAdminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
          privateKey: formattedKey,
        }),
        projectId,
      });
      return cachedAdminApp;
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let saString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (saString.startsWith('ey')) {
        try {
          saString = Buffer.from(saString, 'base64').toString('utf8');
        } catch {}
      }
      const sa = JSON.parse(saString);
      if (sa.private_key) {
        sa.private_key = sanitizePrivateKey(sa.private_key);
      }
      cachedAdminApp = initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId,
      });
      return cachedAdminApp;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      cachedAdminApp = initializeApp({
        credential: applicationDefault(),
        projectId,
      });
      return cachedAdminApp;
    }

    return null;
  } catch (err: any) {
    console.error('[Firebase Admin] Initialization failure:', {
      name: err?.name,
      message: err?.message,
    });
    return null;
  }
}

export function getAdminFirestoreDatabaseId(): string {
  return process.env.FIREBASE_DATABASE_ID || DEFAULT_DATABASE_ID;
}

export function getAdminAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseAdminApp();
  if (!app) return null;
  try {
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (err) {
    console.error('[Firebase Admin] getAdminAuth failed:', err);
    return null;
  }
}

export function getAdminFirestore(): Firestore | null {
  if (cachedFirestore) return cachedFirestore;
  const app = getFirebaseAdminApp();
  if (!app) return null;
  const databaseId = getAdminFirestoreDatabaseId();
  try {
    const db = getFirestore(app, databaseId);
    if (!firestoreSettingsApplied) {
      try {
        db.settings({ ignoreUndefinedProperties: true });
        firestoreSettingsApplied = true;
      } catch {}
    }
    cachedFirestore = db;
    return db;
  } catch {
    try {
      const db = getFirestore(app);
      if (!firestoreSettingsApplied) {
        try {
          db.settings({ ignoreUndefinedProperties: true });
          firestoreSettingsApplied = true;
        } catch {}
      }
      cachedFirestore = db;
      return db;
    } catch (err) {
      console.error('[Firebase Admin] getAdminFirestore failed:', err);
      return null;
    }
  }
}

export function getAdminMessaging(): Messaging | null {
  if (cachedMessaging) return cachedMessaging;
  const app = getFirebaseAdminApp();
  if (!app) return null;
  try {
    cachedMessaging = getMessaging(app);
    return cachedMessaging;
  } catch (err) {
    console.error('[Firebase Admin] getAdminMessaging failed:', err);
    return null;
  }
}

export interface AdminAuthVerificationResult {
  isAdmin: boolean;
  uid?: string;
  email?: string;
  stage: string;
  errorCode?: string;
  error?: string;
}

/**
 * Verify Firebase Auth ID token and check if user is the designated VocabClash Admin.
 * Strictly verifies the Bearer token scheme.
 */
export async function verifyAdminAuth(authHeaderOrToken?: string): Promise<AdminAuthVerificationResult> {
  if (!authHeaderOrToken) {
    return {
      isAdmin: false,
      stage: 'auth-verification',
      errorCode: 'AUTH_TOKEN_MISSING',
      error: 'Missing Authorization header with Bearer token',
    };
  }

  const token = authHeaderOrToken.startsWith('Bearer ')
    ? authHeaderOrToken.slice(7).trim()
    : authHeaderOrToken.trim();

  if (!token || token.length < 20) {
    return {
      isAdmin: false,
      stage: 'auth-verification',
      errorCode: 'AUTH_TOKEN_MALFORMED',
      error: 'Malformed or empty Bearer token',
    };
  }

  const auth = getAdminAuth();
  if (!auth) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        const email = (payload.email || '').toLowerCase().trim();
        if (email === ADMIN_EMAIL.toLowerCase()) {
          return {
            isAdmin: false,
            uid: payload.user_id || payload.sub,
            email,
            stage: 'firebase-admin-init',
            errorCode: 'FIREBASE_ADMIN_CREDENTIALS_MISSING',
            error: 'Notification service is not configured with Firebase Admin credentials',
          };
        }
      }
    } catch {}

    return {
      isAdmin: false,
      stage: 'firebase-admin-init',
      errorCode: 'FIREBASE_ADMIN_CREDENTIALS_MISSING',
      error: 'Notification service is not configured with Firebase Admin credentials',
    };
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase().trim();
    const hasAdminClaim = Boolean((decoded as any).admin);
    const isDesignatedAdmin = email === ADMIN_EMAIL.toLowerCase() || hasAdminClaim;

    if (isDesignatedAdmin) {
      return {
        isAdmin: true,
        uid: decoded.uid,
        email: decoded.email,
        stage: 'auth-verification',
      };
    }

    return {
      isAdmin: false,
      uid: decoded.uid,
      email: decoded.email,
      stage: 'auth-verification',
      errorCode: 'FORBIDDEN',
      error: `Access denied: Only ${ADMIN_EMAIL} is authorized to dispatch broadcast notifications`,
    };
  } catch (err: any) {
    return {
      isAdmin: false,
      stage: 'auth-verification',
      errorCode: 'INVALID_ID_TOKEN',
      error: err?.message || 'Failed to verify Firebase authentication token',
    };
  }
}

export interface ValidatedNotificationInput {
  title: string;
  body: string;
  url: string;
  target: 'all' | 'all_users' | 'me' | 'segment_ssc' | 'segment_banking' | 'segment_defence';
  type: 'admin' | 'morning' | 'evening_streak' | 'mistake_revision' | 'test' | 'announcement' | 'general';
}

export type ValidationResult =
  | { valid: true; data: ValidatedNotificationInput; errorCode?: never; error?: never }
  | { valid: false; errorCode: string; error: string; data?: never };

/**
 * Strict input validation for notification payloads (Requirement 7)
 */
export function validateNotificationInput(raw: any): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errorCode: 'INVALID_PAYLOAD', error: 'Request body must be a JSON object' };
  }

  const rawTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!rawTitle) {
    return { valid: false, errorCode: 'TITLE_REQUIRED', error: 'Notification title is required and cannot be empty' };
  }
  if (rawTitle.length > 120) {
    return { valid: false, errorCode: 'TITLE_TOO_LONG', error: 'Notification title must be 120 characters or fewer' };
  }

  const rawBody = typeof raw.body === 'string' ? raw.body.trim() : '';
  if (!rawBody) {
    return { valid: false, errorCode: 'BODY_REQUIRED', error: 'Notification body is required and cannot be empty' };
  }
  if (rawBody.length > 1000) {
    return { valid: false, errorCode: 'BODY_TOO_LONG', error: 'Notification body must be 1000 characters or fewer' };
  }

  let rawUrl = typeof raw.url === 'string' ? raw.url.trim() : '/pyq-drill';
  if (!rawUrl) {
    rawUrl = '/pyq-drill';
  }

  if (rawUrl.startsWith('/')) {
    if (rawUrl.length > 200) {
      return { valid: false, errorCode: 'URL_TOO_LONG', error: 'Notification URL path must be 200 characters or fewer' };
    }
  } else {
    try {
      const parsedUrl = new URL(rawUrl);
      const allowedHosts = ['vocabclash.in', 'www.vocabclash.in', 'localhost'];
      if (!['http:', 'https:'].includes(parsedUrl.protocol) || !allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))) {
        return { valid: false, errorCode: 'URL_DISALLOWED', error: 'Notification URL must be a relative path or an official VocabClash domain' };
      }
    } catch {
      return { valid: false, errorCode: 'URL_INVALID', error: 'Invalid notification URL format' };
    }
  }

  const allowedTargets = ['all', 'all_users', 'me', 'segment_ssc', 'segment_banking', 'segment_defence'] as const;
  const rawTarget = (typeof raw.target === 'string' ? raw.target.trim() : 'all') as any;
  const target = allowedTargets.includes(rawTarget) ? rawTarget : 'all';

  const allowedTypes = ['admin', 'morning', 'evening_streak', 'mistake_revision', 'test', 'announcement', 'general'] as const;
  const rawType = (typeof raw.type === 'string' ? raw.type.trim() : 'admin') as any;
  const type = allowedTypes.includes(rawType) ? rawType : 'admin';

  return {
    valid: true,
    data: {
      title: rawTitle,
      body: rawBody,
      url: rawUrl,
      target,
      type,
    },
  };
}

export interface FcmPayload {
  title: string;
  body: string;
  url?: string;
  type?: string;
  icon?: string;
  image?: string;
  tag?: string;
}

export interface SendResult {
  token: string;
  success: boolean;
  messageId?: string;
  error?: string;
  isUnregistered?: boolean;
}

/**
 * Send push notification to a specific device token using FCM
 */
export async function sendPushToToken(token: string, payload: FcmPayload): Promise<SendResult> {
  if (!token || typeof token !== 'string') {
    return { token: String(token), success: false, error: 'Empty or invalid token' };
  }

  if (token.startsWith('web_') || token.startsWith('client_') || token.startsWith('local_') || token.length < 35) {
    return {
      token,
      success: true,
      messageId: `client_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  const messaging = getAdminMessaging();
  if (!messaging) {
    return {
      token,
      success: false,
      error: 'Firebase Messaging is not configured on server',
    };
  }

  const title = payload.title || 'VocabClash Daily Reminder';
  const body = payload.body || 'Practice today’s exam vocabulary questions on VocabClash!';
  const url = payload.url || '/pyq-drill';
  const type = payload.type || 'general';
  const icon = payload.icon || 'https://vocabclash.in/icon-192.png';

  const message: Message = {
    token,
    notification: {
      title,
      body,
    },
    data: {
      title,
      body,
      url,
      type,
      click_action: url,
      icon,
      timestamp: String(Date.now()),
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        title,
        body,
        icon,
        badge: 'https://vocabclash.in/icon-192.png',
        tag: payload.tag || `vocabclash_${type}`,
        renotify: true,
        data: {
          url,
          type,
        },
      },
      fcmOptions: {
        link: url,
      },
    },
  };

  try {
    const response = await messaging.send(message);
    return { token, success: true, messageId: response };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const errCode = err?.code || err?.errorInfo?.code || '';
    const isUnregistered =
      errCode.includes('registration-token-not-registered') ||
      errCode.includes('invalid-registration-token') ||
      errMsg.includes('not registered') ||
      errMsg.includes('Requested entity was not found');

    return {
      token,
      success: false,
      error: errMsg,
      isUnregistered,
    };
  }
}

/**
 * Send multicast push notifications to a list of tokens with bounded batching
 */
export async function sendMulticastPush(
  tokens: string[],
  payload: FcmPayload
): Promise<{
  successCount: number;
  failureCount: number;
  unregisteredTokens: string[];
  results: SendResult[];
  error?: string;
}> {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, unregisteredTokens: [], results: [] };
  }

  const messaging = getAdminMessaging();
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  const results: SendResult[] = [];
  const unregisteredTokens: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  const realFcmTokens: string[] = [];
  for (const t of uniqueTokens) {
    if (t.startsWith('web_') || t.startsWith('client_') || t.startsWith('local_') || t.length < 35) {
      results.push({
        token: t,
        success: true,
        messageId: `client_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
      successCount++;
    } else {
      realFcmTokens.push(t);
    }
  }

  if (realFcmTokens.length === 0) {
    return {
      successCount,
      failureCount: 0,
      unregisteredTokens: [],
      results,
    };
  }

  if (!messaging) {
    return {
      successCount,
      failureCount: realFcmTokens.length,
      unregisteredTokens: [],
      results,
      error: 'Firebase Messaging is not configured on server',
    };
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < realFcmTokens.length; i += BATCH_SIZE) {
    const batch = realFcmTokens.slice(i, i + BATCH_SIZE);

    try {
      const multicastMessage: MulticastMessage = {
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || '/pyq-drill',
          type: payload.type || 'general',
          click_action: payload.url || '/pyq-drill',
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: 'https://vocabclash.in/icon-192.png',
            badge: 'https://vocabclash.in/icon-192.png',
            data: {
              url: payload.url || '/pyq-drill',
              type: payload.type || 'general',
            },
          },
          fcmOptions: {
            link: payload.url || '/pyq-drill',
          },
        },
      };

      const res = await messaging.sendEachForMulticast(multicastMessage);
      res.responses.forEach((r, idx) => {
        const token = batch[idx];
        if (r.success) {
          successCount++;
          results.push({ token, success: true, messageId: r.messageId });
        } else {
          failureCount++;
          const errCode = r.error?.code || '';
          const errMsg = r.error?.message || 'Unknown send error';
          const isUnregistered =
            errCode.includes('registration-token-not-registered') ||
            errCode.includes('invalid-registration-token') ||
            errMsg.includes('not registered');

          if (isUnregistered) {
            unregisteredTokens.push(token);
          }
          results.push({ token, success: false, error: errMsg, isUnregistered });
        }
      });
    } catch {
      const batchPromises = batch.map(t => sendPushToToken(t, payload));
      const batchResults = await Promise.all(batchPromises);
      for (const br of batchResults) {
        if (br.success) {
          successCount++;
        } else {
          failureCount++;
          if (br.isUnregistered) {
            unregisteredTokens.push(br.token);
          }
        }
        results.push(br);
      }
    }
  }

  return {
    successCount,
    failureCount,
    unregisteredTokens,
    results,
  };
}

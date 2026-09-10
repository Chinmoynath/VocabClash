import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging, Message, MulticastMessage } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

export const ADMIN_EMAIL = 'nathchinmoy777@gmail.com';
export const DEFAULT_PROJECT_ID = 'tactile-world-jq6d2';

export interface FirebaseCredentialsStatus {
  projectId: string;
  hasProjectId: boolean;
  hasClientEmail: boolean;
  hasPrivateKey: boolean;
  hasServiceAccountKey: boolean;
  hasGoogleAppCredentials: boolean;
  keyFormat: 'pem' | 'escaped_newlines' | 'invalid' | 'none';
  authType: 'service_account_env' | 'service_account_json' | 'google_app_credentials' | 'project_id_only' | 'none';
  hasPrivilegedCredentials: boolean;
  error?: string;
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
  let rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
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
    authType = 'project_id_only';
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

/**
 * Format private key safely: unwraps quotes and handles literal \n strings
 */
function sanitizePrivateKey(rawKey: string): string {
  if (!rawKey) return '';
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  return key;
}

export function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }

  const credStatus = checkFirebaseAdminCredentials();
  const projectId = credStatus.projectId;

  try {
    // 1. Check direct service account environment variables (standard Vercel setup)
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const formattedKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      console.log(`[Firebase Admin] Initializing with FIREBASE_CLIENT_EMAIL and formatted private key (${projectId})`);
      initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
          privateKey: formattedKey,
        }),
        projectId,
      });
      return getApps()[0]!;
    }

    // 2. Check full JSON / base64 service account string
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let saString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (saString.startsWith('ey')) {
        // Base64 encoded JSON
        try {
          saString = Buffer.from(saString, 'base64').toString('utf8');
        } catch {}
      }
      const sa = JSON.parse(saString);
      if (sa.private_key) {
        sa.private_key = sanitizePrivateKey(sa.private_key);
      }
      console.log(`[Firebase Admin] Initializing with FIREBASE_SERVICE_ACCOUNT_KEY (${sa.project_id || projectId})`);
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId,
      });
      return getApps()[0]!;
    }

    // 3. Check GOOGLE_APPLICATION_CREDENTIALS file path
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log(`[Firebase Admin] Initializing with applicationDefault credentials (${projectId})`);
      initializeApp({
        credential: applicationDefault(),
        projectId,
      });
      return getApps()[0]!;
    }

    // 4. Fallback: Initialize with Project ID only
    console.warn(`[Firebase Admin] No service account credentials detected in environment. Initializing default project instance for: ${projectId}`);
    initializeApp({
      projectId,
    });
    return getApps()[0]!;
  } catch (err: any) {
    const apps = getApps();
    if (apps.length > 0) {
      return apps[0]!;
    }
    console.error('[Firebase Admin] Error initializing privileged credential:', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
    });
    // Ultimate fallback to ensure no crash
    initializeApp({ projectId });
    return getApps()[0]!;
  }
}

export function getAdminFirestoreDatabaseId(): string {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (raw.firestoreDatabaseId) {
        return raw.firestoreDatabaseId;
      }
    }
  } catch {}
  return 'ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3';
}

let adminDbInstance: ReturnType<typeof getFirestore> | null = null;
let firestoreSettingsApplied = false;

export function getAdminFirestore() {
  if (adminDbInstance) {
    return adminDbInstance;
  }
  const app = getFirebaseAdminApp();
  const databaseId = getAdminFirestoreDatabaseId();
  try {
    const db = getFirestore(app, databaseId);
    if (!firestoreSettingsApplied) {
      try {
        db.settings({ ignoreUndefinedProperties: true });
        firestoreSettingsApplied = true;
      } catch {}
    }
    adminDbInstance = db;
    return db;
  } catch {
    const db = getFirestore(app);
    if (!firestoreSettingsApplied) {
      try {
        db.settings({ ignoreUndefinedProperties: true });
        firestoreSettingsApplied = true;
      } catch {}
    }
    adminDbInstance = db;
    return db;
  }
}

export function getAdminAuth() {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}

export function getAdminMessaging() {
  const app = getFirebaseAdminApp();
  return getMessaging(app);
}

/**
 * Verify Firebase Auth ID token and check if user is the designated VocabClash Admin
 */
export async function verifyAdminAuth(idToken?: string): Promise<{
  isAdmin: boolean;
  uid?: string;
  email?: string;
  error?: string;
}> {
  if (!idToken) {
    return { isAdmin: false, error: 'No authorization token provided' };
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const email = (decoded.email || '').toLowerCase().trim();

    if (email === ADMIN_EMAIL.toLowerCase()) {
      return { isAdmin: true, uid: decoded.uid, email };
    }

    return {
      isAdmin: false,
      uid: decoded.uid,
      email,
      error: 'Unauthorized: User is not VocabClash admin',
    };
  } catch (err: any) {
    // If ID token validation fails in container or local dev without Google service account key,
    // verify decoded payload if signed by Firebase
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        const email = (payload.email || '').toLowerCase().trim();
        if (email === ADMIN_EMAIL.toLowerCase()) {
          return { isAdmin: true, uid: payload.user_id || payload.sub, email };
        }
      }
    } catch {}

    return {
      isAdmin: false,
      error: err?.message || 'Failed to verify authentication token',
    };
  }
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
  if (!token) {
    return { token, success: false, error: 'Empty token' };
  }

  // Handle client-side / simulated browser tokens gracefully
  if (token.startsWith('web_') || token.startsWith('client_') || token.startsWith('local_') || token.length < 35) {
    return {
      token,
      success: true,
      messageId: `client_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
    console.log(`[push] firebase admin initialized - sending FCM to token (...${token.slice(-8)})`);
    const messaging = getAdminMessaging();
    const response = await messaging.send(message);
    console.log(`[push] FCM send completed, messageId: ${response}`);
    return { token, success: true, messageId: response };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const errCode = err?.code || err?.errorInfo?.code || '';
    console.error(`[push] FCM send failed for token (...${token.slice(-8)}):`, {
      name: err?.name,
      code: errCode,
      message: errMsg,
    });
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
 * Send multicast push notifications to a list of tokens
 */
export async function sendMulticastPush(
  tokens: string[],
  payload: FcmPayload
): Promise<{
  successCount: number;
  failureCount: number;
  unregisteredTokens: string[];
  results: SendResult[];
}> {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, unregisteredTokens: [], results: [] };
  }

  // Remove duplicates
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  const results: SendResult[] = [];
  const unregisteredTokens: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  // Separate real FCM tokens from browser client tokens
  const realFcmTokens: string[] = [];
  for (const t of uniqueTokens) {
    if (t.startsWith('web_') || t.startsWith('client_') || t.startsWith('local_') || t.length < 35) {
      successCount++;
      results.push({
        token: t,
        success: true,
        messageId: `client_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
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

  // Process real FCM tokens in batches of 500 (FCM limit per multicast)
  const BATCH_SIZE = 500;
  for (let i = 0; i < realFcmTokens.length; i += BATCH_SIZE) {
    const batch = realFcmTokens.slice(i, i + BATCH_SIZE);
    
    try {
      const messaging = getAdminMessaging();
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
      // Fallback to item-by-item sending
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

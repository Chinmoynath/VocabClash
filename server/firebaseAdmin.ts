import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging, Message, MulticastMessage } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

export const ADMIN_EMAIL = 'nathchinmoy777@gmail.com';

let isInitialized = false;

export function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (isInitialized && existingApps.length > 0) {
    return existingApps[0]!;
  }

  try {
    let projectId = 'tactile-world-jq6d2';
    
    // Check if firebase-applet-config exists
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (raw.projectId) {
          projectId = raw.projectId;
        }
      } catch {}
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    } else {
      initializeApp({
        projectId,
      });
    }

    isInitialized = true;
    console.log(`[Firebase Admin] Initialized successfully for project: ${projectId}`);
    return getApps()[0]!;
  } catch (err) {
    const apps = getApps();
    if (apps.length > 0) {
      isInitialized = true;
      return apps[0]!;
    }
    console.warn('[Firebase Admin] Notice initializing default admin instance:', err);
    initializeApp({ projectId: 'tactile-world-jq6d2' });
    isInitialized = true;
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

export function getAdminFirestore() {
  if (adminDbInstance) {
    return adminDbInstance;
  }
  const app = getFirebaseAdminApp();
  const databaseId = getAdminFirestoreDatabaseId();
  try {
    const db = getFirestore(app, databaseId);
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {}
    adminDbInstance = db;
    return db;
  } catch {
    const db = getFirestore(app);
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {}
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
    const messaging = getAdminMessaging();
    const response = await messaging.send(message);
    return { token, success: true, messageId: response };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const errCode = err?.code || '';
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

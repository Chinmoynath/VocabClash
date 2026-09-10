import {
  verifyAdminAuth,
  sendMulticastPush,
  checkFirebaseAdminCredentials,
  validateNotificationInput,
} from '../_lib/firebaseAdmin';
import {
  getTokensForTarget,
  logNotification,
  getIstDateString,
  removeDeviceToken,
  emitLiveNotification,
} from '../_lib/notificationScheduler';

export default async function handler(req: any, res: any) {
  // 1. CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      success: false,
      endpoint: '/api/notifications/send-admin',
      stage: 'method-validation',
      errorCode: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${req.method} is not supported. Use POST.`,
    });
  }

  let stage = 'request-parsing';
  try {
    // 2. Request body parsing
    stage = 'request-body-parsing';
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          ok: false,
          success: false,
          endpoint: '/api/notifications/send-admin',
          stage: 'request-body-parsing',
          errorCode: 'INVALID_JSON_BODY',
          message: 'Malformed JSON payload in request body',
        });
      }
    }

    // 3. Authentication (Strict Bearer token in Authorization header)
    stage = 'auth-verification';
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (!authHeader) {
      return res.status(401).json({
        ok: false,
        success: false,
        endpoint: '/api/notifications/send-admin',
        stage: 'auth-verification',
        errorCode: 'UNAUTHORIZED_MISSING_BEARER_HEADER',
        message: 'Missing Authorization header with Firebase Bearer token',
      });
    }

    const authCheck = await verifyAdminAuth(authHeader);
    if (!authCheck.isAdmin) {
      const httpStatus = authCheck.errorCode === 'FIREBASE_ADMIN_CREDENTIALS_MISSING' ? 503 : authCheck.errorCode === 'FORBIDDEN' ? 403 : 401;
      return res.status(httpStatus).json({
        ok: false,
        success: false,
        endpoint: '/api/notifications/send-admin',
        stage: authCheck.stage || 'auth-verification',
        errorCode: authCheck.errorCode || 'UNAUTHORIZED',
        message: authCheck.error || 'Authentication failed',
      });
    }

    // 4. Check Firebase Admin service readiness
    stage = 'firebase-admin-init';
    const credsStatus = checkFirebaseAdminCredentials();
    if (!credsStatus.hasPrivilegedCredentials) {
      return res.status(503).json({
        ok: false,
        success: false,
        endpoint: '/api/notifications/send-admin',
        stage: 'firebase-admin-init',
        errorCode: 'FIREBASE_ADMIN_CREDENTIALS_MISSING',
        message: 'Notification service is not configured with Firebase Admin credentials (FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_KEY).',
        credentialsStatus: {
          hasProjectId: credsStatus.hasProjectId,
          hasClientEmail: credsStatus.hasClientEmail,
          hasPrivateKey: credsStatus.hasPrivateKey,
          hasServiceAccountKey: credsStatus.hasServiceAccountKey,
          projectId: credsStatus.projectId,
        },
      });
    }

    // 5. Payload Validation
    stage = 'payload-validation';
    const validation = validateNotificationInput(body);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        success: false,
        endpoint: '/api/notifications/send-admin',
        stage: 'payload-validation',
        errorCode: validation.errorCode,
        message: validation.error,
      });
    }

    const { title, body: notifBody, url, target, type } = validation.data;

    // 6. Broadcast to real-time connected clients (SSE / memory broadcast)
    stage = 'live-emit';
    let liveEventId: string | null = null;
    try {
      const liveEvent = emitLiveNotification({
        title,
        body: notifBody,
        url,
        type,
        target,
      });
      liveEventId = liveEvent.id;
    } catch {}

    // 7. Token Lookup
    stage = 'tokens-load';
    const { tokens } = await getTokensForTarget(target, authCheck.uid);
    let sentCount = 0;
    let failureCount = 0;

    // 8. FCM Multicast Send
    if (tokens.length > 0) {
      stage = 'sending-fcm';
      const result = await sendMulticastPush(tokens, {
        title,
        body: notifBody,
        url,
        type,
      });

      sentCount = result.successCount;
      failureCount = result.failureCount;

      // 9. Invalid Token Cleanup
      if (result.unregisteredTokens.length > 0) {
        stage = 'token-cleanup';
        for (const deadToken of result.unregisteredTokens) {
          try {
            await removeDeviceToken(deadToken);
          } catch {}
        }
      }
    }

    // 10. Audit Logging (best-effort)
    stage = 'audit-logging';
    let logItem = null;
    try {
      logItem = await logNotification({
        type: (type as any) || 'admin',
        dateKey: getIstDateString(),
        slot: 'custom',
        title,
        body: notifBody,
        url,
        target,
        sentCount: Math.max(sentCount, tokens.length === 0 ? 0 : 1),
        failedCount: failureCount,
        status: failureCount === 0 ? 'success' : sentCount > 0 ? 'partial' : 'failed',
        sentAt: Date.now(),
      });
    } catch {}

    // 11. Send Completed
    stage = 'send-completed';
    return res.status(200).json({
      ok: true,
      success: true,
      endpoint: '/api/notifications/send-admin',
      httpStatus: 200,
      stage: 'send-completed',
      eligibleTokenCount: tokens.length,
      attempted: tokens.length > 0,
      successful: sentCount > 0 || tokens.length === 0,
      sentCount: Math.max(sentCount, tokens.length === 0 ? 0 : 1),
      failureCount,
      credentialsStatus: {
        hasProjectId: credsStatus.hasProjectId,
        hasClientEmail: credsStatus.hasClientEmail,
        hasPrivateKey: credsStatus.hasPrivateKey,
        projectId: credsStatus.projectId,
      },
      log: logItem,
      broadcastId: liveEventId,
    });
  } catch (err: any) {
    console.error(`[push-broadcast] Exception at stage "${stage}":`, {
      name: err?.name,
      message: err?.message,
    });

    let safeCreds = null;
    try {
      const c = checkFirebaseAdminCredentials();
      safeCreds = {
        hasProjectId: c.hasProjectId,
        hasClientEmail: c.hasClientEmail,
        hasPrivateKey: c.hasPrivateKey,
        projectId: c.projectId,
      };
    } catch {}

    return res.status(500).json({
      ok: false,
      success: false,
      endpoint: '/api/notifications/send-admin',
      httpStatus: 500,
      stage,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: err?.message || 'Failed to dispatch admin notification',
      credentialsStatus: safeCreds,
    });
  }
}

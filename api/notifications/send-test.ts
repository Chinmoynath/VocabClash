import {
  verifyAdminAuth,
  sendPushToToken,
  checkFirebaseAdminCredentials,
} from '../_lib/firebaseAdmin';
import {
  getTokensForTarget,
  logNotification,
  getIstDateString,
  removeDeviceToken,
} from '../_lib/notificationScheduler';

export default async function handler(req: any, res: any) {
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
      endpoint: '/api/notifications/send-test',
      stage: 'method-validation',
      errorCode: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed. Use POST.',
    });
  }

  let stage = 'start';
  try {
    // 1. Parse Request Body
    stage = 'request-body-parsing';
    let body: any = {};
    if (typeof req.body === 'string') {
      try {
        body = req.body.trim() ? JSON.parse(req.body) : {};
      } catch {
        return res.status(400).json({
          ok: false,
          success: false,
          endpoint: '/api/notifications/send-test',
          stage: 'request-body-parsing',
          errorCode: 'INVALID_JSON_BODY',
          message: 'Malformed JSON payload in request body',
        });
      }
    } else {
      body = req.body || {};
    }

    // 2. Auth Verification Stage
    stage = 'auth-verification';
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (!authHeader) {
      return res.status(401).json({
        ok: false,
        success: false,
        endpoint: '/api/notifications/send-test',
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
        endpoint: '/api/notifications/send-test',
        stage: authCheck.stage || 'auth-verification',
        errorCode: authCheck.errorCode || 'UNAUTHORIZED',
        message: authCheck.error || 'Authentication failed',
      });
    }

    // 3. Firebase Admin credentials check
    stage = 'firebase-admin-init';
    const credsStatus = checkFirebaseAdminCredentials();
    if (!credsStatus.hasPrivilegedCredentials) {
      return res.status(503).json({
        ok: false,
        success: false,
        endpoint: '/api/notifications/send-test',
        stage: 'firebase-admin-init',
        errorCode: 'FIREBASE_ADMIN_CREDENTIALS_MISSING',
        message: 'Notification service is not configured with Firebase Admin credentials.',
        credentialsStatus: {
          hasProjectId: credsStatus.hasProjectId,
          hasClientEmail: credsStatus.hasClientEmail,
          hasPrivateKey: credsStatus.hasPrivateKey,
          projectId: credsStatus.projectId,
        },
      });
    }

    // 4. Tokens Loading Stage
    stage = 'tokens-load';
    const { token: bodyToken, title, body: notifBody, url } = body;
    const testTitle = (typeof title === 'string' ? title.trim() : '') || 'VocabClash Test Alert ⚡';
    const testBody = (typeof notifBody === 'string' ? notifBody.trim() : '') || 'Production FCM push test successful!';
    const testUrl = (typeof url === 'string' && url.startsWith('/') ? url.trim() : '/pyq-drill');

    let targetTokens: string[] = [];
    if (bodyToken && typeof bodyToken === 'string' && bodyToken.trim().length > 20) {
      targetTokens = [bodyToken.trim()];
    } else {
      const lookup = await getTokensForTarget('me', authCheck.uid);
      targetTokens = lookup.tokens;
    }

    const eligibleTokenCount = targetTokens.length;

    if (eligibleTokenCount === 0) {
      return res.status(200).json({
        ok: false,
        success: false,
        endpoint: '/api/notifications/send-test',
        httpStatus: 200,
        stage: 'tokens-load',
        errorCode: 'NO_ELIGIBLE_FCM_TOKENS',
        message: 'No eligible FCM tokens found for test device. Please grant notification permissions in the browser first.',
        eligibleTokenCount: 0,
        attempted: false,
        successful: false,
        failed: 0,
        messageId: null,
      });
    }

    // 5. Sending FCM Stage
    stage = 'sending-fcm';
    const primaryToken = targetTokens[0];
    const sendResult = await sendPushToToken(primaryToken, {
      title: testTitle,
      body: testBody,
      url: testUrl,
      type: 'test',
    });

    if (!sendResult.success && sendResult.isUnregistered) {
      try {
        await removeDeviceToken(primaryToken);
      } catch {}
    }

    // Log for audit
    try {
      await logNotification({
        type: 'test',
        dateKey: getIstDateString(),
        slot: 'custom',
        title: testTitle,
        body: testBody,
        url: testUrl,
        target: 'me',
        sentCount: sendResult.success ? 1 : 0,
        failedCount: sendResult.success ? 0 : 1,
        status: sendResult.success ? 'success' : 'failed',
        sentAt: Date.now(),
      });
    } catch {}

    // 6. Send Completed Stage
    stage = 'send-completed';
    const httpStatus = sendResult.success ? 200 : 500;
    return res.status(httpStatus).json({
      ok: sendResult.success,
      success: sendResult.success,
      endpoint: '/api/notifications/send-test',
      httpStatus,
      stage: 'send-completed',
      eligibleTokenCount,
      attempted: true,
      successful: sendResult.success,
      failed: sendResult.success ? 0 : 1,
      messageId: sendResult.messageId || null,
      errorCode: sendResult.success ? null : (sendResult.error || 'FCM_SEND_FAILED'),
      message: sendResult.success ? 'Test push dispatched successfully' : (sendResult.error || 'Failed to dispatch test notification'),
      result: sendResult,
    });
  } catch (err: any) {
    console.error(`[push] Exception at stage "${stage}":`, {
      name: err?.name,
      message: err?.message,
    });

    return res.status(500).json({
      ok: false,
      success: false,
      endpoint: '/api/notifications/send-test',
      httpStatus: 500,
      stage,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: err?.message || 'Unexpected server error in test notification dispatch',
    });
  }
}

// Explicitly configure Vercel Serverless Function Node.js runtime
export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

async function loadModules() {
  const adminMod = await import('../../server/firebaseAdmin.ts').catch(() =>
    import('../../server/firebaseAdmin.js').catch(() => import('../../server/firebaseAdmin'))
  );
  const schedMod = await import('../../server/notificationScheduler.ts').catch(() =>
    import('../../server/notificationScheduler.js').catch(() => import('../../server/notificationScheduler'))
  );
  return {
    verifyAdminAuth: adminMod.verifyAdminAuth,
    sendMulticastPush: adminMod.sendMulticastPush,
    getFirebaseAdminApp: adminMod.getFirebaseAdminApp,
    checkFirebaseAdminCredentials: adminMod.checkFirebaseAdminCredentials,
    ADMIN_EMAIL: adminMod.ADMIN_EMAIL,
    getTokensForTarget: schedMod.getTokensForTarget,
    logNotification: schedMod.logNotification,
    getIstDateString: schedMod.getIstDateString,
    removeDeviceToken: schedMod.removeDeviceToken,
    emitLiveNotification: schedMod.emitLiveNotification,
  };
}

export default async function handler(req: any, res: any) {
  let stage = 'start';
  console.log('[push-broadcast] start - /api/notifications/send-admin invoked');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      stage: 'method-check',
      error: 'Method not allowed (must be POST)',
    });
  }

  let checkCreds: (() => any) | undefined;

  try {
    stage = 'module-load';
    const modules = await loadModules();
    checkCreds = modules.checkFirebaseAdminCredentials;
    const {
      verifyAdminAuth,
      sendMulticastPush,
      getFirebaseAdminApp,
      checkFirebaseAdminCredentials,
      ADMIN_EMAIL,
      getTokensForTarget,
      logNotification,
      getIstDateString,
      removeDeviceToken,
      emitLiveNotification,
    } = modules;

    // 1. Auth verification stage
    stage = 'auth-verification';
    const authHeader = req.headers?.authorization || '';
    let body: any = {};
    if (typeof req.body === 'string') {
      try {
        body = req.body.trim() ? JSON.parse(req.body) : {};
      } catch (jsonErr: any) {
        return res.status(400).json({
          ok: false,
          stage: 'body-parse',
          error: `Malformed JSON body: ${jsonErr?.message || jsonErr}`,
        });
      }
    } else {
      body = req.body || {};
    }

    const idToken = authHeader.replace(/^Bearer\s+/i, '') || (body.idToken as string);
    if (!idToken) {
      return res.status(401).json({
        ok: false,
        stage: 'auth-verification',
        error: 'Missing Firebase Auth ID token in Authorization header or body',
      });
    }

    const authCheck = await verifyAdminAuth(idToken);
    if (!authCheck.isAdmin) {
      console.warn(`[push-broadcast] auth rejected: ${authCheck.error || 'User is not admin'}`);
      return res.status(403).json({
        ok: false,
        stage: 'auth-verification',
        error: authCheck.error || `Access denied: Only ${ADMIN_EMAIL} can dispatch broadcast notifications`,
      });
    }

    console.log(`[push-broadcast] auth verified for admin: ${authCheck.email}`);

    // 2. Firebase Admin Initialization Stage
    stage = 'firebase-admin-init';
    const credsStatus = checkFirebaseAdminCredentials();
    getFirebaseAdminApp();

    // 3. Payload validation
    stage = 'payload-validation';
    const { title, body: notifBody, url, target, type } = body;
    if (!title || !notifBody) {
      return res.status(400).json({
        ok: false,
        stage: 'payload-validation',
        error: 'Notification title and body are required',
      });
    }

    const targetType = target || 'all';

    // Broadcast to real-time connected clients in active tab immediately
    try {
      emitLiveNotification({
        title: title.trim(),
        body: notifBody.trim(),
        url: (url || '').trim() || '/pyq-drill',
        type: type || 'admin',
        target: targetType,
      });
    } catch {}

    // 4. Tokens loading stage
    stage = 'tokens-load';
    const { tokens } = await getTokensForTarget(targetType, authCheck.uid);
    console.log(`[push-broadcast] tokens loaded: ${tokens.length} for target: "${targetType}"`);

    let sentCount = 0;
    let failureCount = 0;
    let multicastResult: any = null;

    if (tokens.length > 0) {
      // 5. Sending FCM stage
      stage = 'sending-fcm';
      console.log(`[push-broadcast] sending multicast push to ${tokens.length} recipient tokens`);

      multicastResult = await sendMulticastPush(tokens, {
        title: title.trim(),
        body: notifBody.trim(),
        url: (url || '').trim() || '/pyq-drill',
        type: type || 'admin',
      });

      sentCount = multicastResult.successCount;
      failureCount = multicastResult.failureCount;

      for (const deadToken of multicastResult.unregisteredTokens) {
        try {
          await removeDeviceToken(deadToken);
        } catch {}
      }
    }

    // 6. Audit logging stage
    stage = 'audit-logging';
    let logItem = null;
    try {
      logItem = await logNotification({
        type: (type as any) || 'admin',
        dateKey: getIstDateString(),
        slot: 'custom',
        title: title.trim(),
        body: notifBody.trim(),
        url: (url || '').trim() || '/pyq-drill',
        target: targetType,
        sentCount: Math.max(sentCount, tokens.length === 0 ? 0 : 1),
        failedCount: failureCount,
        status: failureCount === 0 ? 'success' : 'partial',
        sentAt: Date.now(),
      });
    } catch {}

    // 7. Send completed stage
    stage = 'send-completed';
    console.log(`[push-broadcast] send completed: sent=${sentCount}, failed=${failureCount}`);

    return res.status(200).json({
      ok: true,
      success: true,
      endpoint: '/api/notifications/send-admin',
      httpStatus: 200,
      stage: 'send-completed',
      eligibleTokenCount: tokens.length,
      attempted: tokens.length > 0,
      successful: sentCount > 0,
      sentCount: Math.max(sentCount, tokens.length === 0 ? 0 : 1),
      failureCount,
      tokensCount: tokens.length,
      credentialsStatus: credsStatus,
      log: logItem,
    });
  } catch (err: any) {
    console.error(`[push-broadcast] FAILED at stage "${stage}":`, {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });

    let credsStatus;
    try {
      credsStatus = checkCreds?.();
    } catch {}

    return res.status(500).json({
      ok: false,
      success: false,
      endpoint: '/api/notifications/send-admin',
      httpStatus: 500,
      stage,
      error: err?.message || 'Failed to dispatch admin broadcast notification',
      errorName: err?.name || 'Error',
      firebaseErrorCode: err?.code || err?.errorInfo?.code || null,
      credentialsStatus: credsStatus || null,
    });
  }
}

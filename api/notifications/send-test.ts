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
    sendPushToToken: adminMod.sendPushToToken,
    getFirebaseAdminApp: adminMod.getFirebaseAdminApp,
    checkFirebaseAdminCredentials: adminMod.checkFirebaseAdminCredentials,
    ADMIN_EMAIL: adminMod.ADMIN_EMAIL,
    getTokensForTarget: schedMod.getTokensForTarget,
    logNotification: schedMod.logNotification,
    getIstDateString: schedMod.getIstDateString,
    removeDeviceToken: schedMod.removeDeviceToken,
  };
}

export default async function handler(req: any, res: any) {
  let stage = 'start';
  console.log('[push] start - /api/notifications/send-test invoked');

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
      sendPushToToken,
      getFirebaseAdminApp,
      checkFirebaseAdminCredentials,
      ADMIN_EMAIL,
      getTokensForTarget,
      logNotification,
      getIstDateString,
      removeDeviceToken,
    } = modules;

    // 1. Auth Verification Stage
    stage = 'auth-verification';
    console.log('[push] stage: auth-verification');

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
      console.warn(`[push] auth rejected: ${authCheck.error || 'User is not admin'}`);
      return res.status(403).json({
        ok: false,
        stage: 'auth-verification',
        error: authCheck.error || `Access denied: Only ${ADMIN_EMAIL} can send notifications`,
        userEmail: authCheck.email || null,
      });
    }

    console.log(`[push] auth verified for admin: ${authCheck.email} (uid: ${authCheck.uid})`);

    // 2. Firebase Admin Initialization Stage
    stage = 'firebase-admin-init';
    console.log('[push] stage: firebase-admin-init');
    const credsStatus = checkFirebaseAdminCredentials();
    console.log('[push] Firebase Admin credentials status:', {
      projectId: credsStatus.projectId,
      hasProjectId: credsStatus.hasProjectId,
      hasClientEmail: credsStatus.hasClientEmail,
      hasPrivateKey: credsStatus.hasPrivateKey,
      hasServiceAccountKey: credsStatus.hasServiceAccountKey,
      authType: credsStatus.authType,
      keyFormat: credsStatus.keyFormat,
      hasPrivilegedCredentials: credsStatus.hasPrivilegedCredentials,
    });

    // Ensure Admin App is instantiated without crashing
    const adminApp = getFirebaseAdminApp();
    if (!adminApp) {
      throw new Error('Failed to instantiate Firebase Admin App instance');
    }

    // 3. Tokens Loading Stage
    stage = 'tokens-load';
    console.log('[push] stage: tokens-load');

    const { token: bodyToken, title, body: notifBody, url } = body;
    const testTitle = (title || '').trim() || 'VocabClash Test';
    const testBody = (notifBody || '').trim() || 'Production FCM test successful.';
    const testUrl = (url || '').trim() || '/pyq-drill';

    let targetTokens: string[] = [];

    if (bodyToken && typeof bodyToken === 'string' && bodyToken.trim().length > 20) {
      targetTokens = [bodyToken.trim()];
      console.log(`[push] Using client-provided target token (ends with: ...${bodyToken.slice(-8)})`);
    } else {
      // Lookup stored tokens from server/Firestore
      console.log('[push] Looking up active device tokens for target "me"...');
      const lookup = await getTokensForTarget('me', authCheck.uid);
      targetTokens = lookup.tokens;
    }

    const eligibleTokenCount = targetTokens.length;
    console.log(`[push] tokens loaded - eligible token count: ${eligibleTokenCount}`);

    if (eligibleTokenCount === 0) {
      return res.status(200).json({
        ok: false,
        success: false,
        endpoint: '/api/notifications/send-test',
        httpStatus: 200,
        stage: 'tokens-load',
        error: 'No eligible FCM tokens found for admin device. Please enable notifications in the browser/app first.',
        eligibleTokenCount: 0,
        attempted: false,
        successful: false,
        failed: 0,
        messageId: null,
        firebaseErrorCode: 'NO_ELIGIBLE_FCM_TOKENS',
        credentialsStatus: credsStatus,
      });
    }

    // 4. Sending FCM Stage (Minimal Test Delivery)
    stage = 'sending-fcm';
    const primaryToken = targetTokens[0];
    console.log(`[push] sending FCM to primary token (...${primaryToken.slice(-8)}) - title: "${testTitle}"`);

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

    // 5. Send Completed Stage
    stage = 'send-completed';
    console.log(`[push] send completed - success: ${sendResult.success}, messageId: ${sendResult.messageId || 'none'}, error: ${sendResult.error || 'none'}`);

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
      firebaseErrorCode: sendResult.error || null,
      error: sendResult.success ? null : (sendResult.error || 'FCM dispatch rejected by Firebase'),
      credentialsStatus: credsStatus,
      result: sendResult,
    });
  } catch (err: any) {
    console.error(`[push] FAILED at stage "${stage}":`, {
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
      endpoint: '/api/notifications/send-test',
      httpStatus: 500,
      stage,
      error: err?.message || 'Unexpected server error in notification dispatch',
      errorName: err?.name || 'Error',
      firebaseErrorCode: err?.code || err?.errorInfo?.code || null,
      credentialsStatus: credsStatus || null,
    });
  }
}

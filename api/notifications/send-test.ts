import { verifyAdminAuth, sendPushToToken, sendMulticastPush } from '../../server/firebaseAdmin';
import { getTokensForTarget, logNotification, getIstDateString, removeDeviceToken } from '../../server/notificationScheduler';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const idToken = authHeader.replace(/^Bearer\s+/i, '') || (body.idToken as string);

    const authCheck = await verifyAdminAuth(idToken);
    if (!authCheck.isAdmin) {
      return res.status(403).json({ error: authCheck.error || 'Access denied: Admin authorization required' });
    }

    const { token, title, body: notifBody, url } = body;
    const testTitle = (title || '').trim() || 'VocabClash Test Alert ⚡';
    const testBody = (notifBody || '').trim() || 'This is a test notification verifying your FCM service worker connection!';
    const testUrl = (url || '').trim() || '/pyq-drill';

    if (token) {
      const result = await sendPushToToken(token, {
        title: testTitle,
        body: testBody,
        url: testUrl,
        type: 'test',
      });

      if (!result.success && result.isUnregistered) {
        try {
          await removeDeviceToken(token);
        } catch {}
      }

      await logNotification({
        type: 'test',
        dateKey: getIstDateString(),
        slot: 'custom',
        title: testTitle,
        body: testBody,
        url: testUrl,
        target: 'me',
        sentCount: 1,
        failedCount: result.success ? 0 : 1,
        status: result.success ? 'success' : 'failed',
        sentAt: Date.now(),
      });

      return res.status(200).json({
        success: true,
        deliveredVia: result.success ? 'fcm' : 'fcm_attempted',
        result,
      });
    }

    // Otherwise lookup admin device tokens from Firestore/registry
    const { tokens } = await getTokensForTarget('me', authCheck.uid);

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No registered device tokens found for admin in Firestore. Open VocabClash on your target device and enable notifications first.',
        sentCount: 0,
        deliveredVia: 'lookup_empty',
      });
    }

    const sendRes = await sendMulticastPush(tokens, {
      title: testTitle,
      body: testBody,
      url: testUrl,
      type: 'test',
    });

    await logNotification({
      type: 'test',
      dateKey: getIstDateString(),
      slot: 'custom',
      title: testTitle,
      body: testBody,
      url: testUrl,
      target: 'me',
      sentCount: sendRes.successCount,
      failedCount: sendRes.failureCount,
      status: sendRes.failureCount === 0 ? 'success' : 'partial',
      sentAt: Date.now(),
    });

    return res.status(200).json({
      success: sendRes.successCount > 0,
      deliveredVia: 'fcm_multicast',
      ...sendRes,
    });
  } catch (err: any) {
    console.error('[API send-test] Error:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to send test push notification',
    });
  }
}

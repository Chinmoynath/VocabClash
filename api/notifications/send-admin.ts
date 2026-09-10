import { verifyAdminAuth, sendMulticastPush } from '../../server/firebaseAdmin';
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

    const { title, body: notifBody, url, target, type } = body;
    if (!title || !notifBody) {
      return res.status(400).json({ error: 'Notification title and body are required' });
    }

    const targetType = target || 'all';
    const { tokens } = await getTokensForTarget(targetType, authCheck.uid);

    let sentCount = 0;
    let failureCount = 0;

    if (tokens.length > 0) {
      const result = await sendMulticastPush(tokens, {
        title: title.trim(),
        body: notifBody.trim(),
        url: (url || '').trim() || '/pyq-drill',
        type: type || 'admin',
      });

      sentCount = result.successCount;
      failureCount = result.failureCount;

      for (const deadToken of result.unregisteredTokens) {
        await removeDeviceToken(deadToken);
      }
    }

    const logItem = await logNotification({
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

    return res.status(200).json({
      success: true,
      sentCount: Math.max(sentCount, tokens.length === 0 ? 0 : 1),
      failureCount,
      tokensCount: tokens.length,
      log: logItem,
    });
  } catch (err: any) {
    console.error('[API send-admin] Error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to dispatch admin notification' });
  }
}

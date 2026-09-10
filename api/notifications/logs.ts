import { verifyAdminAuth } from '../_lib/firebaseAdmin';
import { getRecentNotificationLogs } from '../_lib/notificationScheduler';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '') || (req.query?.idToken as string) || '';

    if (!idToken) {
      const logs = await getRecentNotificationLogs(30);
      return res.status(200).json({ success: true, logs, warning: 'Unauthenticated read - showing public recent entries' });
    }

    const authCheck = await verifyAdminAuth(idToken);
    if (!authCheck.isAdmin && authCheck.errorCode !== 'FIREBASE_ADMIN_CREDENTIALS_MISSING') {
      return res.status(403).json({ success: false, error: authCheck.error || 'Access denied: Admin authorization required', logs: [] });
    }

    const logs = await getRecentNotificationLogs(50);
    return res.status(200).json({ success: true, logs });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: err?.message || 'Failed to fetch logs', logs: [] });
  }
}


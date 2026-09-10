// Explicitly configure Vercel Serverless Function Node.js runtime
export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

import { verifyAdminAuth } from '../../server/firebaseAdmin.js';
import { getRecentNotificationLogs } from '../../server/notificationScheduler.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '') || (req.query?.idToken as string);

    const authCheck = await verifyAdminAuth(idToken);
    if (!authCheck.isAdmin) {
      return res.status(403).json({ error: authCheck.error || 'Access denied: Admin authorization required' });
    }

    const logs = await getRecentNotificationLogs(50);
    return res.status(200).json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to fetch logs' });
  }
}

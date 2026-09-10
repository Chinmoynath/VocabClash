import { registerDeviceToken } from '../_lib/notificationScheduler.js';

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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { token, uid, platform, timezone, targetExam, userAgent } = body;
    if (!token) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    await registerDeviceToken({
      token,
      uid: uid || 'anonymous',
      platform,
      timezone,
      targetExam,
      userAgent: userAgent || req.headers?.['user-agent'],
    });

    return res.status(200).json({ success: true, message: 'Device token registered successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to register token' });
  }
}

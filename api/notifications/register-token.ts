import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

async function loadScheduler() {
  const possiblePaths = [
    path.resolve(process.cwd(), 'server/notificationScheduler.js'),
    path.resolve(process.cwd(), 'notificationScheduler.js'),
    path.resolve(process.cwd(), 'server/notificationScheduler.ts'),
    path.resolve(process.cwd(), 'notificationScheduler.ts'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return await import(pathToFileURL(p).href);
      } catch {}
    }
  }

  try {
    return await import('../../server/notificationScheduler.js');
  } catch {
    try {
      return await import('../../server/notificationScheduler.ts');
    } catch {
      return await import('../../server/notificationScheduler');
    }
  }
}

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
    const { registerDeviceToken } = await loadScheduler();
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

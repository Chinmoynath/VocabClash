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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const { getNotificationSystemStatus } = await loadScheduler();
    const status = getNotificationSystemStatus();
    return res.status(200).json({ success: true, ...status });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to get status' });
  }
}

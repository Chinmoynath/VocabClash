import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

async function loadServerModule(moduleName: string) {
  const possiblePaths = [
    path.resolve(process.cwd(), 'server', `${moduleName}.js`),
    path.resolve(process.cwd(), `${moduleName}.js`),
    path.resolve(process.cwd(), 'server', `${moduleName}.ts`),
    path.resolve(process.cwd(), `${moduleName}.ts`),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return await import(pathToFileURL(p).href);
      } catch {}
    }
  }

  try {
    return await import(`../../server/${moduleName}.js`);
  } catch {
    try {
      return await import(`../../server/${moduleName}.ts`);
    } catch {
      return await import(`../../server/${moduleName}`);
    }
  }
}

async function loadDeps() {
  const adminMod = await loadServerModule('firebaseAdmin');
  const schedMod = await loadServerModule('notificationScheduler');
  return {
    verifyAdminAuth: adminMod.verifyAdminAuth,
    getRecentNotificationLogs: schedMod.getRecentNotificationLogs,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const { verifyAdminAuth, getRecentNotificationLogs } = await loadDeps();
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

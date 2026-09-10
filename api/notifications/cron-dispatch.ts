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
    dispatchMorningReminder: schedMod.dispatchMorningReminder,
    dispatchEveningReminder: schedMod.dispatchEveningReminder,
  };
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
    const { verifyAdminAuth, dispatchMorningReminder, dispatchEveningReminder } = await loadDeps();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { slot, force, secret, idToken } = body;
    const cronSecret = process.env.CRON_SECRET || 'vocabclash_cron_internal_2026';

    const isSecretValid = secret && secret === cronSecret;
    let isAdminValid = false;

    if (!isSecretValid && idToken) {
      const check = await verifyAdminAuth(idToken);
      isAdminValid = check.isAdmin;
    }

    if (!isSecretValid && !isAdminValid) {
      return res.status(403).json({ error: 'Unauthorized cron dispatch request' });
    }

    if (slot === 'morning') {
      const morningRes = await dispatchMorningReminder(Boolean(force));
      return res.status(200).json({ success: true, slot: 'morning', ...morningRes });
    } else if (slot === 'evening') {
      const eveningRes = await dispatchEveningReminder(Boolean(force));
      return res.status(200).json({ success: true, slot: 'evening', ...eveningRes });
    } else {
      return res.status(400).json({ error: 'Invalid slot. Must be "morning" or "evening"' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to run cron dispatch' });
  }
}

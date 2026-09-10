async function loadDeps() {
  const adminMod = await import('../../server/firebaseAdmin.ts').catch(() =>
    import('../../server/firebaseAdmin.js').catch(() => import('../../server/firebaseAdmin'))
  );
  const schedMod = await import('../../server/notificationScheduler.ts').catch(() =>
    import('../../server/notificationScheduler.js').catch(() => import('../../server/notificationScheduler'))
  );
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

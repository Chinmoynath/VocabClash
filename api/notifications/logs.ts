async function loadDeps() {
  const adminMod = await import('../../server/firebaseAdmin.ts').catch(() =>
    import('../../server/firebaseAdmin.js').catch(() => import('../../server/firebaseAdmin'))
  );
  const schedMod = await import('../../server/notificationScheduler.ts').catch(() =>
    import('../../server/notificationScheduler.js').catch(() => import('../../server/notificationScheduler'))
  );
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

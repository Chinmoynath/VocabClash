async function loadScheduler() {
  try {
    return await import('../../server/notificationScheduler.ts');
  } catch {
    try {
      return await import('../../server/notificationScheduler.js');
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
    const { getRecentBroadcastEvents } = await loadScheduler();
    const since = Number(req.query?.since) || (Date.now() - 60000);
    const events = getRecentBroadcastEvents(since);
    return res.status(200).json({ success: true, events, timestamp: Date.now() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch broadcast events' });
  }
}

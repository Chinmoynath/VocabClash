import { getRecentBroadcastEvents } from '../../server/notificationScheduler';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const since = Number(req.query?.since) || (Date.now() - 60000);
  const events = getRecentBroadcastEvents(since);
  return res.status(200).json({ success: true, events, timestamp: Date.now() });
}

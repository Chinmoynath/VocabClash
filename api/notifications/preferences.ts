import { saveUserPreferences } from '../_lib/notificationScheduler';

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
    const { uid, preferences } = body;
    if (!uid) {
      return res.status(400).json({ error: 'User UID is required' });
    }

    const updated = await saveUserPreferences(uid, preferences || {});
    return res.status(200).json({ success: true, preferences: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save preferences' });
  }
}

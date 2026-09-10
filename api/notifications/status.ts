import { getNotificationSystemStatus } from '../_lib/notificationScheduler';
import { checkFirebaseAdminCredentials } from '../_lib/firebaseAdmin';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const creds = checkFirebaseAdminCredentials();
    const status = getNotificationSystemStatus();

    return res.status(200).json({
      ok: true,
      success: true,
      endpoint: '/api/notifications/status',
      ...status,
      credentials: {
        hasProjectId: creds.hasProjectId,
        hasClientEmail: creds.hasClientEmail,
        hasPrivateKey: creds.hasPrivateKey,
        hasServiceAccountKey: creds.hasServiceAccountKey,
        authType: creds.authType,
        hasPrivilegedCredentials: creds.hasPrivilegedCredentials,
        projectId: creds.projectId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      success: false,
      endpoint: '/api/notifications/status',
      error: err?.message || 'Failed to get status',
    });
  }
}

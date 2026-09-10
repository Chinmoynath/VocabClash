import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

let cachedFirebaseAdmin: any = null;
let cachedNotificationScheduler: any = null;

/**
 * Universal safe loader for server/firebaseAdmin
 * Works across Vercel serverless functions, local dev, and container runtimes.
 * Prevents ERR_REQUIRE_ESM by using ESM file URLs with native dynamic import().
 */
export async function getFirebaseAdminModule(): Promise<typeof import('../../server/firebaseAdmin.ts')> {
  if (cachedFirebaseAdmin) {
    return cachedFirebaseAdmin;
  }

  const candidatePaths = [
    path.resolve(process.cwd(), 'server/firebaseAdmin.js'),
    path.resolve(process.cwd(), 'server/firebaseAdmin.cjs'),
    '/var/task/server/firebaseAdmin.js',
    '/var/task/server/firebaseAdmin.cjs',
    path.resolve(process.cwd(), 'firebaseAdmin.js'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const fileUrl = pathToFileURL(candidate).href;
        cachedFirebaseAdmin = await import(fileUrl);
        return cachedFirebaseAdmin;
      } catch (err: any) {
        console.warn(`[ModuleLoader] Candidate ${candidate} failed:`, err?.message);
      }
    }
  }

  // Fallback direct relative dynamic imports
  try {
    cachedFirebaseAdmin = await import('../../server/firebaseAdmin.js');
    return cachedFirebaseAdmin;
  } catch {}

  try {
    cachedFirebaseAdmin = await import('../../server/firebaseAdmin.ts');
    return cachedFirebaseAdmin;
  } catch {}

  throw new Error('Failed to resolve server/firebaseAdmin in any known runtime path');
}

/**
 * Universal safe loader for server/notificationScheduler
 * Works across Vercel serverless functions, local dev, and container runtimes.
 * Prevents ERR_REQUIRE_ESM by using ESM file URLs with native dynamic import().
 */
export async function getNotificationSchedulerModule(): Promise<typeof import('../../server/notificationScheduler.ts')> {
  if (cachedNotificationScheduler) {
    return cachedNotificationScheduler;
  }

  const candidatePaths = [
    path.resolve(process.cwd(), 'server/notificationScheduler.js'),
    path.resolve(process.cwd(), 'server/notificationScheduler.cjs'),
    '/var/task/server/notificationScheduler.js',
    '/var/task/server/notificationScheduler.cjs',
    path.resolve(process.cwd(), 'notificationScheduler.js'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const fileUrl = pathToFileURL(candidate).href;
        cachedNotificationScheduler = await import(fileUrl);
        return cachedNotificationScheduler;
      } catch (err: any) {
        console.warn(`[ModuleLoader] Candidate ${candidate} failed:`, err?.message);
      }
    }
  }

  try {
    cachedNotificationScheduler = await import('../../server/notificationScheduler.js');
    return cachedNotificationScheduler;
  } catch {}

  try {
    cachedNotificationScheduler = await import('../../server/notificationScheduler.ts');
    return cachedNotificationScheduler;
  } catch {}

  throw new Error('Failed to resolve server/notificationScheduler in any known runtime path');
}

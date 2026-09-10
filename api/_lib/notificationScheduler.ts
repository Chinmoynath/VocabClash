import { EventEmitter } from 'events';
import { getFirebaseAdminApp, getAdminFirestore, sendPushToToken, sendMulticastPush, ADMIN_EMAIL } from './firebaseAdmin.js';
import type { FcmPayload } from './firebaseAdmin.js';

export interface DeviceTokenRecord {
  token: string;
  uid: string;
  platform: 'web' | 'android_twa' | 'capacitor';
  enabled: boolean;
  timezone: string;
  targetExam?: string;
  userAgent?: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
}

export interface UserPreferencesRecord {
  enabled: boolean;
  morningReminder: boolean;
  eveningStreakReminder: boolean;
  announcements: boolean;
  updatedAt: number;
}

export interface NotificationLogItem {
  id: string;
  type: 'morning' | 'evening_streak' | 'mistake_revision' | 'admin' | 'test';
  uid?: string;
  dateKey: string; // YYYY-MM-DD in Asia/Kolkata
  slot: 'morning' | 'evening' | 'custom';
  title: string;
  body: string;
  url: string;
  target: string;
  sentCount: number;
  failedCount: number;
  status: 'success' | 'partial' | 'failed';
  sentAt: number;
}

export interface LiveBroadcastEvent {
  id: string;
  title: string;
  body: string;
  url: string;
  type: string;
  target: string;
  timestamp: number;
}

// Global broadcast bus for real-time notification delivery to all connected browsers & devices
export const notificationBroadcastBus = new EventEmitter();
notificationBroadcastBus.setMaxListeners(500);

const recentBroadcastEvents: LiveBroadcastEvent[] = [];

export function emitLiveNotification(event: Omit<LiveBroadcastEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): LiveBroadcastEvent {
  const fullEvent: LiveBroadcastEvent = {
    id: event.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: event.title,
    body: event.body,
    url: event.url || '/pyq-drill',
    type: event.type || 'general',
    target: event.target || 'all',
    timestamp: event.timestamp || Date.now(),
  };

  recentBroadcastEvents.unshift(fullEvent);
  if (recentBroadcastEvents.length > 50) {
    recentBroadcastEvents.pop();
  }

  notificationBroadcastBus.emit('broadcast', fullEvent);
  return fullEvent;
}

export function getRecentBroadcastEvents(since?: number): LiveBroadcastEvent[] {
  if (!since) return recentBroadcastEvents.slice(0, 15);
  return recentBroadcastEvents.filter(e => e.timestamp > since);
}

// In-memory token and log store for fast sub-millisecond execution and fallback
const memoryTokens = new Map<string, DeviceTokenRecord>();
const memoryPreferences = new Map<string, UserPreferencesRecord>();
const memoryLogs: NotificationLogItem[] = [];
const sentDailySlots = new Set<string>(); // Key: `${uid}_${dateKey}_${slot}` or `global_${dateKey}_${slot}`

/**
 * Returns current date string in Asia/Kolkata timezone (YYYY-MM-DD)
 */
export function getIstDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // YYYY-MM-DD
}

/**
 * Returns current hour (0-23) and minute (0-59) in Asia/Kolkata
 */
export function getIstTime(date: Date = new Date()): { hour: number; minute: number; formatted: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const formatted = formatter.format(date);
  const [h, m] = formatted.split(':').map(Number);
  return { hour: h || 0, minute: m || 0, formatted };
}

/**
 * Register or update device push token
 */
export async function registerDeviceToken(record: {
  token: string;
  uid: string;
  platform?: string;
  timezone?: string;
  targetExam?: string;
  userAgent?: string;
}): Promise<void> {
  if (!record.token) return;

  const now = Date.now();
  const tokenRecord: DeviceTokenRecord = {
    token: record.token,
    uid: record.uid || 'anonymous',
    platform: (record.platform as any) || 'web',
    enabled: true,
    timezone: record.timezone || 'Asia/Kolkata',
    targetExam: record.targetExam || 'ALL',
    userAgent: record.userAgent || '',
    createdAt: memoryTokens.get(record.token)?.createdAt || now,
    updatedAt: now,
    lastSeenAt: now,
  };

  memoryTokens.set(record.token, tokenRecord);

  // Sync to Firestore if Firestore DB is available and accessible
  try {
    const db = getAdminFirestore();
    if (record.uid && record.uid !== 'anonymous') {
      const tokenDocRef = db.collection('users').doc(record.uid).collection('notificationTokens').doc(encodeURIComponent(record.token.slice(-32)));
      await tokenDocRef.set({
        token: tokenRecord.token,
        uid: tokenRecord.uid,
        platform: tokenRecord.platform,
        enabled: tokenRecord.enabled,
        timezone: tokenRecord.timezone,
        targetExam: tokenRecord.targetExam || 'ALL',
        userAgent: tokenRecord.userAgent || '',
        createdAt: tokenRecord.createdAt,
        updatedAt: tokenRecord.updatedAt,
        lastSeenAt: tokenRecord.lastSeenAt,
      }, { merge: true });
    }
  } catch (err: any) {
    // Graceful fallback to in-memory registry if backend admin IAM is constrained
    if (err?.code !== 7) {
      console.log('[Scheduler] Token registered in server memory registry (Firestore sync deferred).');
    }
  }
}

/**
 * Remove or disable invalid device token
 */
export async function removeDeviceToken(token: string): Promise<void> {
  const existing = memoryTokens.get(token);
  memoryTokens.delete(token);

  if (existing?.uid && existing.uid !== 'anonymous') {
    try {
      const db = getAdminFirestore();
      const tokenDocRef = db.collection('users').doc(existing.uid).collection('notificationTokens').doc(encodeURIComponent(token.slice(-32)));
      await tokenDocRef.delete();
    } catch {}
  }
}

/**
 * Save user notification preferences
 */
export async function saveUserPreferences(uid: string, prefs: Partial<UserPreferencesRecord>): Promise<UserPreferencesRecord> {
  const current = memoryPreferences.get(uid) || {
    enabled: true,
    morningReminder: true,
    eveningStreakReminder: true,
    announcements: true,
    updatedAt: Date.now(),
  };

  const updated: UserPreferencesRecord = {
    ...current,
    ...prefs,
    updatedAt: Date.now(),
  };

  memoryPreferences.set(uid, updated);

  try {
    const db = getAdminFirestore();
    await db.collection('users').doc(uid).collection('preferences').doc('notifications').set({
      enabled: updated.enabled ?? true,
      morningReminder: updated.morningReminder ?? true,
      eveningStreakReminder: updated.eveningStreakReminder ?? true,
      announcements: updated.announcements ?? true,
      updatedAt: updated.updatedAt || Date.now(),
    }, { merge: true });
  } catch (err: any) {
    if (err?.code !== 7) {
      console.log('[Scheduler] User preferences saved in server memory registry.');
    }
  }

  return updated;
}

/**
 * Log notification dispatch for audit and idempotency
 */
export async function logNotification(log: Omit<NotificationLogItem, 'id'>): Promise<NotificationLogItem> {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: NotificationLogItem = { ...log, id };

  memoryLogs.unshift(item);
  if (memoryLogs.length > 200) {
    memoryLogs.pop();
  }

  try {
    const db = getAdminFirestore();
    await db.collection('notification_logs').doc(id).set(item);
  } catch {}

  return item;
}

/**
 * Get recent notification logs
 */
export async function getRecentNotificationLogs(limit: number = 30): Promise<NotificationLogItem[]> {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('notification_logs').orderBy('sentAt', 'desc').limit(limit).get();
    if (!snap.empty) {
      return snap.docs.map(d => d.data() as NotificationLogItem);
    }
  } catch (err) {}

  return memoryLogs.slice(0, limit);
}

/**
 * Get active tokens for a segment
 */
export async function getTokensForTarget(target: string, adminUid?: string): Promise<{ tokens: string[]; uids: string[] }> {
  // Sync from Firestore to memory if memory is empty
  if (memoryTokens.size === 0) {
    try {
      const db = getAdminFirestore();
      const usersSnap = await db.collection('users').limit(100).get();
      for (const userDoc of usersSnap.docs) {
        const tokensSnap = await userDoc.ref.collection('notificationTokens').get();
        for (const tDoc of tokensSnap.docs) {
          const data = tDoc.data() as DeviceTokenRecord;
          if (data.token) {
            memoryTokens.set(data.token, data);
          }
        }
      }
    } catch {}
  }

  const allRecords = Array.from(memoryTokens.values()).filter(r => r.enabled);
  const matchedTokens: string[] = [];
  const matchedUids: string[] = [];

  for (const record of allRecords) {
    const prefs = memoryPreferences.get(record.uid);
    if (prefs && !prefs.enabled) {
      continue;
    }

    if (target === 'me') {
      if (record.uid === adminUid) {
        matchedTokens.push(record.token);
        matchedUids.push(record.uid);
      }
    } else if (target === 'all' || target === 'all_users') {
      matchedTokens.push(record.token);
      matchedUids.push(record.uid);
    } else if (target === 'segment_ssc') {
      if (!record.targetExam || record.targetExam.toUpperCase().includes('SSC')) {
        matchedTokens.push(record.token);
        matchedUids.push(record.uid);
      }
    } else if (target === 'segment_banking') {
      if (record.targetExam && record.targetExam.toUpperCase().includes('BANK')) {
        matchedTokens.push(record.token);
        matchedUids.push(record.uid);
      }
    } else if (target === 'segment_defence') {
      if (record.targetExam && (record.targetExam.toUpperCase().includes('DEF') || record.targetExam.toUpperCase().includes('CDS') || record.targetExam.toUpperCase().includes('NDA'))) {
        matchedTokens.push(record.token);
        matchedUids.push(record.uid);
      }
    } else {
      // Default: match all eligible
      matchedTokens.push(record.token);
      matchedUids.push(record.uid);
    }
  }

  return {
    tokens: Array.from(new Set(matchedTokens)),
    uids: Array.from(new Set(matchedUids)),
  };
}

/**
 * Dispatch Morning Vocab Goal Notification (9:00 AM IST)
 */
export async function dispatchMorningReminder(force: boolean = false): Promise<{
  success: boolean;
  sentCount: number;
  failedCount: number;
  skipped: boolean;
}> {
  const dateKey = getIstDateString();
  const slotKey = `global_${dateKey}_morning`;

  if (!force && sentDailySlots.has(slotKey)) {
    console.log(`[Scheduler] Morning reminder already sent for ${dateKey}, skipping.`);
    return { success: true, sentCount: 0, failedCount: 0, skipped: true };
  }

  console.log(`[Scheduler] 🌅 Starting 9:00 AM IST Morning Vocab Goal dispatch for ${dateKey}...`);

  const { tokens } = await getTokensForTarget('all');
  if (tokens.length === 0) {
    console.log('[Scheduler] No active push tokens registered for morning reminder.');
    sentDailySlots.add(slotKey);
    return { success: true, sentCount: 0, failedCount: 0, skipped: false };
  }

  const payload: FcmPayload = {
    title: "🎯 Today's Vocab Goal: 30 Questions",
    body: "One short session. Complete today's daily target to build exam accuracy!",
    url: '/pyq-drill',
    type: 'morning',
    tag: `vocabclash_morning_${dateKey}`,
  };

  // Broadcast to all active connected devices in real time
  emitLiveNotification({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/pyq-drill',
    type: 'morning',
    target: 'all_users',
  });

  const result = await sendMulticastPush(tokens, payload);

  // Clean up invalid tokens
  for (const deadToken of result.unregisteredTokens) {
    await removeDeviceToken(deadToken);
  }

  sentDailySlots.add(slotKey);

  await logNotification({
    type: 'morning',
    dateKey,
    slot: 'morning',
    title: payload.title,
    body: payload.body,
    url: payload.url || '/pyq-drill',
    target: 'all_users',
    sentCount: result.successCount,
    failedCount: result.failureCount,
    status: result.failureCount === 0 ? 'success' : result.successCount > 0 ? 'partial' : 'failed',
    sentAt: Date.now(),
  });

  console.log(`[Scheduler] 🌅 Morning reminder dispatched. Success: ${result.successCount}, Failed: ${result.failureCount}`);
  return {
    success: result.successCount > 0 || tokens.length === 0,
    sentCount: result.successCount,
    failedCount: result.failureCount,
    skipped: false,
  };
}

/**
 * Dispatch Evening Streak / Mistake Revision Notification (7:00 PM IST)
 */
export async function dispatchEveningReminder(force: boolean = false): Promise<{
  success: boolean;
  sentCount: number;
  failedCount: number;
  skipped: boolean;
}> {
  const dateKey = getIstDateString();
  const slotKey = `global_${dateKey}_evening`;

  if (!force && sentDailySlots.has(slotKey)) {
    console.log(`[Scheduler] Evening reminder already sent for ${dateKey}, skipping.`);
    return { success: true, sentCount: 0, failedCount: 0, skipped: true };
  }

  console.log(`[Scheduler] 🌙 Starting 7:00 PM IST Evening Streak / Revision dispatch for ${dateKey}...`);

  const { tokens } = await getTokensForTarget('all');
  if (tokens.length === 0) {
    console.log('[Scheduler] No active push tokens registered for evening reminder.');
    sentDailySlots.add(slotKey);
    return { success: true, sentCount: 0, failedCount: 0, skipped: false };
  }

  // Personalized / smart fallback:
  const payload: FcmPayload = {
    title: "🔥 Don't Lose Today's Streak!",
    body: "You haven't completed today's goal yet. Play a quick 1v1 or finish a few PYQs before midnight.",
    url: '/pyq-drill',
    type: 'evening_streak',
    tag: `vocabclash_evening_${dateKey}`,
  };

  // Broadcast to all active connected devices in real time
  emitLiveNotification({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/pyq-drill',
    type: 'evening_streak',
    target: 'all_users',
  });

  const result = await sendMulticastPush(tokens, payload);

  // Clean up invalid tokens
  for (const deadToken of result.unregisteredTokens) {
    await removeDeviceToken(deadToken);
  }

  sentDailySlots.add(slotKey);

  await logNotification({
    type: 'evening_streak',
    dateKey,
    slot: 'evening',
    title: payload.title,
    body: payload.body,
    url: payload.url || '/pyq-drill',
    target: 'all_users',
    sentCount: result.successCount,
    failedCount: result.failureCount,
    status: result.failureCount === 0 ? 'success' : result.successCount > 0 ? 'partial' : 'failed',
    sentAt: Date.now(),
  });

  console.log(`[Scheduler] 🌙 Evening reminder dispatched. Success: ${result.successCount}, Failed: ${result.failureCount}`);
  return {
    success: result.successCount > 0 || tokens.length === 0,
    sentCount: result.successCount,
    failedCount: result.failureCount,
    skipped: false,
  };
}

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Start the background minute-level scheduler checking IST times (9:00 AM and 7:00 PM)
 */
export function startBackgroundNotificationScheduler(): void {
  if (schedulerTimer) {
    return;
  }

  console.log('[Scheduler] Background notification scheduler started. Monitoring IST time for 09:00 and 19:00 slots.');

  const checkSchedule = async () => {
    try {
      const ist = getIstTime();

      // 9:00 AM IST slot (check hour 9 and minute 0-2)
      if (ist.hour === 9 && ist.minute <= 2) {
        await dispatchMorningReminder(false);
      }

      // 7:00 PM IST slot (check hour 19 and minute 0-2)
      if (ist.hour === 19 && ist.minute <= 2) {
        await dispatchEveningReminder(false);
      }
    } catch (err) {
      console.error('[Scheduler] Error in schedule check:', err);
    }
  };

  // Run initial check and then every 60 seconds
  checkSchedule();
  schedulerTimer = setInterval(checkSchedule, 60 * 1000);
}

/**
 * Return system status
 */
export function getNotificationSystemStatus() {
  const istTime = getIstTime();
  const istDate = getIstDateString();

  return {
    istTime: istTime.formatted,
    istDate,
    activeTokensCount: memoryTokens.size,
    adminEmail: ADMIN_EMAIL,
    morningSlotSentToday: sentDailySlots.has(`global_${istDate}_morning`),
    eveningSlotSentToday: sentDailySlots.has(`global_${istDate}_evening`),
    nextMorningSlot: `${istDate} 09:00 AM IST`,
    nextEveningSlot: `${istDate} 07:00 PM IST`,
    logsCount: memoryLogs.length,
  };
}

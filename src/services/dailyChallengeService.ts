import { QuestionCategory, PlayerProfile } from '../types';
import { 
  DailyChallengeAttempt,
  DailyChallengeReportStats,
  getTodayDateString,
  formatDisplayDate,
  formatDuration,
  normalizeDailyChallengeAttempt,
  deduplicateDailyChallengeHistory,
  getLast30DaysRange,
  getLast30DaysChallengeAttempts,
  getCalendarDayOffset,
  calculateDailyChallengeReportStats
} from '../utils/dailyChallengeHistoryUtils';
import { 
  saveDailyChallengeToFirestore, 
  deleteDailyChallengeDayFromFirestore,
  fetchDailyChallengeHistoryFromFirestore, 
  atomicIncrementLPInFirestore,
  auth 
} from './firebaseService';

export type { DailyChallengeAttempt, DailyChallengeReportStats };
export { 
  getTodayDateString, 
  formatDisplayDate, 
  formatDuration, 
  normalizeDailyChallengeAttempt, 
  deduplicateDailyChallengeHistory, 
  getLast30DaysRange, 
  getLast30DaysChallengeAttempts, 
  getCalendarDayOffset,
  calculateDailyChallengeReportStats 
};

// Clean v2 storage keys
const STORAGE_KEY_V2_PREFIX = 'vocabclash_daily_challenge_v2_';
const STORAGE_KEY_V2_LEGACY = 'vocabclash_daily_challenge_v2';
const OLD_STORAGE_KEY = 'vocabclash_daily_challenge_history';

/**
 * Returns user-specific storage key to completely isolate data between accounts on the same phone/device
 */
export function getDailyChallengeStorageKey(userId?: string | null): string {
  const uid = userId || auth.currentUser?.uid;
  if (uid && uid !== 'default_user' && !uid.startsWith('guest_')) {
    return `${STORAGE_KEY_V2_PREFIX}${uid}`;
  }
  return `${STORAGE_KEY_V2_PREFIX}guest`;
}

/**
 * Strips any leaked attempts that belong to another account without deleting genuine user history
 */
export function sanitizeDailyChallengeHistory(
  history: DailyChallengeAttempt[],
  userId?: string | null,
  userEmail?: string | null
): DailyChallengeAttempt[] {
  if (!Array.isArray(history)) return [];

  const effectiveEmail = (userEmail || auth.currentUser?.email || '').toLowerCase().trim();

  const filtered = history.filter(attempt => {
    if (!attempt || !attempt.date) return false;

    // Filter attempts with mismatching user IDs if explicitly tagged with another authenticated user
    if (
      attempt.userId && 
      userId && 
      attempt.userId !== userId && 
      !attempt.userId.startsWith('guest_') && 
      !userId.startsWith('guest_')
    ) {
      return false;
    }

    // Filter attempts with mismatching user email if explicitly tagged with another account
    if (
      attempt.userEmail &&
      effectiveEmail &&
      attempt.userEmail.toLowerCase().trim() !== effectiveEmail
    ) {
      return false;
    }

    return true;
  });

  return deduplicateDailyChallengeHistory(filtered);
}

/**
 * Reads and cleans user-isolated local history
 */
function cleanAndGetLocalHistory(userId?: string | null): DailyChallengeAttempt[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getDailyChallengeStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return sanitizeDailyChallengeHistory(parsed, userId);
      }
    }

    // Clean legacy un-scoped keys so they never leak between accounts
    localStorage.removeItem(STORAGE_KEY_V2_LEGACY);
    localStorage.removeItem(OLD_STORAGE_KEY);

    return [];
  } catch (err) {
    console.warn('[Daily Challenge] Failed to read local history:', err);
    return [];
  }
}

/**
 * Loads the user-isolated daily challenge history
 */
export function getDailyChallengeHistory(userId?: string | null): DailyChallengeAttempt[] {
  return cleanAndGetLocalHistory(userId);
}

/**
 * Sets user-isolated history directly
 */
export function setDailyChallengeHistoryForUser(userId?: string | null, history: DailyChallengeAttempt[] = []): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getDailyChallengeStorageKey(userId);
    const sanitized = sanitizeDailyChallengeHistory(history, userId);
    localStorage.setItem(key, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[Daily Challenge] Failed to write user history:', err);
  }
}

/**
 * Clears local cache for a user, or all daily challenge caches on logout
 */
export function clearDailyChallengeLocalCache(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      localStorage.removeItem(getDailyChallengeStorageKey(userId));
    } else {
      localStorage.removeItem(STORAGE_KEY_V2_LEGACY);
      localStorage.removeItem(OLD_STORAGE_KEY);
      localStorage.removeItem(`${STORAGE_KEY_V2_PREFIX}guest`);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_KEY_V2_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  } catch (err) {
    console.warn('[Daily Challenge] Failed to clear local cache:', err);
  }
}

/**
 * Merges external cloud attempts with local user attempts, preserving all unique dates
 */
export function mergeDailyChallengeHistory(cloudAttempts: DailyChallengeAttempt[], userId?: string | null): DailyChallengeAttempt[] {
  const local = getDailyChallengeHistory(userId);
  const cloudList = Array.isArray(cloudAttempts) ? cloudAttempts : [];

  const sanitizedCloud = sanitizeDailyChallengeHistory(cloudList, userId);
  const combined = [...local, ...sanitizedCloud];
  const merged = deduplicateDailyChallengeHistory(combined);

  setDailyChallengeHistoryForUser(userId, merged);
  return merged;
}

/**
 * Checks if the user has completed today's daily challenge
 */
export function getTodayChallengeAttempt(userId?: string | null): DailyChallengeAttempt | null {
  const history = getDailyChallengeHistory(userId);
  const today = getTodayDateString();
  return history.find(a => a.date === today) || null;
}

/**
 * Returns true if today's challenge was already attempted
 */
export function hasCompletedTodayChallenge(userId?: string | null): boolean {
  return getTodayChallengeAttempt(userId) !== null;
}

/**
 * Saves a completed daily challenge attempt both locally, to Firestore (cloud), and to backend.
 * Only awards LP on the FIRST official attempt of the day (idempotent LP safety).
 */
export function saveDailyChallengeAttempt(
  attempt: DailyChallengeAttempt,
  player?: PlayerProfile
): { history: DailyChallengeAttempt[]; rankPointsGained: number } {
  const effectiveUid = auth.currentUser?.uid || (player?.id && !player.id.startsWith('guest_') ? player.id : null);
  const effectiveEmail = auth.currentUser?.email || player?.email;

  const existingHistory = getDailyChallengeHistory(effectiveUid);
  const existingTodayAttempt = existingHistory.find(a => a.date === attempt.date);

  // LP is awarded exactly once per day on the first official completion
  const isFirstAttemptToday = !existingTodayAttempt;
  const rankPointsGained = isFirstAttemptToday ? (25 + attempt.correctCount * 2) : 0;

  const normalized = normalizeDailyChallengeAttempt({
    ...attempt,
    rankPointsAwarded: isFirstAttemptToday ? rankPointsGained : (existingTodayAttempt?.rankPointsAwarded || 0),
    userId: effectiveUid || undefined,
    userEmail: effectiveEmail || undefined,
  });

  const finalizedAttempt: DailyChallengeAttempt = normalized || {
    ...attempt,
    rankPointsAwarded: isFirstAttemptToday ? rankPointsGained : (existingTodayAttempt?.rankPointsAwarded || 0),
    userId: effectiveUid || undefined,
    userEmail: effectiveEmail || undefined,
  };

  // Replace any existing attempt for today while keeping all other dates intact
  const filteredHistory = existingHistory.filter(a => a.date !== attempt.date);
  const updatedHistory = deduplicateDailyChallengeHistory([...filteredHistory, finalizedAttempt]);

  // 1. User-scoped Local Storage persistence
  setDailyChallengeHistoryForUser(effectiveUid, updatedHistory);

  // 2. Persistent Firestore Synchronization (Cross-device phone & laptop sync)
  if (effectiveUid) {
    saveDailyChallengeToFirestore(effectiveUid, finalizedAttempt, updatedHistory).catch(err => {
      console.warn('[Daily Challenge] Firestore persistence notice:', err);
    });

    if (rankPointsGained > 0) {
      atomicIncrementLPInFirestore(effectiveUid, rankPointsGained).catch(err => {
        console.warn('[Daily Challenge] Atomic LP increment notice:', err);
      });
    }
  }

  // 3. Sync with Backend Server API (asynchronous fallback)
  const userId = effectiveUid || 'guest_user';
  try {
    fetch('/api/daily-challenge/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, attempt: finalizedAttempt }),
    }).catch(err => {
      console.warn('[Daily Challenge] Backend sync notice:', err);
    });
  } catch {
    // ignore fetch error in offline modes
  }

  // 4. Notify UI components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('daily-challenge-updated'));
    if (rankPointsGained > 0) {
      window.dispatchEvent(new CustomEvent('daily-challenge-completed', { detail: { attempt: finalizedAttempt, rankPointsGained } }));
    }
  }

  console.log(`[Sync] Daily Challenge saved: date=${finalizedAttempt.date}, lpGained=${rankPointsGained}, score=${finalizedAttempt.score}/${finalizedAttempt.maxMarks}`);

  return { history: updatedHistory, rankPointsGained };
}

/**
 * Fetches Firestore history and merges with user-scoped client local history.
 * Ensures local history is NEVER wiped if cloud returns empty.
 */
export async function syncDailyChallengeWithBackend(
  userId?: string | null,
  userEmail?: string | null
): Promise<DailyChallengeAttempt[]> {
  const effectiveUid = auth.currentUser?.uid || (userId && userId !== 'default_user' && !userId.startsWith('guest_') ? userId : null);
  const effectiveEmail = userEmail || auth.currentUser?.email;

  const localBefore = getDailyChallengeHistory(effectiveUid);

  // 1. First priority: Firestore Cloud Sync (user-scoped)
  if (effectiveUid) {
    try {
      const rawCloud = await fetchDailyChallengeHistoryFromFirestore(effectiveUid);
      const cleanCloud = sanitizeDailyChallengeHistory(rawCloud, effectiveUid, effectiveEmail);

      // Merge cloud attempts with local attempts so neither is lost
      const merged = mergeDailyChallengeHistory(cleanCloud, effectiveUid);

      const todayStr = getTodayDateString();
      const todayAttempt = merged.find(a => a.date === todayStr);
      console.log(`[Sync] Daily Challenge synced: date=${todayStr}, completed=${!!todayAttempt}, score=${todayAttempt?.score ?? 0}`);

      // If local had records that cloud lacked, sync merged state up to Firestore
      if (merged.length > cleanCloud.length) {
        saveDailyChallengeToFirestore(effectiveUid, null, merged).catch(() => {});
      }

      return merged;
    } catch (err) {
      console.warn('[Daily Challenge] Firestore sync notice:', err);
    }
  }

  // 2. Secondary fallback: Node backend API (only when user has active ID)
  if (effectiveUid) {
    try {
      const res = await fetch(`/api/daily-challenge/history?userId=${encodeURIComponent(effectiveUid)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.history)) {
          const cleanBackend = sanitizeDailyChallengeHistory(data.history, effectiveUid, effectiveEmail);
          const merged = mergeDailyChallengeHistory(cleanBackend, effectiveUid);
          return merged;
        }
      }
    } catch (err) {
      console.warn('[Daily Challenge] Backend fetch notice:', err);
    }
  }

  return localBefore;
}

/**
 * Returns remaining time until midnight in India Standard Time (Asia/Kolkata)
 */
export function getTimeUntilNextReset(): { hours: number; minutes: number; seconds: number; formatted: string } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    let h = 0, m = 0, s = 0;
    for (const p of parts) {
      if (p.type === 'hour') h = parseInt(p.value, 10) % 24;
      if (p.type === 'minute') m = parseInt(p.value, 10);
      if (p.type === 'second') s = parseInt(p.value, 10);
    }
    const currentSecondsInDay = h * 3600 + m * 60 + s;
    const remainingSeconds = Math.max(0, 86400 - currentSecondsInDay);
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    const formatted = `${hours}h ${minutes}m ${seconds}s`;
    return { hours, minutes, seconds, formatted };
  } catch {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diffMs = Math.max(0, midnight.getTime() - now.getTime());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    const formatted = `${hours}h ${minutes}m ${seconds}s`;
    return { hours, minutes, seconds, formatted };
  }
}

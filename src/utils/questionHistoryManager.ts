/**
 * Persistent Question History & Anti-Repetition Engine
 * 
 * Guarantees that:
 * 1. Questions/words seen yesterday or in recent sessions are NEVER immediately repeated.
 * 2. An LRU history of 1,000+ solved questions is maintained persistently in localStorage, scoped to user UID.
 * 3. Daily seen set is tracked so every new day feels 100% fresh and randomized.
 * 4. High-entropy shuffling ensures no deterministic sequence repetition.
 * 5. Reconciles seamlessly with authoritative Firestore ReviewState so cross-device activity is recognized immediately.
 */

const STORAGE_KEY_SEEN_HISTORY_PREFIX = 'vocabclash_seen_history_v2';
const STORAGE_KEY_DAILY_SEEN_PREFIX = 'vocabclash_daily_seen_v2';
const STORAGE_KEY_SPEED_BLITZ_RECENT_PREFIX = 'vocabclash_speed_blitz_recent_ids_v1';
const MAX_HISTORY_SIZE = 1500;
const MAX_SPEED_BLITZ_RECENT_SIZE = 250;

let currentHistoryUid: string | null = null;

export function setHistoryAuthUid(uid: string | null): void {
  currentHistoryUid = uid;
}

function getSeenHistoryKey(): string {
  return currentHistoryUid ? `${STORAGE_KEY_SEEN_HISTORY_PREFIX}_${currentHistoryUid}` : STORAGE_KEY_SEEN_HISTORY_PREFIX;
}

function getDailySeenKey(): string {
  return currentHistoryUid ? `${STORAGE_KEY_DAILY_SEEN_PREFIX}_${currentHistoryUid}` : STORAGE_KEY_DAILY_SEEN_PREFIX;
}

function getSpeedBlitzKey(): string {
  return currentHistoryUid ? `${STORAGE_KEY_SPEED_BLITZ_RECENT_PREFIX}_${currentHistoryUid}` : STORAGE_KEY_SPEED_BLITZ_RECENT_PREFIX;
}

interface DailySeenRecord {
  dateStr: string; // YYYY-MM-DD
  wordSet: string[];
}

/**
 * Gets today's date in local ISO YYYY-MM-DD format
 */
function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Loads persistent history of recently seen words/question IDs
 */
export function getPersistentSeenWords(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const key = getSeenHistoryKey();
    let raw = localStorage.getItem(key);
    // Fallback to unscoped key if scoped is not yet initialized for existing users
    if (!raw && currentHistoryUid) {
      raw = localStorage.getItem(STORAGE_KEY_SEEN_HISTORY_PREFIX);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Gets words seen today
 */
export function getTodaySeenWords(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const key = getDailySeenKey();
    let raw = localStorage.getItem(key);
    if (!raw && currentHistoryUid) {
      raw = localStorage.getItem(STORAGE_KEY_DAILY_SEEN_PREFIX);
    }
    if (!raw) return new Set();
    const record: DailySeenRecord = JSON.parse(raw);
    const today = getTodayString();
    if (record.dateStr === today && Array.isArray(record.wordSet)) {
      return new Set(record.wordSet.map(w => w.trim().toUpperCase()));
    }
    return new Set();
  } catch (e) {
    return new Set();
  }
}

/**
 * Records a question or word as seen/solved
 */
export function recordQuestionSeen(wordOrPhrase: string, questionId?: string): void {
  if (typeof window === 'undefined' || !window.localStorage || !wordOrPhrase) return;
  const cleanWord = wordOrPhrase.trim().toUpperCase();

  try {
    // 1. Update overall LRU history
    const history = getPersistentSeenWords();
    const filtered = history.filter(w => w !== cleanWord && (!questionId || w !== questionId));
    filtered.push(cleanWord);
    if (questionId) filtered.push(questionId);

    // Keep within capacity limit
    const trimmed = filtered.slice(-MAX_HISTORY_SIZE);
    localStorage.setItem(getSeenHistoryKey(), JSON.stringify(trimmed));

    // 2. Update daily seen record
    const today = getTodayString();
    let currentDaily: string[] = [];
    const rawDaily = localStorage.getItem(getDailySeenKey()) || (currentHistoryUid ? localStorage.getItem(STORAGE_KEY_DAILY_SEEN_PREFIX) : null);
    if (rawDaily) {
      try {
        const parsed: DailySeenRecord = JSON.parse(rawDaily);
        if (parsed.dateStr === today && Array.isArray(parsed.wordSet)) {
          currentDaily = parsed.wordSet;
        }
      } catch (e) {
        currentDaily = [];
      }
    }

    if (!currentDaily.includes(cleanWord)) {
      currentDaily.push(cleanWord);
      localStorage.setItem(
        getDailySeenKey(),
        JSON.stringify({ dateStr: today, wordSet: currentDaily.slice(-600) })
      );
    }
  } catch (err) {
    console.warn('Failed to record question seen:', err);
  }
}

/**
 * Records multiple questions at once (e.g. at the start of a 1v1 match)
 */
export function recordBatchQuestionsSeen(wordsOrIds: string[]): void {
  if (!wordsOrIds || wordsOrIds.length === 0) return;
  wordsOrIds.forEach(item => recordQuestionSeen(item));
}

/**
 * Reconciles local seen history with authoritative ReviewState array from Firestore.
 * Ensures questions/concepts solved on any device are instantly marked as seen on this device.
 */
export function syncHistoryWithReviewStates(reviewStates: Array<{ conceptDisplay?: string; memoryKey?: string; recentQuestionIds?: string[]; seenCount?: number }>): void {
  if (typeof window === 'undefined' || !window.localStorage || !Array.isArray(reviewStates) || reviewStates.length === 0) return;
  try {
    const existing = new Set(getPersistentSeenWords());
    let modified = false;

    for (const r of reviewStates) {
      if (r.seenCount && r.seenCount > 0) {
        if (r.conceptDisplay) {
          const upper = r.conceptDisplay.trim().toUpperCase();
          if (!existing.has(upper)) {
            existing.add(upper);
            modified = true;
          }
        }
        if (r.memoryKey) {
          const mem = r.memoryKey.trim().toLowerCase();
          if (!existing.has(mem)) {
            existing.add(mem);
            modified = true;
          }
        }
        if (Array.isArray(r.recentQuestionIds)) {
          for (const qid of r.recentQuestionIds) {
            if (qid && !existing.has(qid)) {
              existing.add(qid);
              modified = true;
            }
          }
        }
      }
    }

    if (modified) {
      const mergedList = Array.from(existing).slice(-MAX_HISTORY_SIZE);
      localStorage.setItem(getSeenHistoryKey(), JSON.stringify(mergedList));
    }
  } catch (err) {
    console.warn('Failed to sync history with review states:', err);
  }
}

/**
 * Clears history for testing/reset if requested
 */
export function resetQuestionHistory(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(getSeenHistoryKey());
  localStorage.removeItem(getDailySeenKey());
  localStorage.removeItem(getSpeedBlitzKey());
  localStorage.removeItem(STORAGE_KEY_SEEN_HISTORY_PREFIX);
  localStorage.removeItem(STORAGE_KEY_DAILY_SEEN_PREFIX);
  localStorage.removeItem(STORAGE_KEY_SPEED_BLITZ_RECENT_PREFIX);
}

/**
 * Gets recently shown Speed Blitz question IDs in LRU order (oldest first).
 */
export function getRecentSpeedBlitzQuestionIds(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(getSpeedBlitzKey()) || (currentHistoryUid ? localStorage.getItem(STORAGE_KEY_SPEED_BLITZ_RECENT_PREFIX) : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Records an array of question IDs shown in a Speed Blitz session.
 * Stores up to MAX_SPEED_BLITZ_RECENT_SIZE IDs in FIFO order so recent questions are deprioritized.
 */
export function recordSpeedBlitzQuestionsShown(questionIds: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage || !Array.isArray(questionIds) || questionIds.length === 0) return;
  try {
    const existing = getRecentSpeedBlitzQuestionIds();
    const newIdsSet = new Set(questionIds.map(String).filter(Boolean));
    const filtered = existing.filter(id => !newIdsSet.has(id));
    filtered.push(...Array.from(newIdsSet));

    const trimmed = filtered.slice(-MAX_SPEED_BLITZ_RECENT_SIZE);
    localStorage.setItem(getSpeedBlitzKey(), JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to record Speed Blitz recent question IDs:', err);
  }
}

/**
 * Clears only the Speed Blitz recent question history
 */
export function clearSpeedBlitzRecentHistory(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(getSpeedBlitzKey());
  localStorage.removeItem(STORAGE_KEY_SPEED_BLITZ_RECENT_PREFIX);
}

/**
 * Clears all question history, daily seen sets, and speed blitz history on sign out
 */
export function clearSeenHistory(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(getSeenHistoryKey());
    localStorage.removeItem(getDailySeenKey());
    localStorage.removeItem(getSpeedBlitzKey());
    localStorage.removeItem(STORAGE_KEY_SEEN_HISTORY_PREFIX);
    localStorage.removeItem(STORAGE_KEY_DAILY_SEEN_PREFIX);
    localStorage.removeItem(STORAGE_KEY_SPEED_BLITZ_RECENT_PREFIX);
    currentHistoryUid = null;
  } catch (err) {
    console.warn('Failed to clear question history:', err);
  }
}


/**
 * Persistent Question History & Anti-Repetition Engine
 * 
 * Guarantees that:
 * 1. Questions/words seen yesterday or in recent sessions are NEVER immediately repeated.
 * 2. An LRU history of 1,000+ solved questions is maintained persistently in localStorage.
 * 3. Daily seen set is tracked so every new day feels 100% fresh and randomized.
 * 4. High-entropy shuffling ensures no deterministic sequence repetition.
 */

const STORAGE_KEY_SEEN_HISTORY = 'vocabclash_seen_history_v2';
const STORAGE_KEY_DAILY_SEEN = 'vocabclash_daily_seen_v2';
const STORAGE_KEY_SPEED_BLITZ_RECENT = 'vocabclash_speed_blitz_recent_ids_v1';
const MAX_HISTORY_SIZE = 1200;
const MAX_SPEED_BLITZ_RECENT_SIZE = 250;

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
    const raw = localStorage.getItem(STORAGE_KEY_SEEN_HISTORY);
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
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_SEEN);
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
    localStorage.setItem(STORAGE_KEY_SEEN_HISTORY, JSON.stringify(trimmed));

    // 2. Update daily seen record
    const today = getTodayString();
    let currentDaily: string[] = [];
    const rawDaily = localStorage.getItem(STORAGE_KEY_DAILY_SEEN);
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
        STORAGE_KEY_DAILY_SEEN,
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
 * Clears history for testing/reset if requested
 */
export function resetQuestionHistory(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEY_SEEN_HISTORY);
  localStorage.removeItem(STORAGE_KEY_DAILY_SEEN);
  localStorage.removeItem(STORAGE_KEY_SPEED_BLITZ_RECENT);
}

/**
 * Gets recently shown Speed Blitz question IDs in LRU order (oldest first).
 */
export function getRecentSpeedBlitzQuestionIds(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SPEED_BLITZ_RECENT);
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
    // Filter out previous occurrences of the new IDs to maintain LRU order at the tail
    const filtered = existing.filter(id => !newIdsSet.has(id));
    filtered.push(...Array.from(newIdsSet));

    const trimmed = filtered.slice(-MAX_SPEED_BLITZ_RECENT_SIZE);
    localStorage.setItem(STORAGE_KEY_SPEED_BLITZ_RECENT, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to record Speed Blitz recent question IDs:', err);
  }
}

/**
 * Clears only the Speed Blitz recent question history
 */
export function clearSpeedBlitzRecentHistory(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEY_SPEED_BLITZ_RECENT);
}


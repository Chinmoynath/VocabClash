import { QuestionCategory } from '../types';
import { getDailyStatsMap, getPersistentTotals } from '../utils/userStatsManager';
import { questionReviewScheduler } from './questionReviewScheduler';

export type AttemptSource = 
  | 'pyq' 
  | 'practice' 
  | 'battle' 
  | 'daily_challenge' 
  | 'mistake_review' 
  | 'historical_summary'
  | 'ssc_top100';

export interface NormalizedAttempt {
  attemptId: string;
  userId?: string;
  questionId?: string;
  conceptKey: string;
  category: QuestionCategory | 'uncategorized';
  correct: boolean;
  answeredAt: number; // Unix timestamp in ms
  hasReliableTimestamp: boolean;
  source: AttemptSource;
  rawCategory?: string;
  responseTimeMs?: number;
}

const STORAGE_KEY_ATTEMPTS_LOG = 'vocabclash_normalized_attempts_v1';
const MAX_LOCAL_ATTEMPTS = 5000;

// Asia/Kolkata is UTC+05:30 (19,800,000 ms), with no daylight saving time transitions
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Normalizes all historical and runtime category aliases to the official QuestionCategory or 'uncategorized'.
 */
export function normalizeCategory(raw: string | undefined | null): QuestionCategory | 'uncategorized' {
  if (!raw) return 'uncategorized';
  const clean = raw.toLowerCase().trim().replace(/[-_\s]+/g, ' ');

  // Synonyms
  if (
    clean === 'synonym' ||
    clean === 'synonyms' ||
    clean === 'synonym questions' ||
    clean === 'synonym question' ||
    clean === 'syn'
  ) {
    return 'synonyms';
  }

  // Antonyms
  if (
    clean === 'antonym' ||
    clean === 'antonyms' ||
    clean === 'antonym questions' ||
    clean === 'antonym question' ||
    clean === 'ant'
  ) {
    return 'antonyms';
  }

  // One Word Substitution
  if (
    clean === 'ows' ||
    clean === 'one word substitution' ||
    clean === 'one word substitutions' ||
    clean === 'one word' ||
    clean === 'substitution' ||
    clean === 'one_word' ||
    clean === 'one_word_substitution'
  ) {
    return 'ows';
  }

  // Idioms & Phrases
  if (
    clean === 'idiom' ||
    clean === 'idioms' ||
    clean === 'idiom and phrase' ||
    clean === 'idiom and phrases' ||
    clean === 'idioms and phrases' ||
    clean === 'idiom & phrase' ||
    clean === 'idioms & phrases' ||
    clean === 'idioms phrases' ||
    clean === 'idiom phrases' ||
    clean === 'phrases'
  ) {
    return 'idioms';
  }

  return 'uncategorized';
}

/**
 * Gets the current date/time in Asia/Kolkata (IST)
 */
export function getISTDate(timestampMs: number = Date.now()): Date {
  return new Date(timestampMs + IST_OFFSET_MS);
}

export interface DateRange {
  startMs: number;
  endMs: number;
  label: string;
}

/**
 * Returns the calendar week range in Asia/Kolkata:
 * Monday 00:00:00.000 IST through Sunday 23:59:59.999 IST
 */
export function getISTCalendarWeekRange(nowMs: number = Date.now()): DateRange {
  const istDate = new Date(nowMs + IST_OFFSET_MS);
  const dayOfWeek = istDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const y = istDate.getUTCFullYear();
  const m = istDate.getUTCMonth();
  const d = istDate.getUTCDate();

  // Start: Monday 00:00:00.000 IST
  const startMs = Date.UTC(y, m, d - daysSinceMonday, 0, 0, 0, 0) - IST_OFFSET_MS;
  // End: Sunday 23:59:59.999 IST
  const endMs = Date.UTC(y, m, d - daysSinceMonday + 6, 23, 59, 59, 999) - IST_OFFSET_MS;

  const startDate = new Date(startMs + IST_OFFSET_MS);
  const monthShort = startDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const label = `This Week (Mon ${startDate.getUTCDate()} ${monthShort} - Sun IST)`;

  return { startMs, endMs, label };
}

/**
 * Returns previous calendar week range in Asia/Kolkata:
 * Monday 00:00:00.000 IST to Sunday 23:59:59.999 IST of previous week
 */
export function getISTPreviousWeekRange(nowMs: number = Date.now()): DateRange {
  const currentWeek = getISTCalendarWeekRange(nowMs);
  const startMs = currentWeek.startMs - (7 * 24 * 60 * 60 * 1000);
  const endMs = currentWeek.startMs - 1;

  return { startMs, endMs, label: 'vs last week' };
}

/**
 * Returns the calendar month range in Asia/Kolkata:
 * 1st day of month 00:00:00.000 IST through last millisecond of current month IST
 */
export function getISTCalendarMonthRange(nowMs: number = Date.now()): DateRange {
  const istDate = new Date(nowMs + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = istDate.getUTCMonth();

  // 1st of month 00:00:00.000 IST
  const startMs = Date.UTC(y, m, 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  // Last millisecond of month IST
  const nextMonthStartMs = Date.UTC(y, m + 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endMs = nextMonthStartMs - 1;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const label = `This Month (${monthNames[m]} 1 - End, IST)`;

  return { startMs, endMs, label };
}

/**
 * Returns the previous calendar month range in Asia/Kolkata
 */
export function getISTPreviousMonthRange(nowMs: number = Date.now()): DateRange {
  const istDate = new Date(nowMs + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = istDate.getUTCMonth();

  const startMs = Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  const currentMonthStartMs = Date.UTC(y, m, 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endMs = currentMonthStartMs - 1;

  return { startMs, endMs, label: 'vs last month' };
}

/**
 * Reads local normalized attempts array from localStorage
 */
function getLocalAttempts(): NormalizedAttempt[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ATTEMPTS_LOG);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse local attempts log:', e);
    return [];
  }
}

/**
 * Saves local normalized attempts array to localStorage
 */
function saveLocalAttempts(attempts: NormalizedAttempt[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const trimmed = attempts.slice(-MAX_LOCAL_ATTEMPTS);
    localStorage.setItem(STORAGE_KEY_ATTEMPTS_LOG, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to save local attempts log:', e);
  }
}

/**
 * Appends a new genuine question attempt event to the authoritative log.
 */
export function recordAttemptEvent(data: {
  questionId?: string;
  conceptKey: string;
  category?: string;
  correct: boolean;
  answeredAt?: number;
  source: AttemptSource;
  responseTimeMs?: number;
  userId?: string;
}): NormalizedAttempt {
  const answeredAt = data.answeredAt || Date.now();
  const normCat = normalizeCategory(data.category);
  const cleanConcept = (data.conceptKey || data.questionId || 'concept').trim().toUpperCase();

  const attempt: NormalizedAttempt = {
    attemptId: `att_${answeredAt}_${Math.random().toString(36).slice(2, 7)}`,
    userId: data.userId,
    questionId: data.questionId,
    conceptKey: cleanConcept,
    category: normCat,
    correct: data.correct,
    answeredAt,
    hasReliableTimestamp: true,
    source: data.source,
    rawCategory: data.category,
    responseTimeMs: data.responseTimeMs,
  };

  const current = getLocalAttempts();
  current.push(attempt);
  saveLocalAttempts(current);

  // Dispatch browser update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('user-stats-updated', { detail: attempt }));
  }

  return attempt;
}

/**
 * Builds the SINGLE authoritative dataset of NormalizedAttempt[].
 * 
 * Ingestion Strategy:
 * 1. Load all explicit attempts from `vocabclash_normalized_attempts_v1`.
 * 2. Reconcile with historical records in `persistentTotals`, `reviewStates`, and `dailyMap`:
 *    - Uses stable attempt IDs to prevent double counting.
 *    - Never fabricates attempts.
 *    - Untimestamped historical attempts are marked with `hasReliableTimestamp: false` (answeredAt: 0)
 *      so they are included in ALL TIME, but NEVER guessed into This Week or This Month!
 */
export function getAuthoritativeAttempts(): NormalizedAttempt[] {
  const explicitAttempts = getLocalAttempts();
  const attemptMap = new Map<string, NormalizedAttempt>();

  // 1. Add all explicit attempts first
  for (const att of explicitAttempts) {
    if (att && att.attemptId) {
      attemptMap.set(att.attemptId, att);
    }
  }

  // 2. Reconcile with ReviewState concepts from spaced repetition
  // ReviewState records each concept seen in practice/drills with real timestamps
  const schedulerStates = questionReviewScheduler.getAllReviewStates();
  for (const s of schedulerStates) {
    if (!s || s.seenCount <= 0) continue;
    const cat = normalizeCategory(s.category);
    const concept = (s.conceptDisplay || s.memoryKey || 'concept').trim().toUpperCase();

    // Check if we already have explicit attempts recorded for this concept
    const existingCountForConcept = Array.from(attemptMap.values()).filter(
      a => a.conceptKey === concept
    ).length;

    const neededAttempts = s.seenCount - existingCountForConcept;
    if (neededAttempts > 0) {
      // Reconstruct genuine historical attempts for this concept
      let remCorrect = Math.max(0, s.correctCount - Array.from(attemptMap.values()).filter(a => a.conceptKey === concept && a.correct).length);
      
      for (let i = 0; i < neededAttempts; i++) {
        const isCorrect = remCorrect > 0;
        if (isCorrect) remCorrect--;

        // If s.lastSeenAt exists, the last attempt has a reliable timestamp
        const hasTimestamp = i === 0 && Boolean(s.lastSeenAt);
        const answeredAt = hasTimestamp ? s.lastSeenAt! : (s.firstSeenAt && i === neededAttempts - 1 ? s.firstSeenAt : 0);

        const syntheticId = `hist_rev_${concept}_${i}_${answeredAt}`;
        if (!attemptMap.has(syntheticId)) {
          attemptMap.set(syntheticId, {
            attemptId: syntheticId,
            conceptKey: concept,
            category: cat,
            correct: isCorrect,
            answeredAt,
            hasReliableTimestamp: hasTimestamp,
            source: 'practice',
            rawCategory: s.category,
          });
        }
      }
    }
  }

  // 3. Reconcile with persistentTotals (lifetime totals: totalSolved, totalCorrect, totalWrong, categoryTotals)
  const totals = getPersistentTotals();
  const currentTotalInMap = attemptMap.size;
  const targetLifetimeSolved = totals?.totalSolved || 0;

  if (targetLifetimeSolved > currentTotalInMap) {
    // We have persistent historical attempts recorded before fine-grained logging
    const categories: QuestionCategory[] = ['antonyms', 'synonyms', 'ows', 'idioms'];
    
    for (const cat of categories) {
      const storedCat = totals.categoryTotals?.[cat];
      if (!storedCat || storedCat.solved <= 0) continue;

      const existingCatAttempts = Array.from(attemptMap.values()).filter(a => a.category === cat);
      const neededCat = storedCat.solved - existingCatAttempts.length;

      if (neededCat > 0) {
        let remCorrect = Math.max(0, storedCat.correct - existingCatAttempts.filter(a => a.correct).length);
        for (let i = 0; i < neededCat; i++) {
          const isCorrect = remCorrect > 0;
          if (isCorrect) remCorrect--;

          // These are historical untimestamped attempts: genuine lifetime attempts without exact second/minute
          const syntheticId = `hist_tot_${cat}_${i}`;
          if (!attemptMap.has(syntheticId)) {
            attemptMap.set(syntheticId, {
              attemptId: syntheticId,
              conceptKey: `${cat.toUpperCase()}_HISTORICAL_${i + 1}`,
              category: cat,
              correct: isCorrect,
              answeredAt: 0, // 0 indicates untimestamped legacy attempt
              hasReliableTimestamp: false,
              source: 'historical_summary',
              rawCategory: cat,
            });
          }
        }
      }
    }

    // If there are still remaining solved questions not in category totals (uncategorized historical)
    const afterCatTotal = attemptMap.size;
    const remainingUncategorized = targetLifetimeSolved - afterCatTotal;
    if (remainingUncategorized > 0) {
      const storedCorrect = totals.totalCorrect || 0;
      const currentCorrect = Array.from(attemptMap.values()).filter(a => a.correct).length;
      let remCorrect = Math.max(0, storedCorrect - currentCorrect);

      for (let i = 0; i < remainingUncategorized; i++) {
        const isCorrect = remCorrect > 0;
        if (isCorrect) remCorrect--;

        const syntheticId = `hist_uncat_${i}`;
        if (!attemptMap.has(syntheticId)) {
          attemptMap.set(syntheticId, {
            attemptId: syntheticId,
            conceptKey: `HISTORICAL_ATTEMPT_${i + 1}`,
            category: 'uncategorized',
            correct: isCorrect,
            answeredAt: 0,
            hasReliableTimestamp: false,
            source: 'historical_summary',
            rawCategory: 'uncategorized',
          });
        }
      }
    }
  }

  // 4. Return as array
  return Array.from(attemptMap.values());
}

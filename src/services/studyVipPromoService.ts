import { isAndroidCapacitor } from '../utils/platform';
import { getTodayDateString } from '../utils/streakManager';

/**
 * =======================================================================
 * STUDY-TRIGGERED VIP PROMO SERVICE (NATIVE CAPACITOR ANDROID ONLY)
 * =======================================================================
 * Manages study-block progress and triggers the existing Study Break / VIP
 * house-ad banner after meaningful study sessions on native Android.
 *
 * Strict Guarantees:
 * - Native Capacitor Android app only (never website, browser, or PWA).
 * - Suppressed 100% for VIP users (isPremium === true).
 * - Random threshold of 3, 4, or 5 study blocks per promo cycle.
 * - Maximum once per local calendar day (persisted via local date helper).
 * - Never stacks back-to-back with AdMob interstitials (enforces cooldown).
 * - Never interrupts active questions or in-progress matches.
 * - Reuses the exact existing Study Break / House Interstitial banner.
 * - Strictly local storage persistence (UID-scoped, zero Firestore footprint).
 * =======================================================================
 */

export interface StudyVipPromoState {
  completedBlocks: number;
  threshold: number; // 3, 4, or 5
  pyqAnswerCountInCurrentBlock: number; // 0 to 9
  lastShownDate: string; // YYYY-MM-DD
  lastShownTimestamp?: number;
}

const STORAGE_KEY_PREFIX = 'vocabclash_study_vip_promo_v1_';
export const AD_COOLDOWN_MS = 3 * 60 * 1000; // 3-minute cooldown after any AdMob or house ad
const STORAGE_KEY_LAST_AD = 'vocabclash_last_ad_ts_v1';

/**
 * Returns epoch timestamp of last displayed ad (AdMob interstitial or house ad).
 */
export function getLastAdTimestamp(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const val = localStorage.getItem(STORAGE_KEY_LAST_AD);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Returns a random threshold of 3, 4, or 5 study blocks.
 */
export function getRandomThreshold(): number {
  const choices = [3, 4, 5];
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Account-scoped local storage key to isolate users on the same device.
 */
export function getStudyVipPromoStorageKey(uid?: string | null): string {
  if (uid && uid !== 'default_user' && uid !== 'guest') {
    return `${STORAGE_KEY_PREFIX}${uid}`;
  }
  return `${STORAGE_KEY_PREFIX}guest`;
}

/**
 * Loads current study VIP promo state from local storage.
 */
export function getStudyVipPromoState(uid?: string | null): StudyVipPromoState {
  if (typeof window === 'undefined') {
    return {
      completedBlocks: 0,
      threshold: 3,
      pyqAnswerCountInCurrentBlock: 0,
      lastShownDate: '',
      lastShownTimestamp: 0,
    };
  }

  const key = getStudyVipPromoStorageKey(uid);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const threshold = [3, 4, 5].includes(parsed.threshold) ? parsed.threshold : getRandomThreshold();
      return {
        completedBlocks: Math.max(0, Number(parsed.completedBlocks) || 0),
        threshold,
        pyqAnswerCountInCurrentBlock: Math.max(0, Math.min(9, Number(parsed.pyqAnswerCountInCurrentBlock) || 0)),
        lastShownDate: typeof parsed.lastShownDate === 'string' ? parsed.lastShownDate : '',
        lastShownTimestamp: Number(parsed.lastShownTimestamp) || 0,
      };
    }
  } catch (err) {
    console.warn('[StudyVipPromo] Failed to parse local state:', err);
  }

  const initial: StudyVipPromoState = {
    completedBlocks: 0,
    threshold: getRandomThreshold(),
    pyqAnswerCountInCurrentBlock: 0,
    lastShownDate: '',
    lastShownTimestamp: 0,
  };
  saveStudyVipPromoState(initial, uid);
  return initial;
}

/**
 * Persists study VIP promo state to local storage.
 */
export function saveStudyVipPromoState(state: StudyVipPromoState, uid?: string | null): void {
  if (typeof window === 'undefined') return;
  const key = getStudyVipPromoStorageKey(uid);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.warn('[StudyVipPromo] Failed to save local state:', err);
  }
}

// In-memory guard to deduplicate answered PYQ calls for the same question
let lastAnsweredPyqId: string | null = null;

/**
 * Records an answered PYQ question in PYQ drill.
 * Every 10 answered questions increments completedBlocks by 1.
 */
export function recordPyqAnswered(
  questionId?: string,
  uid?: string | null,
  isPremium?: boolean
): { completedBlock: boolean; state: StudyVipPromoState } {
  const currentState = getStudyVipPromoState(uid);

  // VIP users and non-Android environments are strictly excluded
  if (isPremium || !isAndroidCapacitor()) {
    return { completedBlock: false, state: currentState };
  }

  // Deduplicate rapid/re-rendered answers on the same question
  if (questionId && questionId === lastAnsweredPyqId) {
    return { completedBlock: false, state: currentState };
  }
  if (questionId) {
    lastAnsweredPyqId = questionId;
  }

  let nextPyqCount = currentState.pyqAnswerCountInCurrentBlock + 1;
  let nextBlocks = currentState.completedBlocks;
  let completedBlock = false;

  if (nextPyqCount >= 10) {
    nextBlocks += 1;
    nextPyqCount = 0;
    completedBlock = true;
  }

  const updatedState: StudyVipPromoState = {
    ...currentState,
    completedBlocks: nextBlocks,
    pyqAnswerCountInCurrentBlock: nextPyqCount,
  };

  saveStudyVipPromoState(updatedState, uid);
  return { completedBlock, state: updatedState };
}

/**
 * Records completion of a 1v1 duel.
 * Completing one duel counts as 1 completed study block.
 */
export function recordDuelCompleted(
  uid?: string | null,
  isPremium?: boolean
): { completedBlock: boolean; state: StudyVipPromoState } {
  const currentState = getStudyVipPromoState(uid);

  if (isPremium || !isAndroidCapacitor()) {
    return { completedBlock: false, state: currentState };
  }

  const updatedState: StudyVipPromoState = {
    ...currentState,
    completedBlocks: currentState.completedBlocks + 1,
  };

  saveStudyVipPromoState(updatedState, uid);
  return { completedBlock: true, state: updatedState };
}

/**
 * Records completion of a Daily Quiz.
 * Completing one Daily Quiz counts as 1 completed study block.
 */
export function recordDailyQuizCompleted(
  uid?: string | null,
  isPremium?: boolean
): { completedBlock: boolean; state: StudyVipPromoState } {
  const currentState = getStudyVipPromoState(uid);

  if (isPremium || !isAndroidCapacitor()) {
    return { completedBlock: false, state: currentState };
  }

  const updatedState: StudyVipPromoState = {
    ...currentState,
    completedBlocks: currentState.completedBlocks + 1,
  };

  saveStudyVipPromoState(updatedState, uid);
  return { completedBlock: true, state: updatedState };
}

/**
 * Records completion of a Mistake Vault revision session.
 * Completing one Mistake Vault revision session counts as 1 completed study block.
 */
export function recordMistakeVaultCompleted(
  uid?: string | null,
  isPremium?: boolean
): { completedBlock: boolean; state: StudyVipPromoState } {
  const currentState = getStudyVipPromoState(uid);

  if (isPremium || !isAndroidCapacitor()) {
    return { completedBlock: false, state: currentState };
  }

  const updatedState: StudyVipPromoState = {
    ...currentState,
    completedBlocks: currentState.completedBlocks + 1,
  };

  saveStudyVipPromoState(updatedState, uid);
  return { completedBlock: true, state: updatedState };
}

/**
 * Evaluates whether the study-triggered VIP banner is currently eligible to be displayed.
 * Checks:
 * - Native Android Capacitor shell
 * - User is not VIP
 * - Completed study blocks >= current threshold
 * - Banner has not already been shown today (local calendar day)
 * - Reasonable cooldown has elapsed since recent AdMob or House banner
 */
export function isStudyVipPromoEligible(
  uid?: string | null,
  isPremium?: boolean
): boolean {
  if (!isAndroidCapacitor()) return false;
  if (isPremium) return false;

  const state = getStudyVipPromoState(uid);

  // Once per local calendar day check
  const today = getTodayDateString();
  if (state.lastShownDate === today) {
    return false;
  }

  // Threshold check
  if (state.completedBlocks < state.threshold) {
    return false;
  }

  // Cooldown check against any recent ad (AdMob interstitial or fallback house ad)
  const lastAd = getLastAdTimestamp();
  if (lastAd > 0 && Date.now() - lastAd < AD_COOLDOWN_MS) {
    return false;
  }

  return true;
}

/**
 * Marks that the study-triggered VIP promo banner was successfully displayed.
 * - Resets completed block count to 0
 * - Resets remainder PYQ count to 0
 * - Chooses a fresh random threshold between 3 and 5
 * - Records today's local date so it cannot appear again today
 */
export function markStudyVipPromoShown(uid?: string | null): void {
  const nextThreshold = getRandomThreshold();
  const today = getTodayDateString();
  const now = Date.now();

  const freshState: StudyVipPromoState = {
    completedBlocks: 0,
    threshold: nextThreshold,
    pyqAnswerCountInCurrentBlock: 0,
    lastShownDate: today,
    lastShownTimestamp: now,
  };

  saveStudyVipPromoState(freshState, uid);
}

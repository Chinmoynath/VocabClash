import { DailyStreakState } from '../types';

const STORAGE_KEY_STREAK_PREFIX = 'vocabclash_streak_state_v3_';
const STORAGE_KEY_STREAK_BONUS_PREFIX = 'vocabclash_streak_bonus_date_v3_';
export const LEGACY_STORAGE_KEY_STREAK = 'vocabclash_daily_streak_v2';
export const STORAGE_KEY_STREAK_BONUS_CLAIMED_DATE = 'vocabclash_streak_daily_bonus_claimed_date';

// Active in-memory UID tracker for currently authenticated session
let activeStreakUid: string | null = null;

export function setActiveStreakUser(uid: string | null): void {
  activeStreakUid = uid;
}

export function getActiveStreakUser(): string | null {
  return activeStreakUid;
}

/**
 * Returns UID-scoped key for daily streak state
 */
export function getStreakStorageKey(uid?: string | null): string {
  const resolved = uid !== undefined ? uid : activeStreakUid;
  if (resolved && resolved !== 'guest' && resolved !== 'default_user') {
    return `${STORAGE_KEY_STREAK_PREFIX}${resolved}`;
  }
  return `${STORAGE_KEY_STREAK_PREFIX}guest`;
}

/**
 * Returns UID-scoped key for daily streak bonus claim date
 */
export function getStreakBonusStorageKey(uid?: string | null): string {
  const resolved = uid !== undefined ? uid : activeStreakUid;
  if (resolved && resolved !== 'guest' && resolved !== 'default_user') {
    return `${STORAGE_KEY_STREAK_BONUS_PREFIX}${resolved}`;
  }
  return `${STORAGE_KEY_STREAK_BONUS_PREFIX}guest`;
}

/**
 * Factory for a brand new, clean, unhydrated streak state
 */
export function createFreshStreak(): DailyStreakState {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    lastActiveTimestamp: 0,
    claimedToday: false,
    lastClaimedBonusDate: '',
    totalDaysActive: 0,
    history: {},
    streakBrokenNotice: false,
  };
}

/**
 * Clears streak caches for a specific user or guest
 */
export function clearStreakCacheForUser(uid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (uid) {
      localStorage.removeItem(getStreakStorageKey(uid));
      localStorage.removeItem(getStreakBonusStorageKey(uid));
    } else {
      localStorage.removeItem(getStreakStorageKey('guest'));
      localStorage.removeItem(getStreakBonusStorageKey('guest'));
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY_STREAK);
    localStorage.removeItem(STORAGE_KEY_STREAK_BONUS_CLAIMED_DATE);
  } catch {}
}

/**
 * Returns YYYY-MM-DD in local time
 */
export function getTodayDateString(offsetDays: number = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar day difference between 2 YYYY-MM-DD date strings
 */
export function calculateDayDifference(dateStr1: string, dateStr2: string): number {
  if (!dateStr1 || !dateStr2) return 999;
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns YYYY-MM-DD shifted by offsetDays from baseDateStr
 */
export function getOffsetDateString(baseDateStr: string, offsetDays: number): string {
  const parts = baseDateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Mathematically derives the active consecutive streak and longest streak directly from history map.
 * This guarantees that even if a device had temporary local storage resets or delays, the streak is always
 * correctly restored from the recorded days.
 */
export function calculateStreakFromHistory(
  history: Record<string, boolean> = {},
  today: string = getTodayDateString()
): { currentStreak: number; longestStreak: number; lastActiveDate: string } {
  const activeDates = Object.keys(history).filter(d => history[d]);
  if (activeDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };
  }

  activeDates.sort();
  const lastActiveDate = activeDates[activeDates.length - 1];

  // Current streak calculation:
  // 1) If user solved today: walk backwards from today
  // 2) If user has not yet solved today, but was active yesterday: streak is intact, walk backwards from yesterday
  // 3) If user missed >= 2 days: current streak is 0
  let currentStreak = 0;
  const daysDiff = calculateDayDifference(lastActiveDate, today);

  if (daysDiff === 0 || history[today]) {
    let checkDate = today;
    let count = 0;
    while (history[checkDate]) {
      count++;
      checkDate = getOffsetDateString(today, -count);
    }
    currentStreak = count;
  } else if (daysDiff === 1) {
    let checkDate = lastActiveDate;
    let count = 0;
    while (history[checkDate]) {
      count++;
      checkDate = getOffsetDateString(lastActiveDate, -count);
    }
    currentStreak = count;
  } else {
    currentStreak = 0;
  }

  // Calculate all-time longest streak from history
  let longestStreak = currentStreak;
  let running = 0;
  let prevDate = '';
  for (const d of activeDates) {
    if (!prevDate) {
      running = 1;
    } else {
      const diff = calculateDayDifference(prevDate, d);
      if (diff === 1) {
        running++;
      } else if (diff > 1) {
        running = 1;
      }
    }
    if (running > longestStreak) longestStreak = running;
    prevDate = d;
  }

  return { currentStreak, longestStreak, lastActiveDate };
}

/**
 * Intelligently merges streak states from local storage and cloud database.
 * Preserves the union of all active dates, preventing device desyncs or accidental resets.
 */
export function mergeStreakStates(
  local: DailyStreakState,
  cloud?: DailyStreakState | null,
  today: string = getTodayDateString(),
  userEmail?: string | null,
  uid?: string | null
): DailyStreakState {
  const targetUid = uid !== undefined ? uid : activeStreakUid;
  const mergedHistory: Record<string, boolean> = {
    ...(local.history || {}),
    ...(cloud?.history || {}),
  };

  if (local.lastActiveDate) mergedHistory[local.lastActiveDate] = true;
  if (cloud?.lastActiveDate) mergedHistory[cloud.lastActiveDate] = true;

  // Chinmoy Nath (Admin / Developer) account recovery:
  // Preserves active streak (yesterday & today) if account matches
  const isChinmoy = userEmail && (
    userEmail.toLowerCase() === 'nathchinmoy777@gmail.com' ||
    userEmail.toLowerCase().includes('nathchinmoy777')
  );

  if (isChinmoy) {
    // Both Sep 15 and Sep 16 were active solves across phone and laptop
    mergedHistory['2026-09-15'] = true;
    mergedHistory['2026-09-16'] = true;
  }

  const calculated = calculateStreakFromHistory(mergedHistory, today);

  let currentStreak = Math.max(
    calculated.currentStreak,
    calculateDayDifference(local.lastActiveDate, today) <= 1 ? (local.currentStreak || 0) : 0,
    cloud && calculateDayDifference(cloud.lastActiveDate, today) <= 1 ? (cloud.currentStreak || 0) : 0
  );

  if (isChinmoy) {
    currentStreak = Math.max(currentStreak, 2);
  }

  const longestStreak = Math.max(
    local.longestStreak || 0,
    cloud?.longestStreak || 0,
    calculated.longestStreak,
    currentStreak,
    isChinmoy ? 4 : 0
  );

  const isClaimedToday = 
    isDailyStreakBonusClaimed(local, today, targetUid) || 
    (cloud ? isDailyStreakBonusClaimed(cloud, today, targetUid) : false);

  const lastActiveDate = 
    (mergedHistory[today] ? today : (calculated.lastActiveDate || cloud?.lastActiveDate || local.lastActiveDate || today));

  const merged: DailyStreakState = {
    currentStreak,
    longestStreak,
    lastActiveDate,
    lastActiveTimestamp: Math.max(local.lastActiveTimestamp || 0, cloud?.lastActiveTimestamp || 0, Date.now()),
    claimedToday: isClaimedToday,
    lastClaimedBonusDate: (local.lastClaimedBonusDate === today || cloud?.lastClaimedBonusDate === today)
      ? today
      : (cloud?.lastClaimedBonusDate || local.lastClaimedBonusDate || ''),
    totalDaysActive: Object.keys(mergedHistory).filter(d => mergedHistory[d]).length,
    history: mergedHistory,
    streakBrokenNotice: false,
  };

  return merged;
}

/**
 * Universal global question solved broadcaster.
 * Dispatches an event so that whenever ANY question is solved ANYWHERE in the app
 * (1v1 Arena, Practice Drill, Daily Challenge, Mistake Vault, Due Revision, SSC Top 100),
 * the daily streak and daily target update in real-time.
 */
export function triggerGlobalQuestionSolved(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vocabclash:question-solved'));
  }
}

/**
 * Checks if today's streak daily bonus (+25 LP) has already been claimed today.
 * Strictly checks both in-memory state and localStorage to prevent multi-claiming.
 */
export function isDailyStreakBonusClaimed(
  state: DailyStreakState,
  today: string = getTodayDateString(),
  uid?: string | null
): boolean {
  if (state.lastClaimedBonusDate === today) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const bonusKey = getStreakBonusStorageKey(uid);
      const localClaimedDate = localStorage.getItem(bonusKey);
      if (localClaimedDate === today) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Checks if user has solved at least one question today
 */
export function isDailyQuestionSolvedToday(
  state: DailyStreakState,
  today: string = getTodayDateString()
): boolean {
  return Boolean(state.history?.[today] || state.lastActiveDate === today);
}

/**
 * Loads stored streak from localStorage for a specific UID and checks for missed days.
 * Never loads another user's streak.
 */
export function getInitialStreak(uid?: string | null): DailyStreakState {
  const today = getTodayDateString();
  const targetUid = uid !== undefined ? uid : activeStreakUid;

  if (typeof window !== 'undefined') {
    const key = getStreakStorageKey(targetUid);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed: DailyStreakState = JSON.parse(saved);
        return evaluateStreakIntegrity(parsed, today, targetUid);
      } catch (e) {
        console.error('Failed to parse streak state', e);
      }
    }
  }

  // Brand new / unhydrated user: Starts at fresh 0 days until cloud hydrates or question is solved
  const initial = createFreshStreak();
  saveStreakState(initial, targetUid);
  return initial;
}

/**
 * Evaluates whether streak is broken based on today's date.
 * - If last active was yesterday: streak is intact, pending today's question.
 * - If last active was today: user has already solved a question today.
 * - If last active was >= 2 days ago: user missed a day -> streak resets to 0!
 */
export function evaluateStreakIntegrity(
  state: DailyStreakState, 
  today: string = getTodayDateString(),
  uid?: string | null
): DailyStreakState {
  const targetUid = uid !== undefined ? uid : activeStreakUid;
  const isBonusClaimedToday = isDailyStreakBonusClaimed(state, today, targetUid);
  const lastDate = state.lastActiveDate;
  if (!lastDate) {
    return {
      ...state,
      currentStreak: 0,
      claimedToday: isBonusClaimedToday,
      streakBrokenNotice: false,
    };
  }

  const daysDiff = calculateDayDifference(lastDate, today);

  if (daysDiff === 0) {
    // Solved questions today
    return {
      ...state,
      claimedToday: isBonusClaimedToday,
      streakBrokenNotice: false,
    };
  } else if (daysDiff === 1) {
    // Solved questions yesterday, streak is currently active and waiting for today's practice
    return {
      ...state,
      claimedToday: isBonusClaimedToday,
      streakBrokenNotice: false,
    };
  } else {
    // Missed 1 full day or more! (daysDiff >= 2)
    // Streak resets strictly back to 0
    const updated: DailyStreakState = {
      ...state,
      currentStreak: 0,
      claimedToday: isBonusClaimedToday,
      streakBrokenNotice: state.currentStreak > 0, // Flag notice if they had an active streak that was broken
    };
    saveStreakState(updated, targetUid);
    return updated;
  }
}

/**
 * Claims the daily streak bonus (+25 LP).
 * STRICT RULE: Can only be claimed ONCE per calendar day per UID!
 */
export function claimDailyStreakBonus(
  state: DailyStreakState,
  today: string = getTodayDateString(),
  uid?: string | null
): { success: boolean; rewardLP: number; updatedStreak: DailyStreakState; error?: string } {
  const targetUid = uid !== undefined ? uid : activeStreakUid;
  // 1. Guard against claiming more than once per day
  if (isDailyStreakBonusClaimed(state, today, targetUid)) {
    return {
      success: false,
      rewardLP: 0,
      updatedStreak: state,
      error: 'ALREADY_CLAIMED',
    };
  }

  // 2. Guard: Must have solved at least 1 question today
  const isSolvedToday = isDailyQuestionSolvedToday(state, today);
  if (!isSolvedToday) {
    return {
      success: false,
      rewardLP: 0,
      updatedStreak: state,
      error: 'NOT_SOLVED_TODAY',
    };
  }

  // 3. Mark claimed both in state and localStorage
  const updated: DailyStreakState = {
    ...state,
    claimedToday: true,
    lastClaimedBonusDate: today,
  };

  saveStreakState(updated, targetUid);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getStreakBonusStorageKey(targetUid), today);
      if (targetUid && targetUid !== 'guest') {
        localStorage.removeItem(STORAGE_KEY_STREAK_BONUS_CLAIMED_DATE);
      }
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    rewardLP: 25,
    updatedStreak: updated,
  };
}

/**
 * Called when user solves at least 1 question from anywhere (Live Duel, Practice Mode, Mistake Vault).
 * - If first question today & yesterday was active -> streak += 1
 * - If first question today & missed previous day / new -> streak becomes 1
 * - If already solved today -> retains current streak
 */
export function recordDailyQuestionSolved(
  state: DailyStreakState,
  today: string = getTodayDateString(),
  uid?: string | null
): { updatedStreak: DailyStreakState; isNewStreakDay: boolean } {
  const targetUid = uid !== undefined ? uid : activeStreakUid;
  const isBonusClaimed = isDailyStreakBonusClaimed(state, today, targetUid);
  const isAlreadySolvedToday = Boolean(state.history?.[today] || state.lastActiveDate === today);

  const updatedHistory: Record<string, boolean> = {
    ...(state.history || {}),
    [today]: true,
  };
  if (state.lastActiveDate) {
    updatedHistory[state.lastActiveDate] = true;
  }

  const { currentStreak: calcStreak, longestStreak: calcLongest } = calculateStreakFromHistory(updatedHistory, today);

  const finalCurrentStreak = Math.max(
    calcStreak,
    isAlreadySolvedToday ? (state.currentStreak || 1) : ((state.currentStreak || 0) + 1),
    1
  );

  const finalLongestStreak = Math.max(
    state.longestStreak || 0,
    calcLongest,
    finalCurrentStreak
  );

  const updated: DailyStreakState = {
    ...state,
    currentStreak: finalCurrentStreak,
    longestStreak: finalLongestStreak,
    lastActiveDate: today,
    lastActiveTimestamp: Date.now(),
    claimedToday: isBonusClaimed,
    lastClaimedBonusDate: state.lastClaimedBonusDate,
    totalDaysActive: Object.keys(updatedHistory).filter(d => updatedHistory[d]).length,
    history: updatedHistory,
    streakBrokenNotice: false,
  };

  saveStreakState(updated, targetUid);
  return { updatedStreak: updated, isNewStreakDay: !isAlreadySolvedToday };
}

export function saveStreakState(state: DailyStreakState, uid?: string | null): void {
  if (typeof window === 'undefined') return;
  const targetUid = uid !== undefined ? uid : activeStreakUid;
  const key = getStreakStorageKey(targetUid);
  try {
    localStorage.setItem(key, JSON.stringify(state));
    // Clean up legacy global key if an authenticated user is active
    if (targetUid && targetUid !== 'guest') {
      localStorage.removeItem(LEGACY_STORAGE_KEY_STREAK);
    }
  } catch {}
}

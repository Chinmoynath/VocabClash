import { DailyStreakState } from '../types';

const STORAGE_KEY_STREAK = 'vocabclash_daily_streak_v2';

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
 * Loads stored streak from localStorage and checks for missed days
 */
export function getInitialStreak(): DailyStreakState {
  const today = getTodayDateString();

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_STREAK);
    if (saved) {
      try {
        const parsed: DailyStreakState = JSON.parse(saved);
        return evaluateStreakIntegrity(parsed, today);
      } catch (e) {
        console.error('Failed to parse streak state', e);
      }
    }
  }

  // Brand new user: Starts at 0 days until they solve their first question
  const initial: DailyStreakState = {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    lastActiveTimestamp: 0,
    claimedToday: false,
    totalDaysActive: 0,
    history: {},
    streakBrokenNotice: false,
  };
  saveStreakState(initial);
  return initial;
}

/**
 * Evaluates whether streak is broken based on today's date.
 * - If last active was yesterday: streak is intact, pending today's question.
 * - If last active was today: user has already solved a question today.
 * - If last active was >= 2 days ago: user missed a day -> streak resets to 0!
 */
export function evaluateStreakIntegrity(state: DailyStreakState, today: string = getTodayDateString()): DailyStreakState {
  const lastDate = state.lastActiveDate;
  if (!lastDate) {
    return {
      ...state,
      currentStreak: 0,
      claimedToday: false,
      streakBrokenNotice: false,
    };
  }

  const daysDiff = calculateDayDifference(lastDate, today);

  if (daysDiff === 0) {
    // Solved questions today
    return {
      ...state,
      claimedToday: true,
      streakBrokenNotice: false,
    };
  } else if (daysDiff === 1) {
    // Solved questions yesterday, streak is currently active and waiting for today's practice
    return {
      ...state,
      claimedToday: false,
      streakBrokenNotice: false,
    };
  } else {
    // Missed 1 full day or more! (daysDiff >= 2)
    // Streak resets strictly back to 0
    const updated: DailyStreakState = {
      ...state,
      currentStreak: 0,
      claimedToday: false,
      streakBrokenNotice: state.currentStreak > 0, // Flag notice if they had an active streak that was broken
    };
    saveStreakState(updated);
    return updated;
  }
}

/**
 * Called when user solves at least 1 question from anywhere (Live Duel, Practice Mode, Mistake Vault).
 * - If first question today & yesterday was active -> streak += 1
 * - If first question today & missed previous day / new -> streak becomes 1
 * - If already solved today -> retains current streak
 */
export function recordDailyQuestionSolved(
  state: DailyStreakState,
  today: string = getTodayDateString()
): { updatedStreak: DailyStreakState; isNewStreakDay: boolean } {
  const lastDate = state.lastActiveDate;
  
  if (!lastDate) {
    // First ever solved question -> Starts Day 1 streak
    const updated: DailyStreakState = {
      ...state,
      currentStreak: 1,
      longestStreak: Math.max(state.longestStreak, 1),
      lastActiveDate: today,
      lastActiveTimestamp: Date.now(),
      claimedToday: true,
      totalDaysActive: (state.totalDaysActive || 0) + 1,
      history: {
        ...state.history,
        [today]: true,
      },
      streakBrokenNotice: false,
    };
    saveStreakState(updated);
    return { updatedStreak: updated, isNewStreakDay: true };
  }

  const daysDiff = calculateDayDifference(lastDate, today);

  if (daysDiff === 0) {
    // Already solved a question today -> Streak already incremented for today
    const updated: DailyStreakState = {
      ...state,
      claimedToday: true,
      history: {
        ...state.history,
        [today]: true,
      },
      streakBrokenNotice: false,
    };
    saveStreakState(updated);
    return { updatedStreak: updated, isNewStreakDay: false };
  } else if (daysDiff === 1) {
    // Consecutive day solve! (Yesterday was active) -> Streak increments by 1
    const newStreak = state.currentStreak + 1;
    const updated: DailyStreakState = {
      ...state,
      currentStreak: newStreak,
      longestStreak: Math.max(state.longestStreak, newStreak),
      lastActiveDate: today,
      lastActiveTimestamp: Date.now(),
      claimedToday: true,
      totalDaysActive: (state.totalDaysActive || 0) + 1,
      history: {
        ...state.history,
        [today]: true,
      },
      streakBrokenNotice: false,
    };
    saveStreakState(updated);
    return { updatedStreak: updated, isNewStreakDay: true };
  } else {
    // Missed 1 day or more in between -> Starts fresh at Streak 1
    const updated: DailyStreakState = {
      ...state,
      currentStreak: 1,
      longestStreak: Math.max(state.longestStreak, 1),
      lastActiveDate: today,
      lastActiveTimestamp: Date.now(),
      claimedToday: true,
      totalDaysActive: (state.totalDaysActive || 0) + 1,
      history: {
        ...state.history,
        [today]: true,
      },
      streakBrokenNotice: false,
    };
    saveStreakState(updated);
    return { updatedStreak: updated, isNewStreakDay: true };
  }
}

export function saveStreakState(state: DailyStreakState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(state));
}

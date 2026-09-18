import { checkAndTrackDailyGoalComplete, checkAndTrackQuestion10 } from '../services/analyticsService';

export interface DailyTargetConfig {
  targetQuestions: number; // default 30, min 20, max 500
}

export interface DailyTargetState {
  date: string; // YYYY-MM-DD
  targetQuestions: number; // default 30, min 20, max 500
  questionsSolvedToday: number;
  isRewardClaimed: boolean;
  lastUpdated: number;
}

const STORAGE_KEY_CONFIG_PREFIX = 'vocabclash_daily_target_config_v3_';
const STORAGE_KEY_STATE_PREFIX = 'vocabclash_daily_target_state_v3_';
export const LEGACY_STORAGE_KEY_DAILY_TARGET_CONFIG = 'vocabclash_daily_target_config_v2';
export const LEGACY_STORAGE_KEY_DAILY_TARGET_STATE = 'vocabclash_daily_target_state_v2';

let activeDailyTargetUid: string | null = null;

export function setDailyTargetAuthUid(uid: string | null): void {
  activeDailyTargetUid = uid;
}

export function getDailyTargetAuthUid(): string | null {
  return activeDailyTargetUid;
}

export function getDailyTargetConfigStorageKey(uid?: string | null): string {
  const target = uid !== undefined ? uid : activeDailyTargetUid;
  if (target && target !== 'guest' && target !== 'default_user') {
    return `${STORAGE_KEY_CONFIG_PREFIX}${target}`;
  }
  return `${STORAGE_KEY_CONFIG_PREFIX}guest`;
}

export function getDailyTargetStateStorageKey(uid?: string | null): string {
  const target = uid !== undefined ? uid : activeDailyTargetUid;
  if (target && target !== 'guest' && target !== 'default_user') {
    return `${STORAGE_KEY_STATE_PREFIX}${target}`;
  }
  return `${STORAGE_KEY_STATE_PREFIX}guest`;
}

export const MIN_DAILY_TARGET = 20;
export const MAX_DAILY_TARGET = 500;
export const DEFAULT_DAILY_TARGET = 30;

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyTargetConfig(uid?: string | null): DailyTargetConfig {
  const targetUid = uid !== undefined ? uid : activeDailyTargetUid;
  try {
    const raw = localStorage.getItem(getDailyTargetConfigStorageKey(targetUid));
    if (raw) {
      const parsed = JSON.parse(raw);
      const target = Math.max(MIN_DAILY_TARGET, Math.min(MAX_DAILY_TARGET, Number(parsed.targetQuestions) || DEFAULT_DAILY_TARGET));
      return { targetQuestions: target };
    }
  } catch {
    // fallback
  }
  return { targetQuestions: DEFAULT_DAILY_TARGET };
}

export function saveDailyTargetConfig(config: DailyTargetConfig, uid?: string | null): void {
  const targetUid = uid !== undefined ? uid : activeDailyTargetUid;
  const sanitizedTarget = Math.max(MIN_DAILY_TARGET, Math.min(MAX_DAILY_TARGET, Math.round(config.targetQuestions)));
  try {
    localStorage.setItem(getDailyTargetConfigStorageKey(targetUid), JSON.stringify({ targetQuestions: sanitizedTarget }));
    // Also update today's state target
    const state = getDailyTargetState(targetUid);
    state.targetQuestions = sanitizedTarget;
    saveDailyTargetState(state, targetUid);
    if (targetUid && targetUid !== 'guest') {
      localStorage.removeItem(LEGACY_STORAGE_KEY_DAILY_TARGET_CONFIG);
    }
  } catch {
    // ignore
  }
}

export function getDailyTargetState(uid?: string | null): DailyTargetState {
  const today = getTodayDateString();
  const targetUid = uid !== undefined ? uid : activeDailyTargetUid;
  const config = getDailyTargetConfig(targetUid);

  try {
    const raw = localStorage.getItem(getDailyTargetStateStorageKey(targetUid));
    if (raw) {
      const parsed: DailyTargetState = JSON.parse(raw);
      if (parsed.date === today) {
        // Ensure valid target within bounds
        parsed.targetQuestions = config.targetQuestions;
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  // New day or first run for this user
  const fresh: DailyTargetState = {
    date: today,
    targetQuestions: config.targetQuestions,
    questionsSolvedToday: 0,
    isRewardClaimed: false,
    lastUpdated: Date.now(),
  };

  saveDailyTargetState(fresh, targetUid);
  return fresh;
}

export function saveDailyTargetState(state: DailyTargetState, uid?: string | null): void {
  const targetUid = uid !== undefined ? uid : activeDailyTargetUid;
  try {
    localStorage.setItem(getDailyTargetStateStorageKey(targetUid), JSON.stringify(state));
    if (targetUid && targetUid !== 'guest') {
      localStorage.removeItem(LEGACY_STORAGE_KEY_DAILY_TARGET_STATE);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('daily-target-updated', { detail: state }));
    }
  } catch {
    // ignore
  }
}

export function recordQuestionSolvedForDailyTarget(count: number = 1, uid?: string | null): DailyTargetState {
  const targetUid = uid !== undefined ? uid : activeDailyTargetUid;
  const state = getDailyTargetState(targetUid);
  const prevSolved = state.questionsSolvedToday;
  state.questionsSolvedToday += count;
  state.lastUpdated = Date.now();
  saveDailyTargetState(state, targetUid);

  // GA4 Tracking: 10 legitimate questions answered milestone (once per day)
  checkAndTrackQuestion10(state.questionsSolvedToday);

  // GA4 Tracking: Daily goal crossed target (e.g. 29 -> 30, once per day)
  if (prevSolved < state.targetQuestions && state.questionsSolvedToday >= state.targetQuestions) {
    checkAndTrackDailyGoalComplete(state.targetQuestions);
  }

  return state;
}

export function claimDailyTargetReward(uid?: string | null): { success: boolean; rewardLP: number; state: DailyTargetState } {
  const targetUid = uid !== undefined ? uid : activeDailyTargetUid;
  const state = getDailyTargetState(targetUid);
  const isReached = state.questionsSolvedToday >= state.targetQuestions;

  if (!isReached || state.isRewardClaimed) {
    return { success: false, rewardLP: 0, state };
  }

  state.isRewardClaimed = true;
  state.lastUpdated = Date.now();
  saveDailyTargetState(state, targetUid);

  // Scaled LP reward based on target size (e.g., 30 questions = 60 LP, 100 questions = 150 LP)
  const baseLP = 50;
  const targetBonus = Math.floor((state.targetQuestions / 10) * 5);
  const totalRewardLP = baseLP + targetBonus;

  return { success: true, rewardLP: totalRewardLP, state };
}

export function getTimeUntilMidnight(): { hours: number; minutes: number; seconds: number; formatted: string } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const diffMs = Math.max(0, midnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  return { hours, minutes, seconds, formatted };
}

/**
 * Resets daily target state and config upon sign out so guest starts fresh
 */
export function resetDailyTargetState(uid?: string | null): void {
  try {
    if (uid) {
      localStorage.removeItem(getDailyTargetStateStorageKey(uid));
      localStorage.removeItem(getDailyTargetConfigStorageKey(uid));
    } else {
      localStorage.removeItem(getDailyTargetStateStorageKey('guest'));
      localStorage.removeItem(getDailyTargetConfigStorageKey('guest'));
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY_DAILY_TARGET_STATE);
    localStorage.removeItem(LEGACY_STORAGE_KEY_DAILY_TARGET_CONFIG);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('daily-target-updated'));
    }
  } catch {
    // ignore
  }
}


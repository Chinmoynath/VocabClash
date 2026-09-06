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

const STORAGE_KEY_DAILY_TARGET_CONFIG = 'vocabclash_daily_target_config_v2';
const STORAGE_KEY_DAILY_TARGET_STATE = 'vocabclash_daily_target_state_v2';

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

export function getDailyTargetConfig(): DailyTargetConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_TARGET_CONFIG);
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

export function saveDailyTargetConfig(config: DailyTargetConfig): void {
  const sanitizedTarget = Math.max(MIN_DAILY_TARGET, Math.min(MAX_DAILY_TARGET, Math.round(config.targetQuestions)));
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_TARGET_CONFIG, JSON.stringify({ targetQuestions: sanitizedTarget }));
    // Also update today's state target
    const state = getDailyTargetState();
    state.targetQuestions = sanitizedTarget;
    saveDailyTargetState(state);
  } catch {
    // ignore
  }
}

export function getDailyTargetState(): DailyTargetState {
  const today = getTodayDateString();
  const config = getDailyTargetConfig();

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_TARGET_STATE);
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

  // New day or first run
  const fresh: DailyTargetState = {
    date: today,
    targetQuestions: config.targetQuestions,
    questionsSolvedToday: 0,
    isRewardClaimed: false,
    lastUpdated: Date.now(),
  };

  saveDailyTargetState(fresh);
  return fresh;
}

export function saveDailyTargetState(state: DailyTargetState): void {
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_TARGET_STATE, JSON.stringify(state));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('daily-target-updated', { detail: state }));
    }
  } catch {
    // ignore
  }
}

export function recordQuestionSolvedForDailyTarget(count: number = 1): DailyTargetState {
  const state = getDailyTargetState();
  const prevSolved = state.questionsSolvedToday;
  state.questionsSolvedToday += count;
  state.lastUpdated = Date.now();
  saveDailyTargetState(state);

  // GA4 Tracking: 10 legitimate questions answered milestone (once per day)
  checkAndTrackQuestion10(state.questionsSolvedToday);

  // GA4 Tracking: Daily goal crossed target (e.g. 29 -> 30, once per day)
  if (prevSolved < state.targetQuestions && state.questionsSolvedToday >= state.targetQuestions) {
    checkAndTrackDailyGoalComplete(state.targetQuestions);
  }

  return state;
}

export function claimDailyTargetReward(): { success: boolean; rewardLP: number; state: DailyTargetState } {
  const state = getDailyTargetState();
  const isReached = state.questionsSolvedToday >= state.targetQuestions;

  if (!isReached || state.isRewardClaimed) {
    return { success: false, rewardLP: 0, state };
  }

  state.isRewardClaimed = true;
  state.lastUpdated = Date.now();
  saveDailyTargetState(state);

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

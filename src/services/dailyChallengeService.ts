import { QuestionCategory, PlayerProfile } from '../types';

export interface DailyChallengeAttempt {
  date: string; // ISO format "YYYY-MM-DD"
  timestamp: number;
  totalQuestions: number; // usually 20
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  score: number; // Marks (e.g. 1 mark per correct or total marks)
  maxMarks: number; // usually 20
  percentage: number; // Accuracy percentage (0-100)
  timeTakenSeconds: number; // Seconds spent (out of 120s)
  categoryBreakdown?: Record<QuestionCategory, { total: number; correct: number }>;
  rankPointsAwarded?: number;
}

// Clean v2 storage key without fake simulated benchmark data
const STORAGE_KEY_V2 = 'vocabclash_daily_challenge_v2';
const OLD_STORAGE_KEY = 'vocabclash_daily_challenge_history';

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string for display (e.g. "15 Sep" or "Sep 15")
 */
export function formatDisplayDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Migrates and cleans any legacy seeded dates so only genuine attempts are stored.
 */
function cleanAndGetLocalHistory(): DailyChallengeAttempt[] {
  if (typeof window === 'undefined') return [];
  try {
    // Check if new clean storage exists
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    // Check old storage: ONLY preserve today's real attempt if present, drop all fake seeded past dates
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    const cleaned: DailyChallengeAttempt[] = [];
    if (oldRaw) {
      try {
        const oldParsed = JSON.parse(oldRaw);
        const todayStr = getTodayDateString();
        if (Array.isArray(oldParsed)) {
          // Keep only today's attempt if the user actually played today
          const todayItem = oldParsed.find((item: any) => item && item.date === todayStr);
          if (todayItem) {
            cleaned.push(todayItem);
          }
        }
      } catch {
        // ignore parse error
      }
      // Remove old key with fake seeded data
      localStorage.removeItem(OLD_STORAGE_KEY);
    }

    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(cleaned));
    return cleaned;
  } catch (err) {
    console.warn('[Daily Challenge] Failed to read local history:', err);
    return [];
  }
}

/**
 * Loads the genuine daily challenge history (no fake seed data).
 */
export function getDailyChallengeHistory(): DailyChallengeAttempt[] {
  return cleanAndGetLocalHistory();
}

/**
 * Checks if the user has completed today's daily challenge
 */
export function getTodayChallengeAttempt(): DailyChallengeAttempt | null {
  const history = getDailyChallengeHistory();
  const today = getTodayDateString();
  return history.find(a => a.date === today) || null;
}

/**
 * Returns true if today's challenge was already attempted
 */
export function hasCompletedTodayChallenge(): boolean {
  return getTodayChallengeAttempt() !== null;
}

/**
 * Saves a completed daily challenge attempt both locally and to the backend server.
 */
export function saveDailyChallengeAttempt(
  attempt: DailyChallengeAttempt,
  player?: PlayerProfile
): { history: DailyChallengeAttempt[]; rankPointsGained: number } {
  const history = getDailyChallengeHistory().filter(a => a.date !== attempt.date);
  
  // Calculate bonus LP for the daily challenge
  const rankPointsGained = 25 + attempt.correctCount * 2;
  const finalizedAttempt: DailyChallengeAttempt = {
    ...attempt,
    rankPointsAwarded: rankPointsGained,
  };
  
  history.push(finalizedAttempt);
  history.sort((a, b) => a.date.localeCompare(b.date));
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(history));
    } catch (err) {
      console.error('[Daily Challenge] Failed to save attempt locally:', err);
    }
  }

  // Update player LP in localStorage profile if present
  if (player && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('vocabclash_player_profile');
      if (stored) {
        const p = JSON.parse(stored);
        p.rankPoints = (p.rankPoints || 0) + rankPointsGained;
        p.matchesPlayed = (p.matchesPlayed || 0) + 1;
        p.matchesWon = attempt.percentage >= 60 ? (p.matchesWon || 0) + 1 : p.matchesWon;
        localStorage.setItem('vocabclash_player_profile', JSON.stringify(p));
      }
    } catch {
      // Ignore sync error
    }
  }

  // Sync with Backend Server API (asynchronous)
  const userId = player?.id || player?.name || 'default_user';
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

  return { history, rankPointsGained };
}

/**
 * Fetches server history and syncs with client local history.
 */
export async function syncDailyChallengeWithBackend(userId: string = 'default_user'): Promise<DailyChallengeAttempt[]> {
  try {
    const res = await fetch(`/api/daily-challenge/history?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.history)) {
        const local = getDailyChallengeHistory();
        const map = new Map<string, DailyChallengeAttempt>();
        
        // Merge genuine records by date
        local.forEach(item => map.set(item.date, item));
        data.history.forEach((item: DailyChallengeAttempt) => map.set(item.date, item));

        const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(merged));
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('[Daily Challenge] Backend fetch notice:', err);
  }
  return getDailyChallengeHistory();
}

/**
 * Formats seconds into MM:SS string (e.g. 1m 24s)
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Returns remaining time until midnight (next daily reset)
 */
export function getTimeUntilNextReset(): { hours: number; minutes: number; seconds: number; formatted: string } {
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

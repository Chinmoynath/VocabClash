import { QuestionCategory } from '../types';

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
  timeTakenSeconds: number; // Seconds spent (0-120)
  categoryBreakdown?: Record<QuestionCategory, { total: number; correct: number }>;
  rankPointsAwarded?: number;
  userId?: string;
  userEmail?: string;
}

export interface DailyChallengeReportStats {
  avgAccuracy: number | null; // e.g. 36.8 or null if 0 attempts
  avgSpeed: number; // Average total challenge completion duration in seconds
  bestScore: number; // Maximum marks scored out of 20
  completedDays: number; // Unique calendar days with a completed challenge in window
  totalAttempts: number;
  latestAttempt: DailyChallengeAttempt | null;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in India Standard Time (Asia/Kolkata).
 * Ensures a single synchronized calendar date for all users worldwide.
 */
export function getTodayDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    let year = '';
    let month = '';
    let day = '';
    for (const part of parts) {
      if (part.type === 'year') year = part.value;
      if (part.type === 'month') month = part.value.padStart(2, '0');
      if (part.type === 'day') day = part.value.padStart(2, '0');
    }
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {}

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
 * Formats seconds into MM:SS or Xs string (e.g. "47s", "1m 24s")
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0s';
  }
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Normalizes any historical, cloud, or client Daily Challenge attempt into
 * a canonical, strictly typed DailyChallengeAttempt object.
 * Guarantees finite numbers for all metrics, eliminating NaN, undefined, or malformed values.
 */
export function normalizeDailyChallengeAttempt(raw: any): DailyChallengeAttempt | null {
  if (!raw || typeof raw !== 'object') return null;

  // 1. Date string validation (YYYY-MM-DD)
  let date = typeof raw.date === 'string' ? raw.date.trim() : '';
  if (!date && typeof raw.dateKey === 'string') {
    date = raw.dateKey.trim();
  }
  if (!date && raw.timestamp && typeof raw.timestamp === 'number' && isFinite(raw.timestamp)) {
    try {
      date = getTodayDateString(new Date(raw.timestamp));
    } catch {}
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.warn('[Daily Challenge Normalizer] Excluded record with invalid date:', raw);
    return null;
  }

  // 2. Total Questions & Max Marks
  const totalQuestions =
    typeof raw.totalQuestions === 'number' && isFinite(raw.totalQuestions) && raw.totalQuestions > 0
      ? raw.totalQuestions
      : typeof raw.total === 'number' && isFinite(raw.total) && raw.total > 0
      ? raw.total
      : typeof raw.maxMarks === 'number' && isFinite(raw.maxMarks) && raw.maxMarks > 0
      ? raw.maxMarks
      : 20;

  // 3. Score (Marks)
  const scoreRaw = raw.score ?? raw.correctCount ?? raw.correct;
  let score = 0;
  if (typeof scoreRaw === 'number' && isFinite(scoreRaw)) {
    score = Math.max(0, Math.min(totalQuestions, Math.round(scoreRaw)));
  } else if (typeof scoreRaw === 'string') {
    const parsed = parseInt(scoreRaw, 10);
    if (isFinite(parsed)) score = Math.max(0, Math.min(totalQuestions, parsed));
  }

  const correctCount =
    typeof raw.correctCount === 'number' && isFinite(raw.correctCount)
      ? Math.max(0, Math.min(totalQuestions, raw.correctCount))
      : typeof raw.correct === 'number' && isFinite(raw.correct)
      ? Math.max(0, Math.min(totalQuestions, raw.correct))
      : score;

  const answeredCount =
    typeof raw.answeredCount === 'number' && isFinite(raw.answeredCount)
      ? Math.max(correctCount, Math.min(totalQuestions, raw.answeredCount))
      : typeof raw.answered === 'number' && isFinite(raw.answered)
      ? Math.max(correctCount, Math.min(totalQuestions, raw.answered))
      : totalQuestions;

  const wrongCount = Math.max(0, answeredCount - correctCount);

  // 4. Accuracy Percentage (0 - 100)
  // Accommodates raw.percentage, raw.accuracy, string forms like "40%", or safely derives from score/totalQuestions
  let percentage: number;
  const rawPercentage = raw.percentage ?? raw.accuracy;
  if (typeof rawPercentage === 'number' && isFinite(rawPercentage) && !isNaN(rawPercentage)) {
    if (rawPercentage > 0 && rawPercentage <= 1 && totalQuestions > 1) {
      percentage = Math.round(rawPercentage * 100 * 10) / 10;
    } else {
      percentage = Math.min(100, Math.max(0, Math.round(rawPercentage * 10) / 10));
    }
  } else if (typeof rawPercentage === 'string') {
    const cleaned = parseFloat(rawPercentage.replace('%', '').trim());
    if (isFinite(cleaned) && !isNaN(cleaned)) {
      if (cleaned > 0 && cleaned <= 1 && totalQuestions > 1) {
        percentage = Math.round(cleaned * 100 * 10) / 10;
      } else {
        percentage = Math.min(100, Math.max(0, Math.round(cleaned * 10) / 10));
      }
    } else {
      percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100 * 10) / 10 : 0;
    }
  } else {
    percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100 * 10) / 10 : 0;
  }

  // 5. Duration (Seconds)
  // Accommodates raw.timeTakenSeconds, raw.speed, raw.timeTaken, raw.duration, raw.elapsedTime, raw.time
  const rawDuration =
    raw.timeTakenSeconds ??
    raw.speed ??
    raw.timeTaken ??
    raw.duration ??
    raw.elapsedTime ??
    raw.time;

  let timeTakenSeconds = 0;
  if (typeof rawDuration === 'number' && isFinite(rawDuration) && !isNaN(rawDuration)) {
    if (rawDuration > 1000 && rawDuration <= 600000 && rawDuration % 1000 === 0) {
      timeTakenSeconds = Math.round(rawDuration / 1000);
    } else {
      timeTakenSeconds = Math.max(0, Math.round(rawDuration));
    }
  } else if (typeof rawDuration === 'string') {
    const s = rawDuration.trim();
    if (/^\d+(\.\d+)?s$/i.test(s)) {
      timeTakenSeconds = Math.max(0, Math.round(parseFloat(s)));
    } else if (/^\d+:\d+$/.test(s)) {
      const [m, sc] = s.split(':').map(Number);
      timeTakenSeconds = (m || 0) * 60 + (sc || 0);
    } else {
      const mMatch = s.match(/(?:(\d+)m)?\s*(?:(\d+)s)?/i);
      if (mMatch && (mMatch[1] || mMatch[2])) {
        const mins = mMatch[1] ? parseInt(mMatch[1], 10) : 0;
        const secs = mMatch[2] ? parseInt(mMatch[2], 10) : 0;
        timeTakenSeconds = mins * 60 + secs;
      } else {
        const num = parseFloat(s);
        if (isFinite(num) && !isNaN(num)) {
          timeTakenSeconds = Math.max(0, Math.round(num));
        }
      }
    }
  }

  // 6. Timestamp
  const timestampRaw = raw.timestamp ?? raw.completedAt ?? raw.updatedAt;
  let timestamp = Date.now();
  if (typeof timestampRaw === 'number' && isFinite(timestampRaw) && timestampRaw > 0) {
    timestamp = timestampRaw;
  }

  // 7. Rank points awarded
  const rankPointsAwarded =
    typeof raw.rankPointsAwarded === 'number' && isFinite(raw.rankPointsAwarded)
      ? raw.rankPointsAwarded
      : typeof raw.lpEarned === 'number' && isFinite(raw.lpEarned)
      ? raw.lpEarned
      : 0;

  return {
    date,
    timestamp,
    totalQuestions,
    answeredCount,
    correctCount,
    wrongCount,
    score,
    maxMarks: totalQuestions,
    percentage,
    timeTakenSeconds,
    rankPointsAwarded,
    categoryBreakdown: raw.categoryBreakdown,
    userId: raw.userId || raw.uid,
    userEmail: raw.userEmail,
  };
}

/**
 * Deduplicates and sorts challenge attempts by date ascending, ensuring
 * exactly one canonical attempt per calendar date.
 * Strictly preserves the existing product semantics of saveDailyChallengeAttempt & server.ts
 * where the latest completed attempt of the day is the official active result.
 */
export function deduplicateDailyChallengeHistory(attempts: any[]): DailyChallengeAttempt[] {
  if (!Array.isArray(attempts)) return [];

  const map = new Map<string, DailyChallengeAttempt>();

  for (const item of attempts) {
    const normalized = normalizeDailyChallengeAttempt(item);
    if (!normalized) continue;

    const existing = map.get(normalized.date);
    if (!existing) {
      map.set(normalized.date, normalized);
    } else {
      // The latest completed attempt represents the official daily challenge result
      if (normalized.timestamp >= existing.timestamp) {
        map.set(normalized.date, normalized);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculates the calendar day offset between an attempt date and the 30-day window start date (0 to 29).
 */
export function getCalendarDayOffset(dateStr: string, startDateStr: string): number {
  try {
    const [y1, m1, d1] = dateStr.split('-').map(Number);
    const [y0, m0, d0] = startDateStr.split('-').map(Number);
    const dateObj = new Date(y1, m1 - 1, d1);
    const startObj = new Date(y0, m0 - 1, d0);
    const diffMs = dateObj.getTime() - startObj.getTime();
    return Math.max(0, Math.min(29, Math.round(diffMs / (1000 * 60 * 60 * 24))));
  } catch {
    return 0;
  }
}

/**
 * Returns the rolling 30-calendar-day range ending today in India Standard Time.
 * (e.g. today Oct 2 -> startDate Sep 3, endDate Oct 2 inclusive = 30 calendar days).
 */
export function getLast30DaysRange(todayStr: string = getTodayDateString()): { startDate: string; endDate: string } {
  const [y, m, d] = todayStr.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const past30 = new Date(today);
  past30.setDate(past30.getDate() - 29); // 30 calendar days inclusive
  const startYear = past30.getFullYear();
  const startMonth = String(past30.getMonth() + 1).padStart(2, '0');
  const startDay = String(past30.getDate()).padStart(2, '0');
  return {
    startDate: `${startYear}-${startMonth}-${startDay}`,
    endDate: todayStr,
  };
}

/**
 * Filters normalized challenge attempts to ONLY those falling within the last 30 calendar days.
 * Older records remain safely stored in Firebase and local storage; they are only filtered for report display.
 */
export function getLast30DaysChallengeAttempts(
  history: any[],
  todayStr: string = getTodayDateString()
): DailyChallengeAttempt[] {
  const deduplicated = deduplicateDailyChallengeHistory(history);
  const { startDate, endDate } = getLast30DaysRange(todayStr);

  return deduplicated.filter(attempt => attempt.date >= startDate && attempt.date <= endDate);
}

/**
 * Computes deterministic aggregate statistics from valid challenge attempts within the 30-day window.
 * Missing days are NOT counted as zeroes and do NOT penalize averages.
 */
export function calculateDailyChallengeReportStats(attempts: DailyChallengeAttempt[]): DailyChallengeReportStats {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    return {
      avgAccuracy: null,
      avgSpeed: 0,
      bestScore: 0,
      completedDays: 0,
      totalAttempts: 0,
      latestAttempt: null,
    };
  }

  const total = attempts.length;
  let sumAcc = 0;
  let sumTime = 0;
  let maxScore = 0;

  for (const att of attempts) {
    sumAcc += att.percentage;
    sumTime += att.timeTakenSeconds;
    if (att.score > maxScore) {
      maxScore = att.score;
    }
  }

  return {
    avgAccuracy: Math.round((sumAcc / total) * 10) / 10,
    avgSpeed: Math.round(sumTime / total),
    bestScore: maxScore,
    completedDays: total,
    totalAttempts: total,
    latestAttempt: attempts[attempts.length - 1],
  };
}

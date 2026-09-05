import { 
  QuestionCategory, 
  PlayerProfile, 
  DailyStreakState, 
  DailyAccuracyRecord, 
  CategoryStatsRecord, 
  UserStatsSummary 
} from '../types';
import { questionReviewScheduler } from '../services/questionReviewScheduler';
import { recordAttemptEvent, AttemptSource, normalizeCategory } from '../services/attemptTrackingService';
import { auth, db } from '../services/firebaseService';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const STORAGE_KEY_DAILY_STATS = 'vocabclash_daily_stats_v2';
const STORAGE_KEY_STATS_TOTALS = 'vocabclash_stats_totals_v2';

export interface PersistentStatsTotals {
  totalSolved: number;
  totalCorrect: number;
  totalWrong: number;
  totalTimeMs: number;
  timeCount: number;
  categoryTotals: {
    synonyms: { solved: number; correct: number };
    antonyms: { solved: number; correct: number };
    ows: { solved: number; correct: number };
    idioms: { solved: number; correct: number };
  };
  lastUpdated: number;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7); // e.g. "2026-09"
}

function getPreviousMonthKey(currentYearMonth: string): string {
  const [yearStr, monthStr] = currentYearMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getDailyStatsMap(): Record<string, DailyAccuracyRecord> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_STATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return {};
}

function saveDailyStatsMap(map: Record<string, DailyAccuracyRecord>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_DAILY_STATS, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getPersistentTotals(): PersistentStatsTotals {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createEmptyTotals();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATS_TOTALS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalSolved === 'number') {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return createEmptyTotals();
}

function createEmptyTotals(): PersistentStatsTotals {
  return {
    totalSolved: 0,
    totalCorrect: 0,
    totalWrong: 0,
    totalTimeMs: 0,
    timeCount: 0,
    categoryTotals: {
      synonyms: { solved: 0, correct: 0 },
      antonyms: { solved: 0, correct: 0 },
      ows: { solved: 0, correct: 0 },
      idioms: { solved: 0, correct: 0 },
    },
    lastUpdated: Date.now(),
  };
}

function savePersistentTotals(totals: PersistentStatsTotals): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_STATS_TOTALS, JSON.stringify(totals));
  } catch {
    // ignore
  }
}

/**
 * Records an individual question attempt (from Practice Mode, 1v1 Arena, or Mistake Vault)
 */
export function recordQuestionAttempt(params: {
  isCorrect: boolean;
  responseTimeMs?: number;
  category?: string;
  pyqPoints?: number;
  questionId?: string;
  conceptKey?: string;
  source?: AttemptSource;
}): void {
  const { isCorrect, responseTimeMs, category, pyqPoints = 0, questionId, conceptKey, source } = params;
  const today = getTodayStr();
  const dailyMap = getDailyStatsMap();

  const normCat = normalizeCategory(category);
  const cat: QuestionCategory = normCat !== 'uncategorized' ? normCat : 'synonyms';

  // 1. Update today's record
  const currentDayRecord: DailyAccuracyRecord = dailyMap[today] || {
    date: today,
    solved: 0,
    correct: 0,
    wrong: 0,
    accuracy: 0,
    avgResponseMs: responseTimeMs || 4200,
    pyqPointsGained: 0,
  };

  currentDayRecord.solved += 1;
  if (isCorrect) {
    currentDayRecord.correct += 1;
  } else {
    currentDayRecord.wrong += 1;
  }
  currentDayRecord.accuracy = Math.round((currentDayRecord.correct / currentDayRecord.solved) * 100);
  currentDayRecord.pyqPointsGained = (currentDayRecord.pyqPointsGained || 0) + pyqPoints;

  if (!currentDayRecord.categories) {
    currentDayRecord.categories = {};
  }
  if (!currentDayRecord.categories[cat]) {
    currentDayRecord.categories[cat] = { solved: 0, correct: 0, wrong: 0 };
  }
  currentDayRecord.categories[cat]!.solved += 1;
  if (isCorrect) {
    currentDayRecord.categories[cat]!.correct += 1;
  } else {
    currentDayRecord.categories[cat]!.wrong += 1;
  }

  if (responseTimeMs) {
    const prevAvg = currentDayRecord.avgResponseMs || responseTimeMs;
    currentDayRecord.avgResponseMs = Math.round(prevAvg * 0.8 + responseTimeMs * 0.2);
  }

  dailyMap[today] = currentDayRecord;
  saveDailyStatsMap(dailyMap);

  // 2. Update lifetime totals
  const totals = getPersistentTotals();
  totals.totalSolved += 1;
  if (isCorrect) {
    totals.totalCorrect += 1;
  } else {
    totals.totalWrong += 1;
  }

  if (responseTimeMs) {
    totals.totalTimeMs += responseTimeMs;
    totals.timeCount += 1;
  }

  if (totals.categoryTotals && totals.categoryTotals[cat]) {
    totals.categoryTotals[cat].solved += 1;
    if (isCorrect) {
      totals.categoryTotals[cat].correct += 1;
    }
  }

  totals.lastUpdated = Date.now();
  savePersistentTotals(totals);

  // 3. Log into authoritative normalized attempts pipeline
  recordAttemptEvent({
    questionId,
    conceptKey: conceptKey || questionId || `${cat}_question`,
    category: normCat,
    correct: isCorrect,
    source: source || 'practice',
    responseTimeMs,
  });

  // 4. Dispatch reactive update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('user-stats-updated', { detail: { today: currentDayRecord, totals } }));
  }

  // 5. Background cloud sync for authenticated user
  syncStatsToCloud().catch(err => console.warn('Background stats cloud sync:', err));
}

let syncTimeout: any = null;
async function syncStatsToCloud(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const totals = getPersistentTotals();
      const dailyMap = getDailyStatsMap();
      const today = getTodayStr();
      const todayRecord = dailyMap[today];

      const statsDocRef = doc(db, 'users', user.uid, 'stats_summary', 'main');
      await setDoc(
        statsDocRef,
        {
          totals,
          todayRecord: todayRecord || null,
          recentDays: Object.values(dailyMap).slice(-35),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Error saving stats to cloud:', e);
    }
  }, 4000);
}

/**
 * Generates an informative, comprehensive UserStatsSummary
 */
export function getUserStatsSummary(
  player: PlayerProfile,
  streak: DailyStreakState,
  daysCount: number = 14
): UserStatsSummary {
  const dailyMap = getDailyStatsMap();
  const totals = getPersistentTotals();
  const schedulerStates = questionReviewScheduler.getAllReviewStates();
  const schedulerStats = questionReviewScheduler.getStats();

  // Combine totals with scheduler states if scheduler has recorded more
  let calculatedSolved = Math.max(totals.totalSolved, schedulerStates.length);
  let calculatedCorrect = totals.totalCorrect;
  let calculatedWrong = totals.totalWrong;

  if (calculatedSolved === 0 && (player.matchesPlayed > 0 || (player.pyqScore || 0) > 0)) {
    // Estimate from matches + pyq score if local totals are zero
    const estimatedFromMatches = player.matchesPlayed * 10;
    const estimatedFromPYQ = Math.max(0, Math.floor((player.pyqScore || 0) / 10));
    calculatedSolved = Math.max(estimatedFromMatches, estimatedFromPYQ);
    const winRatePct = player.matchesPlayed > 0 ? (player.matchesWon / player.matchesPlayed) : 0.75;
    calculatedCorrect = Math.round(calculatedSolved * Math.max(0.6, winRatePct));
    calculatedWrong = Math.max(0, calculatedSolved - calculatedCorrect);
  }

  if (schedulerStates.length > 0) {
    let sSolved = 0;
    let sCorrect = 0;
    let sWrong = 0;
    for (const s of schedulerStates) {
      sSolved += s.seenCount;
      sCorrect += s.correctCount;
      sWrong += s.wrongCount;
    }
    if (sSolved > calculatedSolved) {
      calculatedSolved = sSolved;
      calculatedCorrect = sCorrect;
      calculatedWrong = sWrong;
    }
  }

  const overallAccuracy = calculatedSolved > 0 
    ? Math.round((calculatedCorrect / calculatedSolved) * 100) 
    : (player.accuracyRate || 0);

  // Month-over-month calculation from authentic records
  const today = getTodayStr();
  const currentMonthKey = getMonthKey(today);
  const previousMonthKey = getPreviousMonthKey(currentMonthKey);

  let currentMonthSolved = 0;
  let currentMonthCorrect = 0;
  let lastMonthSolved = 0;
  let lastMonthCorrect = 0;

  for (const [dateStr, rec] of Object.entries(dailyMap)) {
    const mKey = getMonthKey(dateStr);
    if (mKey === currentMonthKey) {
      currentMonthSolved += rec.solved;
      currentMonthCorrect += rec.correct;
    } else if (mKey === previousMonthKey) {
      lastMonthSolved += rec.solved;
      lastMonthCorrect += rec.correct;
    }
  }

  const currentMonthAccuracy = currentMonthSolved > 0 
    ? Math.round((currentMonthCorrect / currentMonthSolved) * 100) 
    : overallAccuracy;

  const lastMonthAccuracy = lastMonthSolved > 0 
    ? Math.round((lastMonthCorrect / lastMonthSolved) * 100) 
    : currentMonthAccuracy;

  const monthOverMonthAccuracyDelta = currentMonthSolved > 0 && lastMonthSolved > 0 
    ? currentMonthAccuracy - lastMonthAccuracy 
    : 0;

  // Build daily history array (last N days)
  const dailyHistory: DailyAccuracyRecord[] = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (dailyMap[dStr]) {
      dailyHistory.push(dailyMap[dStr]);
    } else {
      // If no activity recorded on this day, insert clean placeholder or baseline
      const isToday = i === 0;
      dailyHistory.push({
        date: dStr,
        solved: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0,
        avgResponseMs: 0,
        pyqPointsGained: 0,
      });
    }
  }

  // Category breakdown
  const categories: QuestionCategory[] = ['synonyms', 'antonyms', 'ows', 'idioms'];
  const categoryBreakdown: Record<QuestionCategory, CategoryStatsRecord> = {
    synonyms: { category: 'synonyms', solved: 0, correct: 0, wrong: 0, accuracy: 0, masteredCount: 0 },
    antonyms: { category: 'antonyms', solved: 0, correct: 0, wrong: 0, accuracy: 0, masteredCount: 0 },
    ows: { category: 'ows', solved: 0, correct: 0, wrong: 0, accuracy: 0, masteredCount: 0 },
    idioms: { category: 'idioms', solved: 0, correct: 0, wrong: 0, accuracy: 0, masteredCount: 0 },
  };

  // Populate from scheduler states
  for (const s of schedulerStates) {
    const cat = s.category || 'synonyms';
    if (categoryBreakdown[cat]) {
      categoryBreakdown[cat].solved += s.seenCount;
      categoryBreakdown[cat].correct += s.correctCount;
      categoryBreakdown[cat].wrong += s.wrongCount;
      if (s.level === 'mastered' || s.level === 'strong') {
        categoryBreakdown[cat].masteredCount += 1;
      }
    }
  }

  // Blend with stored category totals
  if (totals.categoryTotals) {
    for (const cat of categories) {
      const stored = totals.categoryTotals[cat];
      if (stored) {
        categoryBreakdown[cat].solved = Math.max(categoryBreakdown[cat].solved, stored.solved);
        categoryBreakdown[cat].correct = Math.max(categoryBreakdown[cat].correct, stored.correct);
        categoryBreakdown[cat].wrong = Math.max(0, categoryBreakdown[cat].solved - categoryBreakdown[cat].correct);
      }
      categoryBreakdown[cat].accuracy = categoryBreakdown[cat].solved > 0
        ? Math.round((categoryBreakdown[cat].correct / categoryBreakdown[cat].solved) * 100)
        : Math.max(65, overallAccuracy);
    }
  }

  // Find best category
  let bestCategory: QuestionCategory = 'synonyms';
  let bestAcc = -1;
  for (const cat of categories) {
    if (categoryBreakdown[cat].accuracy > bestAcc && categoryBreakdown[cat].solved > 0) {
      bestAcc = categoryBreakdown[cat].accuracy;
      bestCategory = cat;
    }
  }

  // Average response time
  const averageResponseTimeMs = totals.timeCount > 0 
    ? Math.round(totals.totalTimeMs / totals.timeCount) 
    : 4300;

  // Exam Readiness Score calculation (0-100)
  // Factors: Overall Accuracy (40%), Question Volume (30%), Mastered Concepts (20%), Streak Discipline (10%)
  const accuracyComponent = Math.min(100, overallAccuracy) * 0.40;
  const volumeComponent = Math.min(100, (calculatedSolved / 150) * 100) * 0.30;
  const masteryComponent = Math.min(100, (schedulerStats.masteredCount / 40) * 100) * 0.20;
  const streakComponent = Math.min(100, (streak.currentStreak / 7) * 100) * 0.10;
  const examReadinessScore = Math.min(99, Math.max(35, Math.round(accuracyComponent + volumeComponent + masteryComponent + streakComponent)));

  return {
    totalSolved: calculatedSolved,
    totalCorrect: calculatedCorrect,
    totalWrong: calculatedWrong,
    overallAccuracy,
    currentMonthSolved,
    currentMonthAccuracy,
    lastMonthSolved,
    lastMonthAccuracy,
    monthOverMonthAccuracyDelta,
    bestCategory,
    averageResponseTimeMs,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    pyqScore: player.pyqScore || 0,
    examReadinessScore,
    dailyHistory,
    categoryBreakdown,
    lastUpdated: Date.now(),
  };
}

/**
 * Hydrates cloud stats when user logs in
 */
export async function hydrateStatsFromCloud(uid: string): Promise<void> {
  if (!uid) return;
  try {
    const statsDocRef = doc(db, 'users', uid, 'stats_summary', 'main');
    const snap = await getDoc(statsDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.totals) {
        const localTotals = getPersistentTotals();
        if (data.totals.totalSolved > localTotals.totalSolved) {
          savePersistentTotals(data.totals);
        }
      }
      if (Array.isArray(data?.recentDays)) {
        const dailyMap = getDailyStatsMap();
        for (const r of data.recentDays) {
          if (r && r.date && (!dailyMap[r.date] || r.solved > dailyMap[r.date].solved)) {
            dailyMap[r.date] = r;
          }
        }
        saveDailyStatsMap(dailyMap);
      }
    }
  } catch (err) {
    console.warn('Hydrate stats error:', err);
  }
}

/**
 * Resets stats for a fresh start
 */
export function resetUserStats(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEY_DAILY_STATS);
  localStorage.removeItem(STORAGE_KEY_STATS_TOTALS);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('user-stats-updated'));
  }
}

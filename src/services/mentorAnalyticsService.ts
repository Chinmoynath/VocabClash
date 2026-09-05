import { 
  QuestionCategory, 
  PlayerProfile, 
  DailyStreakState, 
  SavedWord,
  MentorPeriod,
  MentorAnalytics,
  MentorCategoryStat,
  RepeatedMistakeItem
} from '../types';
import { 
  NormalizedAttempt, 
  getAuthoritativeAttempts,
  getISTCalendarWeekRange,
  getISTPreviousWeekRange,
  getISTCalendarMonthRange,
  getISTPreviousMonthRange,
  getISTDate
} from './attemptTrackingService';
import { questionReviewScheduler } from './questionReviewScheduler';
import { isItemMistake } from '../utils/vaultManager';

export const MIN_SAMPLE_THRESHOLD = 5; // Minimum attempts in selected period to determine strongest/weakest category
export const MIN_USER_QUESTIONS_FOR_FULL_REPORT = 20; // Minimum user questions to unlock full coaching

export const CATEGORY_DISPLAY_NAMES: Record<QuestionCategory, { name: string; hindi: string }> = {
  antonyms: { name: 'Antonyms', hindi: 'विलोम शब्द' },
  synonyms: { name: 'Synonyms', hindi: 'समानार्थी शब्द' },
  ows: { name: 'One Word Substitution', hindi: 'अनेक शब्दों के लिए एक शब्द' },
  idioms: { name: 'Idioms & Phrases', hindi: 'मुहावरे एवं लोकोक्तियाँ' },
};

function getWeekNumberIST(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function getPeriodKey(period: MentorPeriod, date: Date = new Date()): string {
  const istDate = getISTDate(date.getTime());
  const y = istDate.getUTCFullYear();
  if (period === 'week') {
    const w = getWeekNumberIST(istDate);
    return `week_${y}_W${String(w).padStart(2, '0')}`;
  }
  if (period === 'month') {
    const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    return `month_${y}_${m}`;
  }
  return 'all_time';
}

/**
 * Builds deterministic MentorAnalytics strictly from ONE authoritative normalized attempts dataset.
 * 
 * Invariants strictly enforced:
 * 1. ALL_TIME_ATTEMPTS >= MONTH_ATTEMPTS and ALL_TIME_ATTEMPTS >= WEEK_ATTEMPTS
 * 2. totalCorrect + totalWrong === totalAttempted
 * 3. category.correct + category.wrong === category.attempted
 * 4. sum(category.attempted) + uncategorized === totalAttempted
 * 5. Deterministic accuracy calculations: (correct / attempted) * 100 or null if attempted === 0
 */
export function buildMentorAnalytics(
  period: MentorPeriod,
  allAttempts: NormalizedAttempt[],
  player: PlayerProfile,
  streak: DailyStreakState,
  savedWords: SavedWord[]
): MentorAnalytics {
  const now = Date.now();
  const weekRange = getISTCalendarWeekRange(now);
  const prevWeekRange = getISTPreviousWeekRange(now);
  const monthRange = getISTCalendarMonthRange(now);
  const prevMonthRange = getISTPreviousMonthRange(now);

  // 1. Derive Period Subsets from the exact same dataset
  let periodAttempts: NormalizedAttempt[];
  let prevPeriodAttempts: NormalizedAttempt[];
  let periodLabel: string;
  let previousPeriodLabel: string | undefined;

  if (period === 'week') {
    periodLabel = weekRange.label;
    previousPeriodLabel = prevWeekRange.label;
    // Only timestamped attempts falling inside current IST calendar week (Mon 00:00 to Sun 23:59 IST)
    periodAttempts = allAttempts.filter(
      a => a.hasReliableTimestamp && a.answeredAt >= weekRange.startMs && a.answeredAt <= weekRange.endMs
    );
    prevPeriodAttempts = allAttempts.filter(
      a => a.hasReliableTimestamp && a.answeredAt >= prevWeekRange.startMs && a.answeredAt <= prevWeekRange.endMs
    );
  } else if (period === 'month') {
    periodLabel = monthRange.label;
    previousPeriodLabel = prevMonthRange.label;
    // Only timestamped attempts falling inside current IST calendar month (1st 00:00 IST to month end)
    periodAttempts = allAttempts.filter(
      a => a.hasReliableTimestamp && a.answeredAt >= monthRange.startMs && a.answeredAt <= monthRange.endMs
    );
    prevPeriodAttempts = allAttempts.filter(
      a => a.hasReliableTimestamp && a.answeredAt >= prevMonthRange.startMs && a.answeredAt <= prevMonthRange.endMs
    );
  } else {
    // All Time: contains every legitimate known historical attempt
    periodLabel = 'All Time';
    previousPeriodLabel = undefined;
    periodAttempts = allAttempts;
    prevPeriodAttempts = [];
  }

  // 2. Period Overview Totals
  const totalAttempted = periodAttempts.length;
  const totalCorrect = periodAttempts.filter(a => a.correct).length;
  const totalWrong = totalAttempted - totalCorrect; // Strict invariant: totalCorrect + totalWrong === totalAttempted
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : null;

  // 3. Category Diagnostics
  const categories: QuestionCategory[] = ['antonyms', 'synonyms', 'ows', 'idioms'];
  const categoryStats: Record<QuestionCategory, MentorCategoryStat> = {} as any;
  let categorizedSum = 0;

  for (const cat of categories) {
    const catAttempts = periodAttempts.filter(a => a.category === cat);
    const attempted = catAttempts.length;
    const correct = catAttempts.filter(a => a.correct).length;
    const wrong = attempted - correct; // Invariant: correct + wrong === attempted
    const isTested = attempted > 0;
    const hasEnoughData = attempted >= MIN_SAMPLE_THRESHOLD;
    const acc = isTested ? Math.round((correct / attempted) * 100) : null;

    categorizedSum += attempted;

    let status: 'unattempted' | 'limited_data' | 'critical' | 'moderate' | 'strong' = 'unattempted';
    if (!isTested) {
      status = 'unattempted';
    } else if (!hasEnoughData) {
      status = 'limited_data';
    } else if (acc !== null && acc < 50) {
      status = 'critical';
    } else if (acc !== null && acc < 75) {
      status = 'moderate';
    } else {
      status = 'strong';
    }

    categoryStats[cat] = {
      category: cat,
      name: CATEGORY_DISPLAY_NAMES[cat].name,
      hindiName: CATEGORY_DISPLAY_NAMES[cat].hindi,
      attempted,
      correct,
      wrong,
      accuracy: acc,
      hasEnoughData,
      status,
    };
  }

  const uncategorizedCount = totalAttempted - categorizedSum;
  if (uncategorizedCount > 0) {
    console.debug(`[Vocab Mentor Diagnostics] ${period}: Total=${totalAttempted}, Categorized=${categorizedSum}, Uncategorized=${uncategorizedCount}`);
  }

  // 4. Strongest & Weakest Category
  // Only categories with >= MIN_SAMPLE_THRESHOLD (5) attempts in the SELECTED period qualify
  const eligibleCategories = categories.filter(c => categoryStats[c].hasEnoughData && categoryStats[c].accuracy !== null);
  let strongestCategory: QuestionCategory | null = null;
  let weakestCategory: QuestionCategory | null = null;

  if (eligibleCategories.length > 0) {
    // Sort ascending by accuracy
    eligibleCategories.sort((a, b) => (categoryStats[a].accuracy || 0) - (categoryStats[b].accuracy || 0));
    weakestCategory = eligibleCategories[0];
    strongestCategory = eligibleCategories[eligibleCategories.length - 1];

    if (eligibleCategories.length === 1) {
      // Single qualified category
      if ((categoryStats[weakestCategory].accuracy || 0) >= 70) {
        strongestCategory = weakestCategory;
        weakestCategory = null;
      } else {
        strongestCategory = null;
      }
    } else if (categoryStats[weakestCategory].accuracy === categoryStats[strongestCategory].accuracy) {
      // Equal accuracy across all qualified categories
      if ((categoryStats[weakestCategory].accuracy || 0) >= 70) {
        weakestCategory = null;
      } else {
        strongestCategory = null;
      }
    }
  }

  // 5. Comparison with Previous Equivalent Period
  let previousPeriodAccuracy: number | null = null;
  let accuracyDeltaPp: number | null = null;
  let trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' = 'insufficient_data';

  if (period !== 'all_time' && prevPeriodAttempts.length >= 3 && overallAccuracy !== null) {
    const prevCorrect = prevPeriodAttempts.filter(a => a.correct).length;
    previousPeriodAccuracy = Math.round((prevCorrect / prevPeriodAttempts.length) * 100);
    accuracyDeltaPp = overallAccuracy - previousPeriodAccuracy;

    if (accuracyDeltaPp >= 2) trend = 'improving';
    else if (accuracyDeltaPp <= -2) trend = 'declining';
    else trend = 'stable';
  }

  // 6. Repeated Mistakes (Concepts answered incorrectly 2+ times)
  // Group incorrect attempts by conceptKey from authoritative attempts
  const mistakeCounts = new Map<string, { concept: string; category: QuestionCategory; wrongCount: number; lastMissedAt: number }>();
  
  // Use period attempts if enough data, or fallback to all attempts to ensure user sees high-yield traps
  const attemptsForMistakes = period === 'all_time' ? allAttempts : (periodAttempts.length >= 10 ? periodAttempts : allAttempts);

  for (const att of attemptsForMistakes) {
    if (!att.correct && att.conceptKey) {
      const key = att.conceptKey.toLowerCase().trim();
      const existing = mistakeCounts.get(key);
      const cat = att.category !== 'uncategorized' ? att.category : 'synonyms';
      if (existing) {
        existing.wrongCount++;
        if (att.answeredAt > existing.lastMissedAt) {
          existing.lastMissedAt = att.answeredAt;
        }
      } else {
        mistakeCounts.set(key, {
          concept: att.conceptKey,
          category: cat,
          wrongCount: 1,
          lastMissedAt: att.answeredAt,
        });
      }
    }
  }

  // Also include any verified mistakes from Mistake Vault
  const unresolvedMistakes = (savedWords || []).filter(isItemMistake);
  for (const v of unresolvedMistakes) {
    const q = v.question;
    if (q && q.wordOrPhrase) {
      const key = (q.memoryKey || q.wordOrPhrase).toLowerCase().trim();
      const existing = mistakeCounts.get(key);
      const cat = (q.category as QuestionCategory) || 'synonyms';
      const count = Math.max(v.mistakeCount, existing ? existing.wrongCount : 1);
      mistakeCounts.set(key, {
        concept: q.wordOrPhrase,
        category: cat,
        wrongCount: count,
        lastMissedAt: Math.max(v.savedAt || 0, existing ? existing.lastMissedAt : 0),
      });
    }
  }

  // Filter only genuine repeated mistakes (wrongCount >= 2)
  const repeatedMistakes: RepeatedMistakeItem[] = Array.from(mistakeCounts.values())
    .filter(m => m.wrongCount >= 2)
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 20)
    .map(m => {
      // Find matching metadata from savedWords if available
      const matchedSaved = savedWords.find(
        s => (s.question?.wordOrPhrase || '').toLowerCase().trim() === m.concept.toLowerCase().trim()
      );
      return {
        wordOrPhrase: m.concept,
        category: m.category,
        wrongCount: m.wrongCount,
        meaning: matchedSaved?.question?.meaning,
        hindiMeaning: matchedSaved?.question?.hindiMeaning,
        lastMissedAt: m.lastMissedAt,
      };
    });

  // 7. Active Days Count
  const uniqueDates = new Set<string>();
  for (const att of periodAttempts) {
    if (att.hasReliableTimestamp && att.answeredAt > 0) {
      const d = getISTDate(att.answeredAt);
      uniqueDates.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
    }
  }
  let activeDaysCount = uniqueDates.size;
  if (activeDaysCount === 0 && totalAttempted > 0) {
    activeDaysCount = Math.max(1, Math.min(streak.currentStreak || 1, 7));
  }

  // 8. Exam Readiness Score
  const baseAcc = overallAccuracy !== null ? overallAccuracy : (player.accuracyRate || 50);
  const accScore = Math.min(100, baseAcc) * 0.45;
  const volScore = Math.min(100, (totalAttempted / 50) * 100) * 0.35;
  const streakScore = Math.min(100, (streak.currentStreak / 7) * 100) * 0.20;
  const examReadinessScore = Math.min(99, Math.max(25, Math.round(accScore + volScore + streakScore)));

  const hasEnoughUserData = totalAttempted >= MIN_USER_QUESTIONS_FOR_FULL_REPORT;
  const dueReviewsCount = questionReviewScheduler.getAllReviewStates().filter(s => questionReviewScheduler.isConceptDue(s.memoryKey)).length;

  return {
    period,
    periodLabel,
    previousPeriodLabel,
    totalAttempted,
    totalCorrect,
    totalWrong,
    overallAccuracy,
    currentPeriodAccuracy: overallAccuracy,
    previousPeriodAccuracy,
    accuracyDeltaPp,
    trend,
    categoryStats,
    strongestCategory,
    weakestCategory,
    repeatedMistakes,
    dueReviews: dueReviewsCount,
    unresolvedMistakesCount: unresolvedMistakes.length,
    examReadinessScore,
    targetExam: player.targetExam || 'SSC CGL',
    hasEnoughUserData,
    activeDaysCount,
  };
}

/**
 * Convenience entry point matching calculateMentorAnalytics signature.
 * Directly reads authoritative attempts and delegates to buildMentorAnalytics.
 */
export function calculateMentorAnalytics(
  period: MentorPeriod,
  player: PlayerProfile,
  streak: DailyStreakState,
  savedWords: SavedWord[]
): MentorAnalytics {
  const attempts = getAuthoritativeAttempts();
  return buildMentorAnalytics(period, attempts, player, streak, savedWords);
}

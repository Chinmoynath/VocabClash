import { PlayerProfile, QuestionCategory, DailyStreakState, SavedWord, Question } from '../types';
import { questionReviewScheduler, ReviewState } from './questionReviewScheduler';
import { getAuthoritativeAttempts, getISTDate, normalizeCategory } from './attemptTrackingService';
import { getDailyTargetState, DailyTargetState } from '../utils/dailyTargetManager';
import { calculateMentorAnalytics } from './mentorAnalyticsService';
import { isItemMistake } from '../utils/vaultManager';
import { SscTop100Category } from '../data/sscTop100';
import { extractCleanUserName } from '../utils/nameHelper';

export type NextActionType = 
  | 'due_mistakes' 
  | 'resume_top100' 
  | 'daily_goal' 
  | 'weakest_area' 
  | 'start_practice';

export interface NextBestAction {
  type: NextActionType;
  title: string;
  subtitle: string;
  actionLabel: string;
  badge?: string;
  icon: string;
  priority: number;
  data?: {
    category?: QuestionCategory | 'mixed';
    dueItemsCount?: number;
    batchSize?: number;
    remainingGoal?: number;
    top100Category?: SscTop100Category;
    top100Progress?: number;
    weakestAccuracy?: number;
  };
}

export interface ActiveTop100Info {
  category: SscTop100Category;
  categoryLabel: string;
  currentQuestionNumber: number;
  solvedCount: number;
}

export interface DailyStudySummary {
  greeting: string;
  userName: string;
  dateFormatted: string;
  currentStreak: number;
  
  // Spaced Repetition Due Mistakes
  dueMistakesCount: number;
  dueSavedWords: SavedWord[];
  
  // Daily Target Progress
  dailyTarget: DailyTargetState;
  isDailyGoalCompleted: boolean;

  // Active Top 100 In Progress
  activeTop100: ActiveTop100Info | null;
  
  // Spaced Repetition Mastery Breakdown
  masteryStats: {
    total: number;
    learning: number;
    familiar: number;
    strong: number;
    mastered: number;
  };

  // Weakest category detection
  weakestCategory: QuestionCategory | null;
  weakestCategoryLabel: string | null;
  weakestAccuracy: number | null;

  // Single Determined Next Action
  nextBestAction: NextBestAction;

  // Has sufficient activity for advanced insights
  hasActivity: boolean;
}

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  synonyms: 'Synonyms',
  antonyms: 'Antonyms',
  one_word: 'One Word',
  ows: 'One Word',
  idioms: 'Idioms',
  spelling: 'Spelling',
};

/**
 * Reads any active Top 100 category currently in progress from localStorage
 */
export function getActiveTop100Progress(): ActiveTop100Info | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const categories: SscTop100Category[] = ['synonyms', 'antonyms', 'ows', 'idioms'];
  for (const cat of categories) {
    try {
      const localStr = localStorage.getItem(`vclash_ssc100_${cat}`);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        if (parsed && Array.isArray(parsed.completedQuestionIds) && parsed.completedQuestionIds.length > 0 && parsed.completedQuestionIds.length < 100) {
          const qNum = (parsed.currentQuestionIndex ?? parsed.completedQuestionIds.length) + 1;
          return {
            category: cat,
            categoryLabel: CATEGORY_DISPLAY_NAMES[cat] || cat,
            currentQuestionNumber: Math.min(100, Math.max(1, qNum)),
            solvedCount: parsed.completedQuestionIds.length,
          };
        }
      }
    } catch {
      // Safe fallback
    }
  }
  return null;
}

/**
 * Derives a friendly IST time-of-day greeting (e.g., "Good morning", "Good afternoon", "Good evening")
 */
export function getISTGreeting(): string {
  const istDate = getISTDate();
  const hour = istDate.getUTCHours(); // IST hours
  if (hour >= 4 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

/**
 * Returns formatted IST Date (e.g. "Tuesday, 24 Oct")
 */
export function getFormattedISTDate(): string {
  const istDate = getISTDate();
  return istDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Single deterministic function that aggregates real user data into the DailyStudySummary.
 * Strictly respects user intent: NO AI/Gemini calls on home load, purely deterministic business logic.
 */
export function getDailyStudySummary(
  player: PlayerProfile,
  dailyStreak: DailyStreakState,
  savedWords: SavedWord[],
  isLoggedIn: boolean = false
): DailyStudySummary {
  const now = Date.now();
  const greeting = getISTGreeting();
  const dateFormatted = getFormattedISTDate();

  // Resolve user display name:
  const resolvedFull = extractCleanUserName(player.name, player.email, 'Aspirant');
  let userName = 'Aspirant';
  if (resolvedFull && !resolvedFull.toLowerCase().startsWith('govt') && !resolvedFull.toLowerCase().startsWith('guest')) {
    userName = resolvedFull.split(' ')[0];
  } else if (player.name && !player.name.toLowerCase().startsWith('govt') && !player.name.toLowerCase().startsWith('guest')) {
    userName = player.name.trim().split(' ')[0];
  }

  // 1. Spaced Repetition States & Due Items
  const reviewStates = questionReviewScheduler.getAllReviewStates();
  const dueStates = reviewStates.filter(s => questionReviewScheduler.isConceptDue(s.memoryKey, now));

  // Match due review states to actual SavedWord objects (only actual full items can be reviewed)
  const dueSavedWords: SavedWord[] = [];
  const dueKeys = new Set(dueStates.map(s => s.memoryKey.toLowerCase().trim()));

  // A. Check genuine SavedWords
  for (const sw of savedWords) {
    const q = sw.question;
    const memKey = (q.memoryKey || q.wordOrPhrase || '').toLowerCase().trim();
    if (dueKeys.has(memKey) || questionReviewScheduler.isConceptDue(memKey, now)) {
      if (!dueSavedWords.some(d => d.question.id === sw.question.id)) {
        dueSavedWords.push(sw);
      }
    }
  }

  // B. If user has unresolved mistakes from vault not yet in scheduler due list, include them if due
  const unresolvedMistakes = savedWords.filter(isItemMistake);
  for (const m of unresolvedMistakes) {
    const memKey = (m.question.memoryKey || m.question.wordOrPhrase || '').toLowerCase().trim();
    const state = questionReviewScheduler.getReviewState(memKey);
    const isDue = !state || questionReviewScheduler.isConceptDue(memKey, now);
    if (isDue && !dueSavedWords.some(d => d.question.id === m.question.id)) {
      dueSavedWords.push(m);
    }
  }

  // Only actual saved words with full question metadata in the vault can be reviewed
  const dueMistakesCount = dueSavedWords.length;

  // 2. Mastery breakdown
  let learning = 0;
  let familiar = 0;
  let strong = 0;
  let mastered = 0;
  for (const s of reviewStates) {
    if (s.level === 'mastered') mastered++;
    else if (s.level === 'strong') strong++;
    else if (s.level === 'familiar') familiar++;
    else learning++;
  }

  // 3. Daily Target
  const dailyTarget = getDailyTargetState();
  const targetRemaining = Math.max(0, dailyTarget.targetQuestions - dailyTarget.questionsSolvedToday);
  const isGoalCompleted = dailyTarget.questionsSolvedToday >= dailyTarget.targetQuestions;

  // 4. Weakest Category from Mentor Analytics
  const mentorAnalytics = calculateMentorAnalytics('all_time', player, dailyStreak, savedWords);
  const weakestCategory = mentorAnalytics.weakestCategory;
  const weakestCategoryLabel = weakestCategory ? (CATEGORY_DISPLAY_NAMES[weakestCategory] || weakestCategory) : null;
  const weakestAccuracy = weakestCategory ? mentorAnalytics.categoryStats[weakestCategory]?.accuracy ?? null : null;

  // 5. Active Top 100 Progress
  const activeTop100 = getActiveTop100Progress();

  // 6. Total Activity
  const authoritativeAttempts = getAuthoritativeAttempts();
  const totalAttempts = authoritativeAttempts.length;
  const hasActivity = totalAttempts > 0 || player.matchesPlayed > 0 || savedWords.length > 0;

  // 7. Deterministic Priority Evaluation for "Next Best Action":
  // User Requirement: "dont show it until someone has not solved enough so that there are enough words for you too start 10 word revision cause I opened without signing and was clicking the start 10 word revision, it was not working"
  // Only suggest 10-word revision if there are AT LEAST 10 words in dueSavedWords!
  let nextBestAction: NextBestAction;

  if (dueSavedWords.length >= 10) {
    const batchSize = 10;
    const estMinutes = 5;
    nextBestAction = {
      type: 'due_mistakes',
      title: 'Revise 10 due mistakes',
      subtitle: `${dueSavedWords.length} total due · ~${estMinutes} min micro-session`,
      actionLabel: 'Start 10-Word Revision',
      badge: 'NEXT BEST ACTION',
      icon: '🧠',
      priority: 1,
      data: {
        dueItemsCount: dueSavedWords.length,
        batchSize,
      },
    };
  } else if (!isGoalCompleted && targetRemaining > 0) {
    nextBestAction = {
      type: 'daily_goal',
      title: `Complete Daily Goal (${dailyTarget.questionsSolvedToday}/${dailyTarget.targetQuestions})`,
      subtitle: `${targetRemaining} more question${targetRemaining > 1 ? 's' : ''} to reach daily target and earn +50 LP`,
      actionLabel: `Solve ${Math.min(10, targetRemaining)} PYQs`,
      badge: 'DAILY GOAL',
      icon: '🎯',
      priority: 2,
      data: {
        remainingGoal: targetRemaining,
      },
    };
  } else if (activeTop100) {
    nextBestAction = {
      type: 'resume_top100',
      title: `Continue Top 100: ${activeTop100.categoryLabel}`,
      subtitle: `Question ${activeTop100.currentQuestionNumber} of 100 · High yield SSC PYQs`,
      actionLabel: `Continue Top 100 (Q${activeTop100.currentQuestionNumber})`,
      badge: 'TOP 100',
      icon: '🏆',
      priority: 3,
      data: {
        top100Category: activeTop100.category,
        top100Progress: activeTop100.currentQuestionNumber,
      },
    };
  } else if (dueSavedWords.length > 0) {
    // If daily target is achieved and user has between 1 and 9 due mistakes, offer quick review
    const count = dueSavedWords.length;
    nextBestAction = {
      type: 'due_mistakes',
      title: `Revise ${count} due mistake${count > 1 ? 's' : ''}`,
      subtitle: `Spaced repetition queue ready · ~${Math.max(1, Math.ceil(count * 0.5))} min`,
      actionLabel: `Revise ${count} Word${count > 1 ? 's' : ''}`,
      badge: 'REVISION',
      icon: '🧠',
      priority: 4,
      data: {
        dueItemsCount: count,
        batchSize: count,
      },
    };
  } else if (weakestCategory && weakestAccuracy !== null && weakestAccuracy < 70) {
    const catLabel = weakestCategoryLabel || weakestCategory;
    nextBestAction = {
      type: 'weakest_area',
      title: `Fix Weak Area: ${catLabel}`,
      subtitle: `Current accuracy ${weakestAccuracy}% · 10-Q focused drill`,
      actionLabel: `Practice ${catLabel}`,
      badge: 'ACCURACY BOOST',
      icon: '⚡',
      priority: 4,
      data: {
        category: weakestCategory,
        weakestAccuracy,
      },
    };
  } else {
    nextBestAction = {
      type: 'start_practice',
      title: player.matchesPlayed === 0 ? 'Start 10-Q Diagnostic Practice' : 'Continue PYQ Practice',
      subtitle: 'Master authentic exam questions with real-time feedback',
      actionLabel: 'Start Practice Drill',
      badge: 'PYQ DRILL',
      icon: '📚',
      priority: 5,
      data: {
        category: 'mixed',
      },
    };
  }

  return {
    greeting,
    userName,
    dateFormatted,
    currentStreak: dailyStreak.currentStreak || 0,
    dueMistakesCount,
    dueSavedWords,
    dailyTarget,
    isDailyGoalCompleted: isGoalCompleted,
    activeTop100,
    masteryStats: {
      total: reviewStates.length,
      learning,
      familiar,
      strong,
      mastered,
    },
    weakestCategory,
    weakestCategoryLabel,
    weakestAccuracy,
    nextBestAction,
    hasActivity,
  };
}

import { 
  Question, 
  QuestionCategory, 
  PlayerProfile, 
  DailyStreakState, 
  SavedWord, 
  ExamType,
  MentorAnalytics,
  MentorAiReport
} from '../types';
import { getUserStatsSummary } from '../utils/userStatsManager';
import { questionReviewScheduler } from './questionReviewScheduler';
import { questionBankEngine } from './questionBankEngine';
import { isItemMistake } from '../utils/vaultManager';
import { getPeriodKey, CATEGORY_DISPLAY_NAMES } from './mentorAnalyticsService';
import { getPersistentSeenWords } from '../utils/questionHistoryManager';
import { auth, db } from './firebaseService';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface CategoryDiagnosis {
  category: QuestionCategory;
  name: string;
  accuracy: number;
  solved: number;
  correct: number;
  wrong: number;
  isTested: boolean;
  isWeakest: boolean;
  isStrongest: boolean;
  status: 'unattempted' | 'critical' | 'moderate' | 'strong';
}

export interface MentorDiagnostics {
  overallAccuracy: number;
  totalSolved: number;
  totalCorrect: number;
  totalWrong: number;
  categoryBreakdown: Record<QuestionCategory, CategoryDiagnosis>;
  weakestCategory: QuestionCategory;
  strongestCategory: QuestionCategory;
  mistakesCount: number;
  unresolvedMistakes: SavedWord[];
  dueReviewsCount: number;
  examReadinessScore: number;
  targetExam: string;
}

export interface MentorAiInsight {
  diagnosis: string;
  whatImproved?: string;
  mainWeakness?: string;
  whatToDoNext?: string[];
  encouragement?: string;
  recommendedFocus: string[];
  tacticalTip: string;
  motivationalQuote: string;
  cachedAt: number;
  isFallback?: boolean;
}

const STORAGE_KEY_REPORT_PREFIX = 'vocabclash_mentor_report_v4_';

/**
 * Creates a strictly grounded deterministic coaching report directly from MentorAnalytics.
 * Runs instantly locally with ZERO Gemini API calls.
 */
export function generateDeterministicReport(analytics: MentorAnalytics): MentorAiReport {
  const periodKey = getPeriodKey(analytics.period);
  const weakCat = analytics.weakestCategory;
  const strongCat = analytics.strongestCategory;
  const target = analytics.targetExam || 'SSC CGL';

  const weakStat = weakCat ? analytics.categoryStats[weakCat] : null;
  const strongStat = strongCat ? analytics.categoryStats[strongCat] : null;

  let diagnosis = '';
  if (analytics.totalAttempted === 0) {
    diagnosis = `You haven't attempted any vocabulary questions during ${analytics.periodLabel.toLowerCase()}. Begin with a 10-question practice drill to start generating diagnostic metrics.`;
  } else if (!analytics.hasEnoughUserData) {
    diagnosis = `You have completed ${analytics.totalAttempted} questions with an overall accuracy of ${analytics.overallAccuracy ?? 0}%. Complete at least 20 questions across categories to unlock comprehensive diagnostics.`;
  } else if (weakStat && weakStat.accuracy !== null) {
    diagnosis = `During ${analytics.periodLabel.toLowerCase()}, your overall accuracy stands at ${analytics.overallAccuracy}%. Your lowest accuracy is in ${weakStat.name} at ${weakStat.accuracy}% (${weakStat.correct}/${weakStat.attempted} correct).`;
  } else {
    diagnosis = `During ${analytics.periodLabel.toLowerCase()}, your overall accuracy is ${analytics.overallAccuracy}% across ${analytics.totalAttempted} attempted questions.`;
  }

  let whatImproved = '';
  if (analytics.accuracyDeltaPp !== null) {
    if (analytics.accuracyDeltaPp > 0) {
      whatImproved = `Your accuracy improved by ${analytics.accuracyDeltaPp} percentage points ${analytics.previousPeriodLabel || 'vs previous period'} (${analytics.currentPeriodAccuracy}% vs ${analytics.previousPeriodAccuracy}%).`;
    } else if (analytics.accuracyDeltaPp < 0) {
      whatImproved = `Overall accuracy shifted by ${analytics.accuracyDeltaPp} percentage points ${analytics.previousPeriodLabel || 'vs previous period'} as you tackled fresh or challenging vocabulary.`;
    } else {
      whatImproved = `Your accuracy remained consistent at ${analytics.overallAccuracy}% ${analytics.previousPeriodLabel || 'vs previous period'}.`;
    }
  } else if (strongStat && strongStat.accuracy !== null && strongStat.hasEnoughData) {
    whatImproved = `${strongStat.name} is currently your strongest category with ${strongStat.accuracy}% accuracy (${strongStat.correct}/${strongStat.attempted} correct).`;
  } else {
    whatImproved = 'Consistent daily practice creates durable neural pathways for high-frequency exam words.';
  }

  let mainWeakness = '';
  if (weakStat && weakStat.accuracy !== null && weakStat.hasEnoughData) {
    mainWeakness = `${weakStat.name} needs attention: ${weakStat.wrong} incorrect answers recorded (${weakStat.accuracy}% accuracy).`;
  } else if (analytics.repeatedMistakes.length > 0) {
    const topMistake = analytics.repeatedMistakes[0];
    mainWeakness = `You have repeatedly missed "${topMistake.wordOrPhrase}" (${topMistake.wrongCount} times). Review its context and meaning.`;
  } else if (analytics.unresolvedMistakesCount > 0) {
    mainWeakness = `You have ${analytics.unresolvedMistakesCount} unresolved words in your Mistake Vault awaiting revision.`;
  } else {
    mainWeakness = 'Complete at least 5 questions in each category to isolate category-specific weaknesses.';
  }

  const whatToDoNext: string[] = [];
  if (weakStat) {
    whatToDoNext.push(`Complete a 10-question Weak Areas Drill in ${weakStat.name}`);
  } else {
    whatToDoNext.push('Complete practice questions across all 4 vocabulary categories');
  }

  if (analytics.dueReviews > 0) {
    whatToDoNext.push(`Clear your ${analytics.dueReviews} due spaced repetition reviews before new learning`);
  } else if (analytics.repeatedMistakes.length > 0) {
    whatToDoNext.push(`Review your top repeated mistakes (${analytics.repeatedMistakes.slice(0, 3).map(m => m.wordOrPhrase).join(', ')})`);
  } else {
    whatToDoNext.push('Practice daily to build spaced repetition review intervals');
  }

  whatToDoNext.push(`Maintain your practice streak to lock in vocabulary retention for ${target}`);

  const encouragement = analytics.overallAccuracy !== null && analytics.overallAccuracy >= 75
    ? 'Solid accuracy foundation. Keep testing high-frequency exam words daily.'
    : 'Disciplined daily revision systematically converts weak areas into high-scoring strengths.';

  return {
    diagnosis,
    whatImproved,
    mainWeakness,
    whatToDoNext,
    encouragement,
    generatedAt: Date.now(),
    isFallback: true,
    period: analytics.period,
    periodKey,
  };
}

/**
 * Retrieves the grounded Vocab Mentor Report.
 * CACHING RULES:
 * - Checks localStorage first, then Firestore under users/{uid}/mentor_reports/{periodKey}.
 * - Reuses cached report unless:
 *   1. forceRefresh is true, OR
 *   2. The user has attempted 10+ more questions since the report was generated, OR
 *   3. No cached report exists for this period.
 * - If Gemini fails, gracefully falls back to deterministic grounded report.
 */
export async function getVocabMentorReport(
  analytics: MentorAnalytics,
  forceRefresh: boolean = false
): Promise<MentorAiReport> {
  const periodKey = getPeriodKey(analytics.period);
  const storageKey = `${STORAGE_KEY_REPORT_PREFIX}${periodKey}`;

  // 1. Check local storage cache
  if (!forceRefresh && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && cached.report && cached.periodKey === periodKey) {
          const questionDiff = Math.abs((cached.totalAttempted || 0) - analytics.totalAttempted);
          // If within 10 questions and generated recently, reuse!
          if (questionDiff < 10) {
            return cached.report;
          }
        }
      }
    } catch {}
  }

  // 2. Check cloud Firestore cache for authenticated user
  const currentUser = auth.currentUser;
  if (!forceRefresh && currentUser) {
    try {
      const reportDocRef = doc(db, 'users', currentUser.uid, 'mentor_reports', periodKey);
      const snap = await getDoc(reportDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.report) {
          const questionDiff = Math.abs((data.totalAttempted || 0) - analytics.totalAttempted);
          if (questionDiff < 10) {
            // Save to localStorage for instant offline access
            try {
              localStorage.setItem(storageKey, JSON.stringify({
                report: data.report,
                periodKey,
                totalAttempted: analytics.totalAttempted,
                savedAt: Date.now(),
              }));
            } catch {}
            return data.report;
          }
        }
      }
    } catch (e) {
      console.warn('[AI Mentor] Cloud cache read warning:', e);
    }
  }

  // 3. For users with < 20 total questions, provide starter report without burning Gemini calls
  if (!analytics.hasEnoughUserData) {
    const starterReport = generateDeterministicReport(analytics);
    saveReportToCache(starterReport, analytics, periodKey, storageKey);
    return starterReport;
  }

  // 4. Request grounded coaching evaluation from server Gemini endpoint
  try {
    const res = await fetch('/api/gemini/mentor-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analytics,
        targetExam: analytics.targetExam,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const serverReport = data.report || data.insight;
      if (serverReport && serverReport.diagnosis) {
        const fullReport: MentorAiReport = {
          diagnosis: serverReport.diagnosis,
          whatImproved: serverReport.whatImproved || 'Keep practicing daily to build steady vocabulary recall.',
          mainWeakness: serverReport.mainWeakness || 'Focus on your lowest-accuracy category to eliminate marks loss.',
          whatToDoNext: Array.isArray(serverReport.whatToDoNext) ? serverReport.whatToDoNext : [
            'Practice questions in your weakest category',
            'Clear due spaced repetition reviews',
            'Review repeatedly missed words'
          ],
          encouragement: serverReport.encouragement || serverReport.motivationalQuote || 'Consistent revision converts weak areas into high-scoring strengths.',
          generatedAt: Date.now(),
          isFallback: false,
          period: analytics.period,
          periodKey,
        };

        saveReportToCache(fullReport, analytics, periodKey, storageKey);
        return fullReport;
      }
    }
  } catch (err) {
    console.warn('[AI Mentor] Server insight fetch failed, using deterministic grounded advice:', err);
  }

  // 5. Deterministic fallback grounded strictly in the same analytics
  const fallback = generateDeterministicReport(analytics);
  saveReportToCache(fallback, analytics, periodKey, storageKey);
  return fallback;
}

function saveReportToCache(
  report: MentorAiReport,
  analytics: MentorAnalytics,
  periodKey: string,
  storageKey: string
): void {
  // Save locally
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          report,
          periodKey,
          totalAttempted: analytics.totalAttempted,
          savedAt: Date.now(),
        })
      );
    } catch {}
  }

  // Save to Firestore in background
  const currentUser = auth.currentUser;
  if (currentUser) {
    const reportDocRef = doc(db, 'users', currentUser.uid, 'mentor_reports', periodKey);
    setDoc(
      reportDocRef,
      {
        report,
        periodKey,
        period: analytics.period,
        totalAttempted: analytics.totalAttempted,
        overallAccuracy: analytics.overallAccuracy,
        updatedAt: Date.now(),
      },
      { merge: true }
    ).catch(e => console.warn('[AI Mentor] Cloud cache save warning:', e));
  }
}

/**
 * Backward compatibility adapter for legacy components expecting MentorAiInsight
 */
export async function getPersonalizedMentorInsight(
  diagnostics: MentorDiagnostics,
  forceRefresh: boolean = false
): Promise<MentorAiInsight> {
  const weakCat = diagnostics.weakestCategory || 'antonyms';
  const weakAcc = diagnostics.categoryBreakdown[weakCat]?.accuracy ?? 0;

  // Build a minimal analytics adapter
  const mockAnalytics: MentorAnalytics = {
    period: 'week',
    periodLabel: 'This Week',
    previousPeriodLabel: 'vs last week',
    totalAttempted: diagnostics.totalSolved,
    totalCorrect: diagnostics.totalCorrect,
    totalWrong: diagnostics.totalWrong,
    overallAccuracy: diagnostics.overallAccuracy,
    currentPeriodAccuracy: diagnostics.overallAccuracy,
    previousPeriodAccuracy: null,
    accuracyDeltaPp: null,
    trend: 'insufficient_data',
    categoryStats: {
      antonyms: { category: 'antonyms', name: 'Antonyms', hindiName: 'विलोम शब्द', attempted: diagnostics.categoryBreakdown.antonyms?.solved || 0, correct: diagnostics.categoryBreakdown.antonyms?.correct || 0, wrong: diagnostics.categoryBreakdown.antonyms?.wrong || 0, accuracy: diagnostics.categoryBreakdown.antonyms?.accuracy ?? null, hasEnoughData: (diagnostics.categoryBreakdown.antonyms?.solved || 0) >= 5, status: diagnostics.categoryBreakdown.antonyms?.status || 'unattempted' },
      synonyms: { category: 'synonyms', name: 'Synonyms', hindiName: 'समानार्थी शब्द', attempted: diagnostics.categoryBreakdown.synonyms?.solved || 0, correct: diagnostics.categoryBreakdown.synonyms?.correct || 0, wrong: diagnostics.categoryBreakdown.synonyms?.wrong || 0, accuracy: diagnostics.categoryBreakdown.synonyms?.accuracy ?? null, hasEnoughData: (diagnostics.categoryBreakdown.synonyms?.solved || 0) >= 5, status: diagnostics.categoryBreakdown.synonyms?.status || 'unattempted' },
      ows: { category: 'ows', name: 'One Word Substitution', hindiName: 'अनेक शब्दों के लिए एक शब्द', attempted: diagnostics.categoryBreakdown.ows?.solved || 0, correct: diagnostics.categoryBreakdown.ows?.correct || 0, wrong: diagnostics.categoryBreakdown.ows?.wrong || 0, accuracy: diagnostics.categoryBreakdown.ows?.accuracy ?? null, hasEnoughData: (diagnostics.categoryBreakdown.ows?.solved || 0) >= 5, status: diagnostics.categoryBreakdown.ows?.status || 'unattempted' },
      idioms: { category: 'idioms', name: 'Idioms & Phrases', hindiName: 'मुहावरे एवं लोकोक्तियाँ', attempted: diagnostics.categoryBreakdown.idioms?.solved || 0, correct: diagnostics.categoryBreakdown.idioms?.correct || 0, wrong: diagnostics.categoryBreakdown.idioms?.wrong || 0, accuracy: diagnostics.categoryBreakdown.idioms?.accuracy ?? null, hasEnoughData: (diagnostics.categoryBreakdown.idioms?.solved || 0) >= 5, status: diagnostics.categoryBreakdown.idioms?.status || 'unattempted' },
    },
    strongestCategory: diagnostics.strongestCategory,
    weakestCategory: diagnostics.weakestCategory,
    repeatedMistakes: [],
    dueReviews: diagnostics.dueReviewsCount,
    unresolvedMistakesCount: diagnostics.mistakesCount,
    examReadinessScore: diagnostics.examReadinessScore,
    targetExam: diagnostics.targetExam,
    hasEnoughUserData: diagnostics.totalSolved >= 20,
    activeDaysCount: 3,
  };

  const report = await getVocabMentorReport(mockAnalytics, forceRefresh);

  return {
    diagnosis: report.diagnosis,
    whatImproved: report.whatImproved,
    mainWeakness: report.mainWeakness,
    whatToDoNext: report.whatToDoNext,
    encouragement: report.encouragement,
    recommendedFocus: report.whatToDoNext,
    tacticalTip: report.mainWeakness,
    motivationalQuote: report.encouragement,
    cachedAt: report.generatedAt,
    isFallback: report.isFallback,
  };
}

/**
 * Builds a curated, targeted 10-question drill session for "Train My Weak Areas".
 * Prioritizes:
 * 1. Repeatedly incorrect concepts (from analytics repeatedMistakes)
 * 2. Due review concepts from Spaced Repetition Scheduler
 * 3. Authentic exam questions from user's weakest category
 * 4. Recent mistakes from Mistake Vault
 */
export function buildWeakAreasDrillQuestions(
  diagnosticsOrAnalytics: MentorDiagnostics | MentorAnalytics,
  targetExam: ExamType = 'SSC_CGL',
  desiredCount: number = 10
): Question[] {
  questionBankEngine.init();
  const selected: Question[] = [];
  const seenFingerprints = new Set<string>();

  const pushQuestion = (q: Question, reason: Question['reviewReason']) => {
    if (!q || !q.id) return false;
    const fp = (q.wordOrPhrase || q.id).toLowerCase().trim();
    if (seenFingerprints.has(fp)) return false;
    seenFingerprints.add(fp);
    selected.push({
      ...q,
      reviewReason: reason,
    });
    return true;
  };

  const playablePool = questionBankEngine.getPlayablePool('mixed');

  // 1. Up to 4 questions from repeatedly incorrect concepts
  const repeated = (diagnosticsOrAnalytics as any).repeatedMistakes || [];
  for (const item of repeated) {
    if (selected.length >= 4) break;
    const term = (item.wordOrPhrase || '').toLowerCase().trim();
    const matched = playablePool.find(
      q => (q.wordOrPhrase || q.memoryKey || '').toLowerCase().trim() === term
    );
    if (matched) {
      pushQuestion(matched, 'mistake_review');
    }
  }

  // 2. Up to 3 questions from due spaced repetition reviews
  const dueStates = questionReviewScheduler.getAllReviewStates().filter(s => questionReviewScheduler.isConceptDue(s.memoryKey));
  for (const due of dueStates) {
    if (selected.length >= 7) break;
    const matchedQ = playablePool.find(
      q => (q.memoryKey || q.wordOrPhrase).toLowerCase() === due.memoryKey.toLowerCase()
    );
    if (matchedQ) {
      pushQuestion(matchedQ, 'due_review');
    }
  }

  // 3. Resolve user's weakest category from analytics or lowest accuracy category
  let weakestCat: QuestionCategory = (diagnosticsOrAnalytics as any).weakestCategory as QuestionCategory;
  if (!weakestCat && (diagnosticsOrAnalytics as any).categoryStats) {
    const stats = (diagnosticsOrAnalytics as any).categoryStats;
    const cats: QuestionCategory[] = ['idioms', 'ows', 'antonyms', 'synonyms'];
    cats.sort((a, b) => {
      const accA = stats[a]?.accuracy ?? 100;
      const accB = stats[b]?.accuracy ?? 100;
      if (accA !== accB) return accA - accB;
      return (stats[a]?.attempted ?? 0) - (stats[b]?.attempted ?? 0);
    });
    weakestCat = cats[0];
  }
  if (!weakestCat) weakestCat = 'idioms';

  const weakPool = questionBankEngine.getPlayablePool(weakestCat);
  const matchingExamQuestions = weakPool.filter(q => questionBankEngine.matchesExam(q, targetExam));
  const candidatePool = matchingExamQuestions.length >= 10 ? matchingExamQuestions : weakPool;

  // Prioritize unseen / non-recent questions from candidate pool and shuffle
  const seenWords = new Set(getPersistentSeenWords().map(w => w.toLowerCase().trim()));
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const unseenCandidates = shuffle(candidatePool.filter(q => !seenWords.has((q.wordOrPhrase || '').toLowerCase().trim())));
  const otherCandidates = shuffle(candidatePool.filter(q => seenWords.has((q.wordOrPhrase || '').toLowerCase().trim())));
  const orderedCandidates = [...unseenCandidates, ...otherCandidates];

  for (const q of orderedCandidates) {
    if (selected.length >= desiredCount) break;
    pushQuestion(q, 'weak_category');
  }

  // 4. Fill any remaining with questions from general pool
  if (selected.length < desiredCount) {
    const shuffledGeneral = shuffle(playablePool);
    for (const q of shuffledGeneral) {
      if (selected.length >= desiredCount) break;
      pushQuestion(q, 'fresh');
    }
  }

  return selected.slice(0, desiredCount);
}

/**
 * Deterministically computes user diagnostics from existing progress and history.
 * Runs 100% locally with ZERO Gemini API calls.
 */
export function calculateMentorDiagnostics(
  player: PlayerProfile,
  streak: DailyStreakState,
  savedWords: SavedWord[]
): MentorDiagnostics {
  const statsSummary = getUserStatsSummary(player, streak);
  const schedulerStats = questionReviewScheduler.getStats();
  const unresolvedMistakes = savedWords.filter(isItemMistake);

  const categories: QuestionCategory[] = ['antonyms', 'synonyms', 'ows', 'idioms'];
  const breakdown: Record<QuestionCategory, CategoryDiagnosis> = {} as any;

  for (const cat of categories) {
    const rec = statsSummary.categoryBreakdown?.[cat] || {
      category: cat,
      solved: 0,
      correct: 0,
      wrong: 0,
      accuracy: 0,
      masteredCount: 0,
    };

    const isTested = rec.solved > 0;
    const acc = isTested ? Math.max(0, Math.min(100, Math.round(rec.accuracy))) : 0;
    const status: 'unattempted' | 'critical' | 'moderate' | 'strong' = !isTested
      ? 'unattempted'
      : acc < 50
      ? 'critical'
      : acc < 75
      ? 'moderate'
      : 'strong';

    const correctCount = rec.correct || (isTested ? Math.round((acc / 100) * rec.solved) : 0);
    const wrongCount = rec.wrong !== undefined ? rec.wrong : Math.max(0, rec.solved - correctCount);

    breakdown[cat] = {
      category: cat,
      name: CATEGORY_DISPLAY_NAMES[cat]?.name || cat,
      accuracy: acc,
      solved: rec.solved,
      correct: correctCount,
      wrong: wrongCount,
      isTested,
      isWeakest: false,
      isStrongest: false,
      status,
    };
  }

  const testedCategories = categories.filter(c => breakdown[c].isTested && breakdown[c].solved >= 5);
  let weakestCat: QuestionCategory = 'antonyms';
  let strongestCat: QuestionCategory = 'synonyms';

  if (testedCategories.length === 0) {
    weakestCat = 'antonyms';
    strongestCat = 'synonyms';
  } else if (testedCategories.length === 1) {
    weakestCat = testedCategories[0];
    strongestCat = testedCategories[0];
    if (breakdown[weakestCat].accuracy < 60) {
      breakdown[weakestCat].isWeakest = true;
    } else {
      breakdown[weakestCat].isStrongest = true;
    }
  } else {
    testedCategories.sort((a, b) => breakdown[a].accuracy - breakdown[b].accuracy);
    weakestCat = testedCategories[0];
    strongestCat = testedCategories[testedCategories.length - 1];
    breakdown[weakestCat].isWeakest = true;
    breakdown[strongestCat].isStrongest = true;
  }

  return {
    overallAccuracy: statsSummary.overallAccuracy,
    totalSolved: statsSummary.totalSolved,
    totalCorrect: statsSummary.totalCorrect,
    totalWrong: statsSummary.totalWrong,
    categoryBreakdown: breakdown,
    weakestCategory: weakestCat,
    strongestCategory: strongestCat,
    mistakesCount: unresolvedMistakes.length,
    unresolvedMistakes,
    dueReviewsCount: schedulerStats.dueCount || 0,
    examReadinessScore: statsSummary.examReadinessScore || 65,
    targetExam: player.targetExam || 'SSC CGL',
  };
}

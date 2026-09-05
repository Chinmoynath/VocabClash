import { 
  Question, 
  QuestionCategory, 
  PlayerProfile, 
  DailyStreakState, 
  SavedWord, 
  ExamType 
} from '../types';
import { getUserStatsSummary } from '../utils/userStatsManager';
import { questionReviewScheduler } from './questionReviewScheduler';
import { questionBankEngine } from './questionBankEngine';
import { isItemMistake } from '../utils/vaultManager';

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
  recommendedFocus: string[];
  tacticalTip: string;
  motivationalQuote: string;
  cachedAt: number;
  isFallback?: boolean;
}

const STORAGE_KEY_MENTOR_INSIGHT = 'vocabclash_mentor_cached_insight_v3';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CATEGORY_NAMES: Record<QuestionCategory, string> = {
  antonyms: 'Antonyms (विलोम शब्द)',
  synonyms: 'Synonyms (समानार्थी शब्द)',
  ows: 'One Word Substitution (अनेक शब्दों के लिए एक शब्द)',
  idioms: 'Idioms & Phrases (मुहावरे एवं लोकोक्तियाँ)',
};

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
      name: CATEGORY_NAMES[cat] || cat,
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

  // Identify weakest and strongest strictly from tested categories
  const testedCategories = categories.filter(c => breakdown[c].isTested);
  let weakestCat: QuestionCategory = 'antonyms';
  let strongestCat: QuestionCategory = 'synonyms';

  if (testedCategories.length === 0) {
    // Unattempted state: default to antonyms as priority practice
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
    // Sort tested categories ascending by accuracy
    testedCategories.sort((a, b) => breakdown[a].accuracy - breakdown[b].accuracy);
    weakestCat = testedCategories[0];
    strongestCat = testedCategories[testedCategories.length - 1];

    breakdown[weakestCat].isWeakest = true;
    if (breakdown[strongestCat].accuracy > breakdown[weakestCat].accuracy) {
      breakdown[strongestCat].isStrongest = true;
    }
  }

  // Vault mistakes check: if user has 3+ unresolved mistakes in any category, that category gets focus
  const categoryMistakeCounts: Record<QuestionCategory, number> = {
    antonyms: 0,
    synonyms: 0,
    ows: 0,
    idioms: 0,
  };
  for (const m of unresolvedMistakes) {
    if (m.question?.category && categoryMistakeCounts[m.question.category] !== undefined) {
      categoryMistakeCounts[m.question.category]++;
    }
  }
  let maxMistakesCat: QuestionCategory = weakestCat;
  let highestMistakes = 0;
  for (const cat of categories) {
    if (categoryMistakeCounts[cat] > highestMistakes) {
      highestMistakes = categoryMistakeCounts[cat];
      maxMistakesCat = cat;
    }
  }
  if (highestMistakes >= 3) {
    if (breakdown[weakestCat]) breakdown[weakestCat].isWeakest = false;
    weakestCat = maxMistakesCat;
    if (breakdown[weakestCat]) breakdown[weakestCat].isWeakest = true;
  }

  // Accurate aggregate totals
  const totalSolved = statsSummary.totalSolved || 0;
  const totalCorrect = statsSummary.totalCorrect || 0;
  const totalWrong = statsSummary.totalWrong || Math.max(0, totalSolved - totalCorrect);
  const overallAccuracy = totalSolved > 0
    ? Math.round((totalCorrect / totalSolved) * 100)
    : (player.accuracyRate || 0);

  return {
    overallAccuracy,
    totalSolved,
    totalCorrect,
    totalWrong,
    categoryBreakdown: breakdown,
    weakestCategory: weakestCat,
    strongestCategory: strongestCat,
    mistakesCount: unresolvedMistakes.length,
    unresolvedMistakes,
    dueReviewsCount: schedulerStats.dueCount || 0,
    examReadinessScore: statsSummary.examReadinessScore || 68,
    targetExam: player.targetExam || 'SSC CGL',
  };
}

/**
 * Returns deterministic faculty advice without Gemini (used for instant loading and fallback).
 */
export function getDeterministicFacultyAdvice(
  weakestCat: QuestionCategory,
  targetExam: string,
  weakAcc: number
): MentorAiInsight {
  const fallbackAdviceMap: Record<QuestionCategory, MentorAiInsight> = {
    antonyms: {
      diagnosis: `Your Antonyms accuracy (${weakAcc}%) requires immediate focus for ${targetExam}. Examiners frequently plant the synonym as Option A to trap candidates who read quickly without checking polarity.`,
      recommendedFocus: [
        'IN- / IM- / UN- (Negative prefixes: Ineffable, Impudent)',
        'MAL- (Negative root: Malevolent, Maladroit, Malice)',
        'BENE- / BON- (Positive root: Beneficent, Benign, Bonanza)',
      ],
      tacticalTip: 'Check the question polarity first: if the prompt word is positive (+), immediately eliminate all positive options before selecting your antonym.',
      motivationalQuote: 'Eliminating hasty antonym mistakes directly translates to +4 to +6 raw marks in Tier-1.',
      cachedAt: Date.now(),
      isFallback: true,
    },
    synonyms: {
      diagnosis: `Your Synonyms accuracy (${weakAcc}%) indicates difficulty when words have secondary or nuanced meanings in recent exam shifts.`,
      recommendedFocus: [
        'LOQ- / LOC- (Speech roots: Loquacious, Circumlocution)',
        'ANIM- (Mind/Spirit: Equanimity, Magnanimous, Pusillanimous)',
        'VER- (Truth: Veracity, Veritable, Aver)',
      ],
      tacticalTip: 'Substitute the given options into an authentic context sentence. The closest contextual synonym will preserve sentence tone.',
      motivationalQuote: 'Mastering high-yield Latin roots unlocks 10+ exam words simultaneously.',
      cachedAt: Date.now(),
      isFallback: true,
    },
    ows: {
      diagnosis: `One Word Substitution requires structural root word identification rather than blind memorization.`,
      recommendedFocus: [
        '-CRACY / -ARCHY (Governance & Rule: Plutocracy, Oligarchy)',
        '-LOGY / -IST (Specialists: Paleontology, Numismatist)',
        'PHIL- / PHOB- (Affinity & Aversion: Bibliophile, Claustrophobia)',
      ],
      tacticalTip: 'Break the long English word into Prefix + Root + Suffix. 85% of exam OWS questions can be answered simply by recognizing the suffix.',
      motivationalQuote: 'Consistency in One Word Substitution is the highest-scoring shortcut in SSC English.',
      cachedAt: Date.now(),
      isFallback: true,
    },
    idioms: {
      diagnosis: `Idioms accuracy (${weakAcc}%) reflects unfamiliarity with historical origins. Official exams repeat 70%+ of idioms from previous 5 years.`,
      recommendedFocus: [
        'Color Idioms (Red-letter day, Blue blood, White elephant)',
        'Body Parts Idioms (Bite the bullet, Turn a blind eye, Cold feet)',
        'Animal Metaphors (Barking up wrong tree, Bull in china shop)',
      ],
      tacticalTip: 'Never pick the literal physical meaning of an idiom option. The exam answer is almost always metaphorical or figurative.',
      motivationalQuote: 'Master 10 idioms every single day and convert this into your strongest scoring section.',
      cachedAt: Date.now(),
      isFallback: true,
    },
  };

  return fallbackAdviceMap[weakestCat] || fallbackAdviceMap.antonyms;
}

/**
 * Retrieves personalized coaching insight.
 * Checks local cache first: NEVER sends a Gemini request on every page open.
 * Only calls server if missing from cache or user explicitly clicks "Refresh".
 */
export async function getPersonalizedMentorInsight(
  diagnostics: MentorDiagnostics,
  forceRefresh: boolean = false
): Promise<MentorAiInsight> {
  const today = getTodayStr();
  const cacheKey = `${today}_${diagnostics.weakestCategory}`;

  // 1. Check local cache unless force refreshed
  if (!forceRefresh && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MENTOR_INSIGHT);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.cacheKey === cacheKey && parsed.insight) {
          return parsed.insight;
        }
      }
    } catch {}
  }

  // 2. Fetch fresh insight from server endpoint
  try {
    const res = await fetch('/api/gemini/mentor-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetExam: diagnostics.targetExam,
        overallAccuracy: diagnostics.overallAccuracy,
        weakestCategory: diagnostics.weakestCategory,
        weakestCategoryAccuracy: diagnostics.categoryBreakdown[diagnostics.weakestCategory]?.accuracy || 52,
        strongestCategory: diagnostics.strongestCategory,
        strongestCategoryAccuracy: diagnostics.categoryBreakdown[diagnostics.strongestCategory]?.accuracy || 78,
        mistakesCount: diagnostics.mistakesCount,
        totalSolved: diagnostics.totalSolved,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.insight && data.insight.diagnosis) {
        const insightResult: MentorAiInsight = {
          ...data.insight,
          cachedAt: Date.now(),
          isFallback: false,
        };

        // Cache locally for the rest of today
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem(
              STORAGE_KEY_MENTOR_INSIGHT,
              JSON.stringify({ cacheKey, insight: insightResult, savedAt: Date.now() })
            );
          } catch {}
        }

        return insightResult;
      }
    }
  } catch (err) {
    console.warn('[AI Mentor] Server insight error, using deterministic faculty advice:', err);
  }

  // 3. Graceful fallback to deterministic faculty advice
  const fallback = getDeterministicFacultyAdvice(
    diagnostics.weakestCategory,
    diagnostics.targetExam,
    diagnostics.categoryBreakdown[diagnostics.weakestCategory]?.accuracy || 52
  );
  return fallback;
}

/**
 * Builds a curated, targeted 10-question drill session for "Train My Weak Areas".
 * Reuses authentic questions from:
 * 1. Unresolved mistakes from Mistake Vault
 * 2. Due review questions from Spaced Repetition Scheduler
 * 3. Authentic exam questions from the user's weakest category
 */
export function buildWeakAreasDrillQuestions(
  diagnostics: MentorDiagnostics,
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

  // 1. Up to 4 questions from unresolved mistakes
  const mistakeItems = [...diagnostics.unresolvedMistakes];
  for (const item of mistakeItems) {
    if (selected.length >= 4) break;
    if (item.question) {
      pushQuestion(item.question, 'mistake_review');
    }
  }

  // 2. Up to 3 questions from due spaced repetition reviews
  const dueStates = questionReviewScheduler.getAllReviewStates().filter(s => questionReviewScheduler.isConceptDue(s.memoryKey));
  const playablePool = questionBankEngine.getPlayablePool('mixed');
  for (const due of dueStates) {
    if (selected.length >= 7) break;
    const matchedQ = playablePool.find(
      q => (q.memoryKey || q.wordOrPhrase).toLowerCase() === due.memoryKey.toLowerCase()
    );
    if (matchedQ) {
      pushQuestion(matchedQ, 'due_review');
    }
  }

  // 3. Fill the remaining spots with authentic questions from the user's WEAKEST category
  const weakPool = questionBankEngine.getPlayablePool(diagnostics.weakestCategory);
  // Filter for matching exam or high repeat count
  const matchingExamQuestions = weakPool.filter(q => questionBankEngine.matchesExam(q, targetExam));
  const candidatePool = matchingExamQuestions.length >= 10 ? matchingExamQuestions : weakPool;
  const shuffledCandidates = questionBankEngine.shuffle(candidatePool);

  for (const candidate of shuffledCandidates) {
    if (selected.length >= desiredCount) break;
    pushQuestion(candidate, 'saved_review');
  }

  // If still under desired count, fill from mixed pool
  if (selected.length < desiredCount) {
    const mixedShuffled = questionBankEngine.shuffle(playablePool);
    for (const q of mixedShuffled) {
      if (selected.length >= desiredCount) break;
      pushQuestion(q, 'fresh');
    }
  }

  return selected.slice(0, desiredCount);
}

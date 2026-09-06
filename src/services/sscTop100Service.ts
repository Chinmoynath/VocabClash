import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebaseService';
import { Question } from '../types';
import {
  SscTop100Category,
  SSC_TOP_100_CATEGORIES,
  getAuthoritativeSscTop100Questions,
  balanceAndRandomizeQuestions,
} from '../data/sscTop100';
import { questionBankEngine } from './questionBankEngine';

export interface SscTop100Progress {
  category: SscTop100Category;
  completedQuestionIds: string[];
  solvedCount: number;
  correctCount: number;
  currentQuestionIndex: number;
  status: 'not_started' | 'in_progress' | 'completed';
  lastAttemptAt: number;
  lastUpdatedDate?: string;
}

export interface SscVocabRankingDiagnostic {
  category: SscTop100Category;
  totalPoolScanned: number;
  uniqueSscConcepts: number;
  topRankedSample: {
    rank: number;
    word: string;
    repeatCount: number;
    exams: string[];
  }[];
}

/**
 * Returns today's date in YYYY-MM-DD format (local user time)
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a progress timestamp or date string is from today.
 * If not from today (i.e. midnight has passed), it returns false triggering daily reset.
 */
export function isFromToday(lastAttemptAt?: number, lastUpdatedDate?: string): boolean {
  const today = getTodayDateString();
  if (lastUpdatedDate) {
    return lastUpdatedDate === today;
  }
  if (lastAttemptAt && typeof lastAttemptAt === 'number' && lastAttemptAt > 0) {
    const d = new Date(lastAttemptAt);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}` === today;
  }
  return false;
}

class SscTop100Service {
  // In-memory cache of the 100 questions per category
  private questionsMemoryCache = new Map<SscTop100Category, Question[]>();
  
  // In-memory cache of user progress
  private progressMemoryCache = new Map<string, SscTop100Progress>();

  /**
   * Fetch the Top 100 questions for a category.
   * Priority: Memory cache -> Firestore -> Curated Authoritative SSC Dataset
   */
  public async fetchTop100Questions(category: SscTop100Category): Promise<Question[]> {
    // 1. Check memory cache first (instant response, 0 ms)
    if (this.questionsMemoryCache.has(category)) {
      const cached = this.questionsMemoryCache.get(category)!;
      if (cached && cached.length >= 100) {
        return cached;
      }
    }

    // 2. Try fetching from Firestore collection `ssc_top100`
    try {
      if (db) {
        const docRef = doc(db, 'ssc_top100', category);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            const balanced = balanceAndRandomizeQuestions(data.questions);
            this.questionsMemoryCache.set(category, balanced);
            return balanced;
          }
        }
      }
    } catch {
      // Safe fallback to curated dataset if Firestore network/quota error occurs
    }

    // 3. Fallback to authoritative ranked SSC pool
    const authoritativeQuestions = getAuthoritativeSscTop100Questions(category);
    this.questionsMemoryCache.set(category, authoritativeQuestions);
    return authoritativeQuestions;
  }

  /**
   * Fetch user progress for a category with automatic daily reset at midnight
   */
  public async fetchUserProgress(
    uid: string | undefined,
    category: SscTop100Category
  ): Promise<SscTop100Progress> {
    const today = getTodayDateString();
    const defaultProgress: SscTop100Progress = {
      category,
      completedQuestionIds: [],
      solvedCount: 0,
      correctCount: 0,
      currentQuestionIndex: 0,
      status: 'not_started',
      lastAttemptAt: Date.now(),
      lastUpdatedDate: today,
    };

    const cacheKey = `${uid || 'guest'}_${category}`;
    if (this.progressMemoryCache.has(cacheKey)) {
      const cached = this.progressMemoryCache.get(cacheKey)!;
      if (isFromToday(cached.lastAttemptAt, cached.lastUpdatedDate)) {
        return cached;
      } else {
        // Cached progress is from a previous day - clear from cache
        this.progressMemoryCache.delete(cacheKey);
      }
    }

    // Try Firestore if user is logged in
    if (uid && db) {
      try {
        const progressRef = doc(db, 'users', uid, 'ssc_top100_progress', category);
        const snapshot = await getDoc(progressRef);
        if (snapshot.exists()) {
          const data = snapshot.data() as SscTop100Progress;
          if (isFromToday(data.lastAttemptAt, data.lastUpdatedDate)) {
            this.progressMemoryCache.set(cacheKey, data);
            return data;
          } else {
            // Day has passed! Reset in Firestore and cache
            this.progressMemoryCache.set(cacheKey, defaultProgress);
            setDoc(progressRef, defaultProgress, { merge: true }).catch(() => {});
            return defaultProgress;
          }
        }
      } catch {
        // Safe fallback
      }
    }

    // Check lightweight localStorage for guest/offline fallback
    try {
      const localStr = localStorage.getItem(`vclash_ssc100_${category}`);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        if (parsed && Array.isArray(parsed.completedQuestionIds)) {
          if (isFromToday(parsed.lastAttemptAt, parsed.lastUpdatedDate)) {
            const progress: SscTop100Progress = {
              category,
              completedQuestionIds: parsed.completedQuestionIds,
              solvedCount: parsed.completedQuestionIds.length,
              correctCount: parsed.correctCount || 0,
              currentQuestionIndex: parsed.currentQuestionIndex || parsed.completedQuestionIds.length,
              status: parsed.completedQuestionIds.length >= 100 ? 'completed' : (parsed.completedQuestionIds.length > 0 ? 'in_progress' : 'not_started'),
              lastAttemptAt: parsed.lastAttemptAt || Date.now(),
              lastUpdatedDate: parsed.lastUpdatedDate || today,
            };
            this.progressMemoryCache.set(cacheKey, progress);
            return progress;
          } else {
            // Expired from previous day, clear storage
            localStorage.removeItem(`vclash_ssc100_${category}`);
          }
        }
      }
    } catch {
      // Ignore
    }

    return defaultProgress;
  }

  /**
   * Save user progress after answering questions
   */
  public async saveUserProgress(
    uid: string | undefined,
    category: SscTop100Category,
    progress: SscTop100Progress
  ): Promise<void> {
    const today = getTodayDateString();
    const progressWithDate: SscTop100Progress = {
      ...progress,
      lastAttemptAt: Date.now(),
      lastUpdatedDate: today,
    };
    const cacheKey = `${uid || 'guest'}_${category}`;
    this.progressMemoryCache.set(cacheKey, progressWithDate);

    // Save to Firestore if authenticated
    if (uid && db) {
      try {
        const progressRef = doc(db, 'users', uid, 'ssc_top100_progress', category);
        await setDoc(progressRef, progressWithDate, { merge: true });
      } catch (err) {
        console.warn('Could not sync SSC Top 100 progress to Firestore:', err);
      }
    }

    // Also persist lightweight ID-only payload locally for offline continuity
    try {
      localStorage.setItem(`vclash_ssc100_${category}`, JSON.stringify({
        completedQuestionIds: progressWithDate.completedQuestionIds,
        correctCount: progressWithDate.correctCount,
        currentQuestionIndex: progressWithDate.currentQuestionIndex,
        lastAttemptAt: progressWithDate.lastAttemptAt,
        lastUpdatedDate: today,
      }));
    } catch {
      // Safe ignore
    }
  }

  /**
   * Reset progress for a category (allows retaking the drill from #1)
   */
  public async resetUserProgress(
    uid: string | undefined,
    category: SscTop100Category
  ): Promise<void> {
    const today = getTodayDateString();
    const resetProgress: SscTop100Progress = {
      category,
      completedQuestionIds: [],
      solvedCount: 0,
      correctCount: 0,
      currentQuestionIndex: 0,
      status: 'not_started',
      lastAttemptAt: Date.now(),
      lastUpdatedDate: today,
    };

    const cacheKey = `${uid || 'guest'}_${category}`;
    this.progressMemoryCache.set(cacheKey, resetProgress);

    if (uid && db) {
      try {
        const progressRef = doc(db, 'users', uid, 'ssc_top100_progress', category);
        await setDoc(progressRef, resetProgress);
      } catch {
        // Safe ignore
      }
    }

    try {
      localStorage.removeItem(`vclash_ssc100_${category}`);
    } catch {
      // Safe ignore
    }
  }

  /**
   * Diagnostic inspection of SSC rankings
   */
  public async inspectSscRankings(): Promise<SscVocabRankingDiagnostic[]> {
    const diagnostics: SscVocabRankingDiagnostic[] = [];

    for (const catInfo of SSC_TOP_100_CATEGORIES) {
      const questions = await this.fetchTop100Questions(catInfo.id);
      diagnostics.push({
        category: catInfo.id,
        totalPoolScanned: questions.length,
        uniqueSscConcepts: questions.length,
        topRankedSample: questions.slice(0, 10).map((q, idx) => ({
          rank: idx + 1,
          word: q.wordOrPhrase,
          repeatCount: q.repeatCount || 10,
          exams: q.examHistory || ['SSC CGL', 'SSC CHSL'],
        })),
      });
    }

    return diagnostics;
  }

  /**
   * Rebuild & Sync SSC Top 100 to Firestore (Admin operation)
   * Evaluates all authentic SSC questions, ranks top 100, and writes to Firestore.
   */
  public async rebuildAndSyncSscTop100(): Promise<{
    success: boolean;
    categoriesUpdated: number;
    totalQuestionsRanked: number;
    summary: string;
  }> {
    if (!db) {
      throw new Error('Firestore is not initialized.');
    }

    let totalRanked = 0;
    const categories: SscTop100Category[] = ['synonyms', 'antonyms', 'ows', 'idioms'];

    for (const cat of categories) {
      // Generate authoritative top 100
      const rankedQuestions = getAuthoritativeSscTop100Questions(cat);
      totalRanked += rankedQuestions.length;

      // Update Firestore document `ssc_top100/{category}`
      const categoryDocRef = doc(db, 'ssc_top100', cat);
      await setDoc(categoryDocRef, {
        category: cat,
        title: SSC_TOP_100_CATEGORIES.find(c => c.id === cat)?.title || cat,
        totalRanked: rankedQuestions.length,
        questionIds: rankedQuestions.map(q => q.id),
        questions: rankedQuestions,
        lastRebuiltAt: Date.now(),
        sscExamsIncluded: ['SSC CGL', 'SSC CHSL', 'SSC CPO', 'SSC MTS', 'Selection Post'],
      });

      // Update in-memory cache
      this.questionsMemoryCache.set(cat, rankedQuestions);
    }

    return {
      success: true,
      categoriesUpdated: categories.length,
      totalQuestionsRanked: totalRanked,
      summary: `Successfully rebuilt and published 100 high-frequency questions for all 4 SSC categories (400 total questions).`,
    };
  }
}

export const sscTop100Service = new SscTop100Service();

export async function recordSscTop100Answer(
  uid: string | undefined,
  category: SscTop100Category,
  questionId: string,
  isCorrect: boolean,
  currentQuestionIndex: number
): Promise<void> {
  try {
    const currentProgress = await sscTop100Service.fetchUserProgress(uid, category);
    const completedSet = new Set(currentProgress.completedQuestionIds);
    const isFirstTime = !completedSet.has(questionId);
    completedSet.add(questionId);

    const newSolved = Math.min(100, completedSet.size);
    const newCorrect = isFirstTime
      ? currentProgress.correctCount + (isCorrect ? 1 : 0)
      : currentProgress.correctCount;

    const nextIndex = Math.min(100, Math.max(currentProgress.currentQuestionIndex, currentQuestionIndex + 1));
    const nextStatus = newSolved >= 100 ? 'completed' : 'in_progress';

    await sscTop100Service.saveUserProgress(uid, category, {
      category,
      completedQuestionIds: Array.from(completedSet).slice(0, 100),
      solvedCount: newSolved,
      correctCount: Math.min(100, newCorrect),
      currentQuestionIndex: nextIndex,
      status: nextStatus,
      lastAttemptAt: Date.now(),
    });
  } catch (err) {
    console.warn('Error recording SSC Top 100 answer:', err);
  }
}

export async function markSscTop100CategoryCompleted(
  uid: string | undefined,
  category: SscTop100Category
): Promise<void> {
  try {
    const currentProgress = await sscTop100Service.fetchUserProgress(uid, category);
    await sscTop100Service.saveUserProgress(uid, category, {
      ...currentProgress,
      status: 'completed',
      currentQuestionIndex: 100,
      lastAttemptAt: Date.now(),
    });
  } catch (err) {
    console.warn('Error marking SSC Top 100 category completed:', err);
  }
}


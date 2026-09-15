import { Question, QuestionCategory } from '../types';
import { db, auth } from './firebaseService';
import { collection, doc, writeBatch, getDocs, query, limit } from 'firebase/firestore';

export type ReviewLevel = 'new' | 'learning' | 'familiar' | 'strong' | 'mastered';
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  memoryKey: string;
  category: QuestionCategory;
  conceptDisplay: string;
  firstSeenAt: number;
  lastSeenAt: number;
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  lapseCount: number;
  lastResult: ReviewGrade;
  lastSeenOrdinal: number;
  dueAt: number;
  dueAfterOrdinal: number | null;
  level: ReviewLevel;
  averageResponseMs?: number;
  recentQuestionIds: string[];
  distinctDaysCount: number;
  lastDayStr: string;
  isSaved?: boolean;
}

const STORAGE_KEY_REVIEWS = 'vocabclash_review_states_v3';
const STORAGE_KEY_MIGRATION = 'vocabclash_v3_migration_done';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function applyFuzz(baseDays: number, fuzzRatio: number = 0.18): number {
  const variation = (Math.random() * 2 - 1) * fuzzRatio;
  return Math.max(0.2, baseDays * (1 + variation));
}

class QuestionReviewScheduler {
  private reviewStates: Map<string, ReviewState> = new Map();
  private sessionOrdinal: number = 0;
  private recentMemoryKeys: string[] = []; // Last ~100
  private recentQuestionIds: string[] = []; // Last ~200
  private pendingSyncKeys: Set<string> = new Set();
  private syncTimer: any = null;
  private initialized: boolean = false;

  public init() {
    if (this.initialized) return;
    this.loadFromLocalStorage();
    this.performLegacyMigration();
    this.initialized = true;
  }

  // Current session ordinal for relative in-session spacing
  public getSessionOrdinal(): number {
    return this.sessionOrdinal;
  }

  public incrementSessionOrdinal(): number {
    this.sessionOrdinal += 1;
    return this.sessionOrdinal;
  }

  public getRecentMemoryKeys(): string[] {
    return this.recentMemoryKeys;
  }

  public getRecentQuestionIds(): string[] {
    return this.recentQuestionIds;
  }

  public getReviewState(memoryKey: string): ReviewState | undefined {
    this.init();
    return this.reviewStates.get(memoryKey.toLowerCase().trim());
  }

  public getAllReviewStates(): ReviewState[] {
    this.init();
    return Array.from(this.reviewStates.values());
  }

  // Check if a concept is due for review
  public isConceptDue(memoryKey: string, now: number = Date.now()): boolean {
    const state = this.reviewStates.get(memoryKey.toLowerCase().trim());
    if (!state || state.seenCount === 0) return false;

    // 1. In-session ordinal check
    if (state.dueAfterOrdinal !== null && this.sessionOrdinal >= state.dueAfterOrdinal) {
      return true;
    }

    // 2. Long-term timestamp check
    if (state.dueAt && state.dueAt <= now) {
      return true;
    }

    return false;
  }

  // Automatic result grading from response behavior
  public inferGrade(isCorrect: boolean, responseTimeMs?: number, previousConsecutive: number = 0): ReviewGrade {
    if (!isCorrect) return 'again';
    if (responseTimeMs !== undefined && responseTimeMs > 10000) return 'hard';
    if (responseTimeMs !== undefined && responseTimeMs < 3500 && previousConsecutive >= 1) return 'easy';
    return 'good';
  }

  // Record an attempt on a question concept
  public recordAttempt(
    question: Question,
    isCorrect: boolean,
    responseTimeMs?: number
  ): ReviewState {
    this.init();
    const memoryKey = (question.memoryKey || question.conceptKey || question.wordOrPhrase).toLowerCase().trim();
    const category = question.category;
    const now = Date.now();
    const today = getTodayStr();

    this.sessionOrdinal += 1;

    // Track recency (~25-30 concepts, ~75-80 question IDs)
    this.recentMemoryKeys = [
      ...this.recentMemoryKeys.filter(k => k !== memoryKey),
      memoryKey
    ].slice(-30);

    if (question.id) {
      this.recentQuestionIds = [
        ...this.recentQuestionIds.filter(id => id !== question.id),
        question.id
      ].slice(-80);
    }

    const existing = this.reviewStates.get(memoryKey) || {
      memoryKey,
      category,
      conceptDisplay: question.wordOrPhrase,
      firstSeenAt: now,
      lastSeenAt: now,
      seenCount: 0,
      correctCount: 0,
      wrongCount: 0,
      consecutiveCorrect: 0,
      lapseCount: 0,
      lastResult: 'good' as ReviewGrade,
      lastSeenOrdinal: this.sessionOrdinal,
      dueAt: now,
      dueAfterOrdinal: null,
      level: 'new' as ReviewLevel,
      averageResponseMs: responseTimeMs || 4000,
      recentQuestionIds: [],
      distinctDaysCount: 1,
      lastDayStr: today,
    };

    const grade = this.inferGrade(isCorrect, responseTimeMs, existing.consecutiveCorrect);

    existing.seenCount += 1;
    existing.lastSeenAt = now;
    existing.lastSeenOrdinal = this.sessionOrdinal;
    existing.lastResult = grade;

    if (existing.lastDayStr !== today) {
      existing.distinctDaysCount += 1;
      existing.lastDayStr = today;
    }

    if (responseTimeMs) {
      existing.averageResponseMs = Math.round(
        (existing.averageResponseMs || responseTimeMs) * 0.7 + responseTimeMs * 0.3
      );
    }

    if (question.id && !existing.recentQuestionIds.includes(question.id)) {
      existing.recentQuestionIds = [...existing.recentQuestionIds.slice(-4), question.id];
    }

    if (!isCorrect) {
      // WRONG ANSWER: again
      existing.wrongCount += 1;
      existing.consecutiveCorrect = 0;
      existing.lapseCount += 1;

      // In-session repeat with natural, unpredictable spacing (randomly 20 to 30 questions later)
      const fuzzGap = Math.floor(20 + Math.random() * 11); // 20 to 30
      existing.dueAfterOrdinal = this.sessionOrdinal + fuzzGap;

      // High-priority next day calendar retry (~1 day ± 15% jitter)
      const dueDays = applyFuzz(1.0, 0.15);
      existing.dueAt = now + Math.round(dueDays * 86400000);
      existing.level = 'learning';
    } else {
      // CORRECT ANSWER: good / easy / hard
      existing.correctCount += 1;
      existing.consecutiveCorrect += 1;
      existing.dueAfterOrdinal = null;

      // Spaced interval progression: 3d -> 7d -> 14d -> 30d -> 60d
      let baseIntervalDays = 3;
      if (existing.consecutiveCorrect === 1) {
        baseIntervalDays = 3;
      } else if (existing.consecutiveCorrect === 2) {
        baseIntervalDays = 7;
      } else if (existing.consecutiveCorrect === 3) {
        baseIntervalDays = 14;
      } else if (existing.consecutiveCorrect === 4) {
        baseIntervalDays = 30;
      } else {
        baseIntervalDays = 60;
      }

      // Small speed modifier (max ~10-15%, only applied when correct)
      if (grade === 'easy') {
        baseIntervalDays *= 1.12; // +12% slight boost for confident fast recall
      } else if (grade === 'hard') {
        baseIntervalDays *= 0.88; // -12% slight reduction for slow recall
      }

      // Light jitter (12%) so items don't clump on the exact same second
      const fuzzedDays = applyFuzz(baseIntervalDays, 0.12);
      existing.dueAt = now + Math.round(fuzzedDays * 86400000);

      // Mastery: ~4 successful reviews across separate sessions/days with no active lapses
      if (
        existing.consecutiveCorrect >= 4 &&
        existing.distinctDaysCount >= 2 &&
        existing.lapseCount === 0
      ) {
        existing.level = 'mastered';
      } else if (existing.consecutiveCorrect >= 3) {
        existing.level = 'strong';
      } else if (existing.consecutiveCorrect >= 2) {
        existing.level = 'familiar';
      } else {
        existing.level = 'learning';
      }
    }

    this.reviewStates.set(memoryKey, existing);
    this.pendingSyncKeys.add(memoryKey);

    this.saveToLocalStorage();
    this.scheduleCloudSync();

    return existing;
  }

  // Set saved status
  public setSavedStatus(memoryKey: string, isSaved: boolean) {
    this.init();
    const key = memoryKey.toLowerCase().trim();
    const state = this.reviewStates.get(key);
    if (state) {
      state.isSaved = isSaved;
      this.pendingSyncKeys.add(key);
      this.saveToLocalStorage();
      this.scheduleCloudSync();
    }
  }

  // Summary statistics for dashboard/practice UI
  public getStats(): {
    totalConcepts: number;
    newCount: number;
    learningCount: number;
    familiarCount: number;
    strongCount: number;
    masteredCount: number;
    dueCount: number;
  } {
    this.init();
    const all = Array.from(this.reviewStates.values());
    const now = Date.now();

    let newCount = 0;
    let learningCount = 0;
    let familiarCount = 0;
    let strongCount = 0;
    let masteredCount = 0;
    let dueCount = 0;

    for (const s of all) {
      if (s.level === 'mastered') masteredCount++;
      else if (s.level === 'strong') strongCount++;
      else if (s.level === 'familiar') familiarCount++;
      else if (s.level === 'learning') learningCount++;
      else newCount++;

      if (this.isConceptDue(s.memoryKey, now)) {
        dueCount++;
      }
    }

    return {
      totalConcepts: all.length,
      newCount,
      learningCount,
      familiarCount,
      strongCount,
      masteredCount,
      dueCount,
    };
  }

  // Local Storage persistence
  private loadFromLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REVIEWS);
      if (raw) {
        const parsed: ReviewState[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.memoryKey) {
              this.reviewStates.set(item.memoryKey.toLowerCase().trim(), item);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load review states from localStorage:', e);
    }
  }

  private saveToLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const array = Array.from(this.reviewStates.values());
      localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(array));
    } catch (e) {
      console.warn('Failed to save review states to localStorage:', e);
    }
  }

  // Migration from legacy mastery data (vocabclash_pyq_mastery_v2)
  private performLegacyMigration() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const migrated = localStorage.getItem(STORAGE_KEY_MIGRATION);
      if (migrated) return;

      const rawMastery = localStorage.getItem('vocabclash_pyq_mastery_v2');
      if (rawMastery) {
        const parsed = JSON.parse(rawMastery);
        const now = Date.now();
        const today = getTodayStr();

        for (const [key, oldRecord] of Object.entries<any>(parsed)) {
          const memoryKey = `word:${key.toLowerCase().trim()}`;
          if (!this.reviewStates.has(memoryKey) && oldRecord) {
            const correct = oldRecord.correctCount || 0;
            const incorrect = oldRecord.incorrectCount || 0;
            const consecutive = oldRecord.consecutiveCorrect || (correct > 0 && incorrect === 0 ? correct : 1);

            let initialLevel: ReviewLevel = 'learning';
            if (correct >= 4 && consecutive >= 2) initialLevel = 'familiar';
            if (correct >= 7 && consecutive >= 3) initialLevel = 'strong';

            const migratedState: ReviewState = {
              memoryKey,
              category: 'synonyms',
              conceptDisplay: key,
              firstSeenAt: oldRecord.lastAttemptTimestamp || now - 86400000 * 3,
              lastSeenAt: oldRecord.lastAttemptTimestamp || now,
              seenCount: correct + incorrect,
              correctCount: correct,
              wrongCount: incorrect,
              consecutiveCorrect: Math.min(3, consecutive),
              lapseCount: incorrect > 0 ? 1 : 0,
              lastResult: incorrect > 0 ? 'hard' : 'good',
              lastSeenOrdinal: 0,
              dueAt: now + (correct >= 3 ? 86400000 * 2 : 86400000),
              dueAfterOrdinal: null,
              level: initialLevel,
              recentQuestionIds: [],
              distinctDaysCount: correct >= 3 ? 2 : 1,
              lastDayStr: today,
            };

            this.reviewStates.set(memoryKey, migratedState);
          }
        }
      }

      localStorage.setItem(STORAGE_KEY_MIGRATION, 'true');
      this.saveToLocalStorage();
    } catch (e) {
      console.warn('Legacy review migration skipped or failed:', e);
    }
  }

  // Cloud Sync for logged-in users (batched & throttled)
  private scheduleCloudSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.flushCloudSync().catch(err => console.warn('Background review sync error:', err));
    }, 4000);
  }

  public async flushCloudSync(): Promise<void> {
    const user = auth.currentUser;
    if (!user || this.pendingSyncKeys.size === 0) return;

    const keysToSync = Array.from(this.pendingSyncKeys);
    this.pendingSyncKeys.clear();

    try {
      const batch = writeBatch(db);
      let opCount = 0;

      for (const key of keysToSync) {
        const state = this.reviewStates.get(key);
        if (state) {
          // Sanitize key for Firestore doc ID
          const safeDocId = encodeURIComponent(key).replace(/\./g, '_').slice(0, 100);
          const docRef = doc(db, 'users', user.uid, 'review_progress', safeDocId);
          batch.set(docRef, { ...state, updatedAt: Date.now() }, { merge: true });
          opCount++;
          if (opCount >= 400) break; // Firestore batch write cap
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.warn('Error syncing review progress to Firestore:', err);
      // Re-add unsynced keys on failure
      for (const k of keysToSync) this.pendingSyncKeys.add(k);
    }
  }

  private currentAuthUid: string | null = null;

  /**
   * Resets all in-memory review states and clears local storage on logout
   */
  public reset(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.pendingSyncKeys.clear();
    this.reviewStates.clear();
    this.sessionOrdinal = 0;
    this.recentMemoryKeys = [];
    this.recentQuestionIds = [];
    this.currentAuthUid = null;
    this.initialized = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY_REVIEWS);
      } catch (e) {
        console.warn('Failed to clear review states from localStorage:', e);
      }
    }
  }

  // Hydrate user progress from Firestore subcollection on login
  public setAuthUser(uid: string | null) {
    if (this.currentAuthUid && !uid) {
      // Authenticated user logged out: clean memory and localStorage
      this.reset();
      return;
    }
    if (this.currentAuthUid && uid && this.currentAuthUid !== uid) {
      // User switched: reset previous user's data before hydrating
      this.reset();
    }
    this.currentAuthUid = uid;
    if (uid) {
      this.hydrateUserProgressFromCloud(uid).catch(err => console.warn('Hydrate review progress error:', err));
    }
  }

  public async hydrateUserProgressFromCloud(uid: string): Promise<number> {
    try {
      const colRef = collection(db, 'users', uid, 'review_progress');
      const q = query(colRef, limit(1000));
      const snap = await getDocs(q);
      let count = 0;

      snap.forEach(docSnap => {
        const data = docSnap.data() as ReviewState;
        if (data && data.memoryKey) {
          const key = data.memoryKey.toLowerCase().trim();
          const existing = this.reviewStates.get(key);
          if (!existing || (data.lastSeenAt || 0) > (existing.lastSeenAt || 0)) {
            this.reviewStates.set(key, data);
            count++;
          }
        }
      });

      if (count > 0) {
        this.saveToLocalStorage();
      }
      return count;
    } catch (err) {
      console.warn('Failed to hydrate review progress from cloud:', err);
      return 0;
    }
  }
}

export const questionReviewScheduler = new QuestionReviewScheduler();
